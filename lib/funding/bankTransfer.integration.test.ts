/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/toss', () => ({
  ...jest.requireActual('../booking/toss'),
  cancelPayment: jest.fn(), confirmPayment: jest.fn(), fetchPayment: jest.fn(),
}));
jest.mock('./email', () => ({
  sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendFundingCancelledEmails: jest.fn().mockResolvedValue(null),
  sendFundingDepositGuideEmails: jest.fn().mockResolvedValue(null),
}));
jest.mock('./repository', () => ({
  ...jest.requireActual('./repository'),
  getFundingProjectAsync: jest.fn(async () => PROJECT),
  getFundingProjectOrFailure: jest.fn(async () => ({ project: PROJECT, lookupFailed: false })),
}));

/* eslint-disable import/first */
import { cancelUnpaidBankDeposit, confirmBankDeposit, countOpenBankDeposits, deliverDepositGuide, findSameNameBankDeposits } from './bankTransfer';
import { cancelFundingPledge } from './cancel';
import { sendFundingCancelledEmails, sendFundingConfirmedEmails, sendFundingDepositGuideEmails } from './email';
import { parseFundingProject } from './projects';
import { aggregateProjectStatus, expireStalePledges, findFundingOrderByOrderNo } from './service';
import { loadRefundAccount } from './refundAccount';
import { purgeFundingRefundAccountsOfPurgedOrders, PURGED_MARK } from '../privacy/orderRetention';
import { FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
import { SEND_PENDING } from '../ops/notificationSentinel';
import type { LegacyPledgePayload as CreatePledgePayload } from '../../test-utils/fundingPledge';
import { createSingleRewardPledge } from '../../test-utils/fundingPledge';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
let client: Client;

const PROJECT = parseFundingProject(`---
slug: demo
title: 데모
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: 한정 CD
    description: d
    amount: 30000
    totalQuantity: 1
    requiresShipping: false
    estimatedDelivery: 2026-12
  - id: book
    title: 책
    description: d
    amount: 20000
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
    downloads:
      - label: MP3
        key: demo/abc/album.zip
---
`, 'demo');
const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'bank_transfer',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, supporterMessage: '응원합니다', termsAgreed: true, ...over,
});

const createBank = async (over: Partial<CreatePledgePayload> = {}, rewardId = 'mail', now = NOW) => {
  const c = await createSingleRewardPledge(payloadFor(over), PROJECT, reward(rewardId), now);
  if (!c.ok) throw new Error('create failed');
  const order = await findFundingOrderByOrderNo(c.orderNo);
  return { ...c, id: order!.id };
};

const ACCOUNT = { bankName: '국민은행', accountNumber: '123-456-7890123', accountHolder: '김후원' };
let previousKey: string | undefined;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
beforeEach(async () => {
  await client.execute('DELETE FROM funding_project_payouts');
  await client.execute('DELETE FROM funding_projects');
  await client.execute('DELETE FROM funding_creators');
  previousKey = process.env[FIELD_CRYPTO_KEY_ENV];
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 5).toString('base64');
  await client.execute('DELETE FROM funding_refund_accounts');
  await client.execute('DELETE FROM refunds');
  await client.execute('DELETE FROM funding_pledge_items');
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
});
afterEach(() => {
  if (previousKey === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = previousKey;
  jest.restoreAllMocks();
});
afterAll(() => client.close());

describe('계좌 입금 신청 — 자동 취소가 없다', () => {
  it('pending으로 만들고, 기한(hold_expires_at)은 신청 + 3일이다', async () => {
    const c = await createBank();
    expect(c.holdExpiresAt.getTime() - NOW.getTime()).toBe(3 * DAY);
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('pending');
    expect(o?.fundingPledge?.paymentMethod).toBe('bank_transfer');
    expect(o?.fundingPledge?.entrySource).toBe('online');
  });

  it('기한이 지나도 expireStalePledges가 만료시키지 않는다 — 토스 홀드는 만료된다', async () => {
    const bank = await createBank();
    const toss = await createBank({ paymentMethod: 'toss', customerEmail: 't@example.com' });
    await expireStalePledges(new Date(NOW.getTime() + 30 * DAY));
    expect((await findFundingOrderByOrderNo(bank.orderNo))?.status).toBe('pending');
    expect((await findFundingOrderByOrderNo(toss.orderNo))?.status).toBe('expired');
  });

  it('토스 재제출의 자기 홀드 해제도 계좌 입금 신청을 건드리지 않는다', async () => {
    const bank = await createBank();
    const again = await createSingleRewardPledge(payloadFor({ paymentMethod: 'toss' }), PROJECT, reward('mail'), NOW, { releaseOrderNo: bank.orderNo });
    expect(again.ok).toBe(true);
    expect((await findFundingOrderByOrderNo(bank.orderNo))?.status).toBe('pending');
  });

  it('입금 확인 전에는 모금액·건수·명단·응원 메시지에 들어가지 않는다', async () => {
    await createBank();
    const status = await aggregateProjectStatus(PROJECT, NOW);
    expect(status.raisedAmount).toBe(0);
    expect(status.backerCount).toBe(0);
    expect(status.publicBackers).toEqual([]);
    expect(status.publicMessages).toEqual([]);
  });

  it('입금 안내 메일을 보내고, 실패하면 사유를 notification_error에 남긴다', async () => {
    const c = await createBank();
    (sendFundingDepositGuideEmails as jest.Mock).mockResolvedValueOnce('customer:resend_down');
    expect(await deliverDepositGuide(c.orderNo)).toBe('customer:resend_down');
    expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBe('customer:resend_down');
    // 재발송이 성공하면 비운다.
    expect(await deliverDepositGuide(c.orderNo)).toBeNull();
    expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBeNull();
  });
});

describe('입금 확인', () => {
  it('pending → paid, paid_at, 확정 메일 한 번. 디지털 전용이면 delivered_at도 찍는다', async () => {
    const c = await createBank();
    const r = await confirmBankDeposit({ orderId: c.id, now: NOW });
    expect(r).toEqual({ ok: true, emailSent: true });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.fundingPledge?.paidAt?.getTime()).toBe(Math.floor(NOW.getTime() / 1000) * 1000);
    expect(o?.fundingPledge?.deliveredAt).not.toBeNull();
    expect(o?.notificationError).toBeNull();
    expect(sendFundingConfirmedEmails).toHaveBeenCalledTimes(1);
    // 확인 뒤에는 모금액·명단에 들어간다.
    const status = await aggregateProjectStatus(PROJECT, NOW);
    expect(status.raisedAmount).toBe(5000);
    expect(status.publicBackers).toEqual(['김후원']);
  });

  it('배송 리워드는 delivered_at을 찍지 않는다', async () => {
    const c = await createBank({ shipping: { name: '김', phone: '010', postcode: '1', address1: '서울' } }, 'book');
    await confirmBankDeposit({ orderId: c.id, now: NOW });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.deliveredAt).toBeNull();
  });

  it('두 번 눌러도 한 번만 전이하고 확정 메일도 한 번이다', async () => {
    const c = await createBank();
    const [a, b] = await Promise.all([
      confirmBankDeposit({ orderId: c.id, now: NOW }),
      confirmBankDeposit({ orderId: c.id, now: NOW }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(sendFundingConfirmedEmails).toHaveBeenCalledTimes(1);
    expect((await confirmBankDeposit({ orderId: c.id, now: NOW })).ok).toBe(false);
  });

  it('메일이 실패하면 사유가 센티널을 대체한다(재발송 대상이 된다)', async () => {
    const c = await createBank();
    (sendFundingConfirmedEmails as jest.Mock).mockResolvedValueOnce('customer:down');
    const r = await confirmBankDeposit({ orderId: c.id, now: NOW });
    expect(r).toEqual({ ok: true, emailSent: false });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBe('customer:down');
  });

  it('미입금 취소(expired)된 신청도 늦은 입금으로 확정할 수 있다', async () => {
    const c = await createBank();
    expect((await cancelUnpaidBankDeposit({ id: c.id })).ok).toBe(true);
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('expired');
    expect((await confirmBankDeposit({ orderId: c.id, now: NOW })).ok).toBe(true);
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
  });

  it('토스 주문은 입금 확인 대상이 아니다', async () => {
    const c = await createBank({ paymentMethod: 'toss' });
    expect(await confirmBankDeposit({ orderId: c.id, now: NOW })).toMatchObject({ ok: false, code: 'not_bank_transfer' });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).not.toBe(SEND_PENDING);
  });
});

describe('미입금 취소·입금 전 신청 취소', () => {
  it('관리자 미입금 취소 — pending → expired, 메일 없음, 두 번째는 거절', async () => {
    const c = await createBank();
    expect((await cancelUnpaidBankDeposit({ id: c.id })).ok).toBe(true);
    expect((await cancelUnpaidBankDeposit({ id: c.id })).ok).toBe(false);
    expect(sendFundingCancelledEmails).not.toHaveBeenCalled();
  });

  it('후원자의 입금 전 신청 취소는 같은 전이(withdrawn)다', async () => {
    const c = await createBank();
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'withdrawn', refundAmount: 0 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('expired');
    expect(sendFundingCancelledEmails).not.toHaveBeenCalled();
  });

  it('입금 확인된 건은 미입금 취소할 수 없다', async () => {
    const c = await createBank();
    await confirmBankDeposit({ orderId: c.id, now: NOW });
    expect((await cancelUnpaidBankDeposit({ id: c.id })).ok).toBe(false);
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
  });

  it('토스 결제 대기는 후원자가 거둘 수 없다(홀드가 스스로 닫는다)', async () => {
    const c = await createBank({ paymentMethod: 'toss' });
    expect((await cancelUnpaidBankDeposit({ id: c.id })).ok).toBe(false);
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect(r.ok).toBe(false);
  });
});

describe('입금 뒤 셀프 취소 — 환불 계좌 접수', () => {
  const paidBank = async () => {
    const c = await createBank();
    await confirmBankDeposit({ orderId: c.id, now: NOW });
    jest.clearAllMocks();
    return c;
  };

  it('환불 계좌를 받아 접수한다 — 계좌번호는 암호문으로만 저장된다', async () => {
    const c = await paidBank();
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW, refundAccount: ACCOUNT });
    expect(r).toEqual({ ok: true, mode: 'refund_requested', refundAmount: 5000 });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid'); // 돈이 나가기 전까지는 paid — 운영자가 송금 뒤 기록한다
    expect(o?.fundingPledge?.refundRequestedAt).not.toBeNull();

    const raw = await client.execute({ sql: 'SELECT * FROM funding_refund_accounts WHERE order_id = ?', args: [c.id] });
    expect(raw.rows).toHaveLength(1);
    expect(JSON.stringify(raw.rows[0])).not.toContain('7890123');
    expect(String(raw.rows[0].account_number_enc)).toMatch(/^v2:/);
    expect(raw.rows[0].bank_name).toBe('국민은행');
    expect(await loadRefundAccount(c.id)).toEqual(ACCOUNT);
    expect(sendFundingCancelledEmails).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'refund_requested', 5000);
  });

  it('계좌가 비면 접수하지 않는다', async () => {
    const c = await paidBank();
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: { bankName: '국민', accountNumber: '', accountHolder: '김' } });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.refundRequestedAt).toBeNull();
  });

  it('두 번째 접수는 거절하고 계좌를 덮어쓰지 않는다', async () => {
    const c = await paidBank();
    await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: ACCOUNT });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: { ...ACCOUNT, accountNumber: '999-999-9999999' } });
    expect(r.ok).toBe(false);
    expect((await loadRefundAccount(c.id))?.accountNumber).toBe(ACCOUNT.accountNumber);
  });

  it('키가 없는 배포는 평문으로 저장하지 않고 접수를 거절한다', async () => {
    const c = await paidBank();
    delete process.env[FIELD_CRYPTO_KEY_ENV];
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: ACCOUNT });
    expect(r).toMatchObject({ ok: false, code: 'temporarily_unavailable' });
    expect((await client.execute('SELECT COUNT(*) AS n FROM funding_refund_accounts')).rows[0].n).toBe(0);
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.refundRequestedAt).toBeNull();
  });

  it('관리자 "송금 완료(환불 기록)" — refunded로 기록한다(토스를 부르지 않는다)', async () => {
    const c = await paidBank();
    await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: ACCOUNT });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: '계좌 송금 환불', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'recorded', refundAmount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });

  it('주문의 5년 파기 때 환불 계좌도 지운다', async () => {
    const c = await paidBank();
    await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: ACCOUNT });
    expect((await purgeFundingRefundAccountsOfPurgedOrders()).purged).toBe(0);
    await client.execute({ sql: 'UPDATE orders SET customer_name = ? WHERE id = ?', args: [PURGED_MARK, c.id] });
    expect((await purgeFundingRefundAccountsOfPurgedOrders()).purged).toBe(1);
    expect(await loadRefundAccount(c.id)).toBeNull();
  });
});

describe('같은 이름의 다른 계좌 입금 신청 — 이중 확인 방지 후보', () => {
  it('프로젝트와 무관하게 같은 이름의 pending·expired 계좌 입금을 찾는다(자기 자신·토스·확정 건 제외)', async () => {
    const a = await createBank();
    const b = await createBank({ customerEmail: 'b@example.com' });
    const c = await createBank({ customerEmail: 'c@example.com' });
    await cancelUnpaidBankDeposit({ id: c.id });
    const d = await createBank({ customerEmail: 'd@example.com' });
    await confirmBankDeposit({ orderId: d.id, now: NOW });
    await createBank({ paymentMethod: 'toss', customerEmail: 'e@example.com' });
    await createBank({ customerName: '다른 사람', customerEmail: 'f@example.com' });

    const found = await findSameNameBankDeposits({ id: a.id, customerName: '김후원' });
    expect(found.map((f) => f.orderNo).sort()).toEqual([b.orderNo, c.orderNo].sort());
  });
});

/** 독립 리뷰(2026-10-04) 7건의 재현 테스트. */
describe('리뷰 지적 — 재현', () => {
  it('[2] 입금 안내 메일 실패 사유가 남은 신청을 닫으면 그 사유도 비운다(끌 수 없는 경보 방지)', async () => {
    const c = await createBank();
    (sendFundingDepositGuideEmails as jest.Mock).mockResolvedValueOnce('customer:down');
    await deliverDepositGuide(c.orderNo);
    expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBe('customer:down');
    await cancelUnpaidBankDeposit({ id: c.id });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBeNull();

    // 후원자의 입금 전 신청 취소도 같은 전이다.
    const d = await createBank({ customerEmail: 'd@example.com' });
    (sendFundingDepositGuideEmails as jest.Mock).mockResolvedValueOnce('customer:down');
    await deliverDepositGuide(d.orderNo);
    await cancelFundingPledge({ orderNo: d.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect((await findFundingOrderByOrderNo(d.orderNo))?.notificationError).toBeNull();
  });

  it('[7] 옛 무통장 행의 한정 리워드는 확정 때 재고를 다시 센다 — 넘치면 사유와 함께 거부', async () => {
    const legacy = await createBank({}, 'cd'); // 한정 1개 — 옛 무통장 행 모양
    await cancelUnpaidBankDeposit({ id: legacy.id }); // 만료되어 재고에서 빠진 사이
    const toss = await createBank({ paymentMethod: 'toss', customerEmail: 't@example.com' }, 'cd');
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE id=?", args: [toss.id] }); // 남은 1개가 팔렸다
    const r = await confirmBankDeposit({ orderId: legacy.id, now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'sold_out' });
    expect(r.ok === false && r.message).toContain('한정 CD');
    expect((await findFundingOrderByOrderNo(legacy.orderNo))?.status).toBe('expired');
    expect(sendFundingConfirmedEmails).not.toHaveBeenCalled();
  });

  it('[7] 재고가 남아 있으면 한정 리워드 옛 행도 확정한다(자기 홀드는 세지 않는다)', async () => {
    const legacy = await createBank({}, 'cd');
    expect((await confirmBankDeposit({ orderId: legacy.id, now: NOW })).ok).toBe(true);
  });

  it('[3] 정산이 기록된 프로젝트의 늦은 입금 확정은 warnings로 드러낸다', async () => {
    await client.execute("INSERT INTO funding_creators (id, email, name) VALUES ('cr1', 'c@example.com', '개설자')");
    await client.execute(`INSERT INTO funding_projects (id, slug, creator_id, title, summary, content, cover_url, goal_amount, start_at, end_at, review_status, status)
      VALUES ('pj1', 'demo', 'cr1', '제목', '요약', '본문', '/c.webp', 100000, 1790000000, 1790100000, 'approved', 'auto')`);
    await client.execute(`INSERT INTO funding_project_payouts (id, project_id, gross_amount, refund_amount, supply_amount, fee_amount, share_amount, withholding_amount, net_amount, backer_count, status, paid_at)
      VALUES ('pp1', 'pj1', 100000, 0, 90909, 8000, 92000, 3036, 88964, 3, 'paid', 1790200000)`);
    const c = await createBank();
    const r = await confirmBankDeposit({ orderId: c.id, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.ok && r.warnings?.[0]).toContain('추가로 보낼 몫');
  });

  it('[4] 열린 입금 대기 건수는 정규화한 이메일로 센다', async () => {
    await createBank({ customerEmail: 'hogil@gmail.com' });
    await createBank({ customerEmail: 'ho.gil+2@gmail.com' });
    const closed = await createBank({ customerEmail: 'h.o.gil@googlemail.com' });
    await cancelUnpaidBankDeposit({ id: closed.id });
    await createBank({ customerEmail: 'other@gmail.com' });
    expect(await countOpenBankDeposits('demo', 'hogil@gmail.com')).toBe(2);
  });

  it('[1] 취소 요청 뒤 내려받기가 찍힌 건을 송금 완료로 기록하면 경고한다', async () => {
    const c = await createBank();
    await confirmBankDeposit({ orderId: c.id, now: NOW });
    await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: ACCOUNT });
    // 가드 전에 생긴 행 모양 — 요청 시각 뒤에 내려받기가 찍혔다.
    await client.execute({ sql: 'UPDATE funding_pledges SET downloaded_at = refund_requested_at + 60 WHERE order_id = ?', args: [c.id] });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: '계좌 송금 환불', now: NOW });
    expect(r).toMatchObject({ ok: true, mode: 'recorded' });
    expect(r.ok && r.warnings?.[0]).toContain('내려받았습니다');
  });

  it('[6] 환불 계좌 저장이 실패해도 로그에 암호문·예금주가 남지 않는다', async () => {
    const c = await createBank();
    await confirmBankDeposit({ orderId: c.id, now: NOW });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await client.execute('ALTER TABLE funding_refund_accounts RENAME TO funding_refund_accounts_off');
    try {
      const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW, refundAccount: { ...ACCOUNT, accountHolder: '홍예금주' } });
      expect(r).toMatchObject({ ok: false, code: 'temporarily_unavailable' });
    } finally {
      await client.execute('ALTER TABLE funding_refund_accounts_off RENAME TO funding_refund_accounts');
    }
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain('환불 계좌 저장 실패');
    expect(logged).not.toContain('v2:');
    expect(logged).not.toContain('홍예금주');
    expect(logged).not.toContain('국민은행');
    // 접수 표식은 되돌렸다.
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.refundRequestedAt).toBeNull();
  });
});
