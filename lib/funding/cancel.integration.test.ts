/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
// 상수(VIRTUAL_ACCOUNT_ERROR_CODE 등)까지 목이 덮으면 undefined가 되어 cancel.ts의 분기가
// 조용히 꺼진다 — 실제 모듈을 펼친 위에 네트워크로 나가는 함수만 목으로 바꾼다.
jest.mock('../booking/toss', () => ({
  ...jest.requireActual('../booking/toss'),
  cancelPayment: jest.fn(), confirmPayment: jest.fn(), fetchPayment: jest.fn(),
}));
jest.mock('./email', () => ({
  sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendFundingCancelledEmails: jest.fn().mockResolvedValue(null),
}));
jest.mock('./projects', () => ({ ...jest.requireActual('./projects'), getFundingProject: () => PROJECT }));
// findFundingOrderByOrderNo를 감싼다 — cancel.ts가 "읽고 → 검사 → 쓰기"를 하는 구조라,
// 읽기와 쓰기 **사이**에 경쟁 요청이 끼어든 상황을 재현하려면 그 창을 열 수 있어야 한다.
// 기본 구현은 실제 함수 그대로다.
jest.mock('./service', () => {
  const actual = jest.requireActual('./service');
  return { ...actual, findFundingOrderByOrderNo: jest.fn(actual.findFundingOrderByOrderNo) };
});

// eslint-disable-next-line import/first
import { cancelFundingPledge } from './cancel';
// eslint-disable-next-line import/first
import { cancelPayment } from '../booking/toss';
// eslint-disable-next-line import/first
import { sendFundingCancelledEmails } from './email';
// eslint-disable-next-line import/first
import { createFundingPledge, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import { isLiveFundingOrderStatus, remainingRefundable } from './refundable';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
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
    title: CD
    description: d
    amount: 30000
    totalQuantity: 1
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

const markPaidWithToss = async (orderNo: string) => {
  const o = await findFundingOrderByOrderNo(orderNo);
  await client.execute({ sql: "UPDATE orders SET status='paid' WHERE id=?", args: [o!.id] });
  await client.execute({ sql: "INSERT INTO payments (id,order_id,payment_key) VALUES ('p1',?, 'pk_c')", args: [o!.id] });
};


/**
 * 중단 전에 만들어진 무통장 후원 행을 직접 만든다.
 *
 * createFundingPledge로는 더 이상 만들 수 없다 — 무통장입금은 2026-09-11에 중단했고
 * validation이 결제수단을 toss로 못박는다. 그래도 DB에는 중단 전 행이 남아 있고,
 * cancel.ts가 그 행을 위해 관리자 기록 경로를 남겨 뒀다. 그 경로를 검증하려면
 * 옛 모양의 행이 필요하다.
 */
const insertLegacyBankPledge = async (orderNo: string, over: { status?: string } = {}) => {
  const id = `o-${orderNo}`;
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
            manage_token, item_amount, vat_amount, total_amount, created_at, updated_at)
          VALUES (?,?,'funding',?, '김후원','010-1111-2222','a@example.com', ?, 4546, 454, 5000, unixepoch(), unixepoch())`,
    args: [id, orderNo, over.status ?? 'paid', `tok-${orderNo}`],
  });
  await client.execute({
    sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount,
            quantity, additional_amount, payment_method, hold_expires_at, display_name_public, created_at, updated_at)
          VALUES (?,?,'demo','mail','감사 메일',5000,1,0,'bank_transfer', unixepoch(), 1, unixepoch(), unixepoch())`,
    args: [`p-${orderNo}`, id],
  });
  return { id, orderNo };
};

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
  await client.execute('DELETE FROM refunds');
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(() => client.close());

describe('cancelFundingPledge', () => {
  it('토스 결제 셀프 취소 → 전액 환불·refunded', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [{ transactionKey: 'tx', cancelAmount: 5000 }] } });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'refunded', refundAmount: 5000 });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: 5000, idempotencyKey: `refund:${c.orderNo}:5000` }));
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
    const rows = await client.execute('SELECT status, amount, toss_transaction_key FROM refunds');
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ status: 'done', amount: 5000, toss_transaction_key: 'tx' });
  });
  it('취소 메일이 실패 문자열을 돌려줘도 outcome은 ok:true이고 notificationError에 남는다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [{ transactionKey: 'tx', cancelAmount: 5000 }] } });
    (sendFundingCancelledEmails as jest.Mock).mockResolvedValueOnce('customer:API_ERROR');
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'refunded', refundAmount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBe('customer:API_ERROR');
  });
  it('토스가 거절하면 상태를 되돌리고 failed refund를 남긴다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'X', message: '거절' });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
    const rows = await client.execute('SELECT status FROM refunds');
    expect(rows.rows[0].status).toBe('failed');
  });
  /**
   * 토스 호출은 12초에 타임아웃하는데, 그 실패는 "거절됐다"와 "됐는데 응답만 늦었다"를
   * 구분하지 못한다. 후자라면 CANCELED 웹훅이 먼저 도착해 done 환불을 남긴다. 예전에는
   * 그 뒤 revert가 돌아 **환불이 끝난 건을 paid로 되살렸다** — 공개 모금액에 환불된 돈이
   * 남고, 그 사람이 음원을 계속 받고, 재취소는 잔액 0이라 막힌다. 스스로 낫지 않는다.
   */
  it('토스 응답이 늦는 사이 웹훅이 환불을 기록하면 되돌리지 않는다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockImplementationOnce(async () => {
      // 취소는 성사됐고, 그 웹훅이 우리 응답보다 먼저 도착해 대사를 끝냈다.
      await client.execute("INSERT INTO refunds (id,payment_id,amount,reason,requested_by,status) VALUES ('rw','p1',5000,'웹훅 대사','webhook','done')");
      await client.execute({ sql: "UPDATE orders SET status='refunded' WHERE order_no=?", args: [c.orderNo] });
      return { ok: false, code: 'NETWORK_ERROR', message: '타임아웃' };
    });

    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });

    const after = await findFundingOrderByOrderNo(c.orderNo);
    expect(after?.status).toBe('refunded');
    // 살아 있는 후원이 아니어야 음원·모금액·발송 명단에서 함께 빠진다.
    expect(isLiveFundingOrderStatus(after!.status)).toBe(false);
    expect(remainingRefundable(after!)).toBe(0);
  });

  /**
   * 대조. 웹훅이 끼어들지 않았으면 예전처럼 되돌아가야 한다 — 가드가 정상 실패까지
   * 붙들어 두면 결제된 건이 영영 refunded로 남는다. 이미 부분환불이 있던 건도 마찬가지다.
   */
  it('이미 있던 부분환불은 되돌림을 막지 않는다 — 그 사이 새로 기록된 것이 없으면 되돌린다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [c.orderNo] });
    await client.execute("INSERT INTO refunds (id,payment_id,amount,reason,requested_by,status) VALUES ('rp','p1',2000,'부분','admin','done')");

    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'X', message: '거절' });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('partially_refunded');
  });

  it('부분환불 건 — 고객은 거부, 관리자는 잔액만 환불한다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [c.orderNo] });
    await client.execute("INSERT INTO refunds (id,payment_id,amount,reason,requested_by,status) VALUES ('r1','p1',2000,'부분','admin','done')");
    expect(await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW }))
      .toMatchObject({ ok: false, code: 'invalid_state', message: '일부 환불된 펀딩은 문의해 주세요.' });
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [{ transactionKey: 'tx2', cancelAmount: 3000 }] } });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'refunded', refundAmount: 3000 });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: 3000 }));
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });
  it('중단 전 무통장 부분환불 건도 관리자가 잔액만 정리할 수 있다', async () => {
    const c = await insertLegacyBankPledge('FND-LEGACY-1');
    await markPaidWithToss(c.orderNo);
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [c.orderNo] });
    await client.execute("INSERT INTO refunds (id,payment_id,amount,reason,requested_by,status) VALUES ('rb','p1',1500,'부분','admin','done')");
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'recorded', refundAmount: 3500 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });
  // 환불이 payments[1]에 기록돼 있으면 payments[0]만 보는 계산은 그 환불을 통째로 놓친다 —
  // 웹훅 대사(syncFundingCancelledFromToss)가 paymentKey로 행을 골라 기록하므로 실제로 생기는 형태다.
  it('환불이 두 번째 결제 행에 기록돼 있어도 잔액은 전 행 합산으로 계산한다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    const o = await findFundingOrderByOrderNo(c.orderNo);
    await client.execute({ sql: "INSERT INTO payments (id,order_id,payment_key) VALUES ('p2',?, 'pk_c2')", args: [o!.id] });
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE id=?", args: [o!.id] });
    await client.execute("INSERT INTO refunds (id,payment_id,amount,reason,requested_by,status) VALUES ('r2','p2',2000,'부분','webhook','done')");

    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [{ transactionKey: 'tx3', cancelAmount: 3000 }] } });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'refunded', refundAmount: 3000 });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: 3000 }));
    expect(sendFundingCancelledEmails).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'refunded', 3000);
  });

  it('잔액이 0이면 토스를 부르지 않고 invalid_state', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    const o = await findFundingOrderByOrderNo(c.orderNo);
    await client.execute({ sql: "INSERT INTO payments (id,order_id,payment_key) VALUES ('p2',?, 'pk_c2')", args: [o!.id] });
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE id=?", args: [o!.id] });
    await client.execute("INSERT INTO refunds (id,payment_id,amount,reason,requested_by,status) VALUES ('r3','p2',5000,'전액','webhook','done')");

    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('partially_refunded');
  });

  it('중단 전 무통장 건도 잔액이 0이면 refunded로 넘기지 않는다', async () => {
    const c = await insertLegacyBankPledge('FND-LEGACY-2');
    await markPaidWithToss(c.orderNo);
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [c.orderNo] });
    await client.execute("INSERT INTO refunds (id,payment_id,amount,reason,requested_by,status) VALUES ('r4','p1',5000,'전액','admin','done')");
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('partially_refunded');
  });

  /**
   * 무통장입금은 중단했다. 남아 있는 옛 행에서 고객이 셀프 취소를 누르면 예전에는
   * 환불 요청이 접수돼 운영자가 손으로 송금해야 했다 — 그 수작업이 이 결제수단을
   * 걷어낸 이유다. 이제는 접수하지 않고 문의로 돌린다.
   */
  it('중단 전 무통장 건의 고객 셀프 취소는 접수하지 않고 문의로 돌린다', async () => {
    const c = await insertLegacyBankPledge('FND-LEGACY-3');
    await markPaidWithToss(c.orderNo);
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(r.ok === false && r.message).toContain('문의');
    const pledge = (await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge;
    expect(pledge?.refundRequestedAt).toBeNull();
    expect(sendFundingCancelledEmails).not.toHaveBeenCalled();
  });

  it('마감 후 셀프 취소는 거부, 관리자는 허용', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    const after = new Date('2026-11-05T00:00:00Z');
    expect((await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: after })).ok).toBe(false);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [] } });
    expect((await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: after })).ok).toBe(true);
  });
});

describe('읽고-쓰기 경합 — 가드를 UPDATE의 WHERE로 옮긴다', () => {
  const staleRead = (mutate: string, args: unknown[]) => {
    const actual = jest.requireActual('./service').findFundingOrderByOrderNo;
    (findFundingOrderByOrderNo as jest.Mock).mockImplementationOnce(async (orderNo: string) => {
      const order = await actual(orderNo);
      // 우리가 읽은 **뒤** 경쟁 요청이 먼저 기록한다 — 스냅샷은 그대로 낡은 값을 들고 있다.
      await client.execute({ sql: mutate, args: args as never[] });
      return order;
    });
  };

  it('토스 셀프 취소: 읽은 뒤 발송 준비가 시작되면 토스를 부르지 않고 거부한다', async () => {
    // 예전엔 assessSelfCancel이 읽기 시점만 봐서, 환불과 발송이 둘 다 성립할 수 있었다.
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    const o = await findFundingOrderByOrderNo(c.orderNo);

    staleRead("UPDATE funding_pledges SET fulfillment_status = 'shipped' WHERE order_id = ?", [o!.id]);
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });

    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid'); // 선점도 없었다
  });

  /**
   * manage 화면은 내려받기 버튼과 취소 버튼을 나란히 띄운다. 두 요청의 순서만 맞으면
   * 파일을 받고도 전액 환불이 성립했다 — 읽기 시점 판정은 통과하고, 선점 WHERE에는
   * fulfillment_status만 실려 있었다.
   */
  it('토스 셀프 취소: 읽은 뒤 내려받기가 기록되면 토스를 부르지 않고 거부한다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    const o = await findFundingOrderByOrderNo(c.orderNo);

    staleRead('UPDATE funding_pledges SET downloaded_at = unixepoch() WHERE order_id = ?', [o!.id]);
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });

    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid'); // 선점도 없었다
  });

  it('관리자 취소는 발송 준비 중에도 그대로 환불한다 — 가드는 셀프 취소에만 건다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    await client.execute("UPDATE funding_pledges SET fulfillment_status = 'shipped'");
    (cancelPayment as jest.Mock).mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [{ transactionKey: 'tx', cancelAmount: 5000 }] },
    });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'refunded', refundAmount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });
});


/**
 * 수기 등록에서 이메일 칸을 비우면 customer_email에 플레이스홀더(manual@studionol.co.kr)가
 * 들어간다. 우리 도메인이라 resend.ts의 배달불가 판정(RFC 2606 예약 도메인)에 안 걸려
 * 실제로 발송되고, 그 메일은 우리 수신함으로 되돌아오거나 반송된다. 반송이 쌓이면 발신
 * 도메인 평판이 깎여 진짜 고객 메일이 스팸함으로 간다. 메일 재발송 쪽에는 가드가 있었는데
 * 환불 경로에는 없어서, 관리자 환불 한 번이 그대로 반송을 만들었다.
 */
it('플레이스홀더 주소의 수기 펀딩도 환불 안내를 발송 계층에 넘긴다 — 운영자 사본이 필요하다', async () => {
  const { id, orderNo } = await insertLegacyBankPledge('FND-M-PLACEHOLDER');
  await client.execute({ sql: "UPDATE orders SET customer_email='manual@studionol.co.kr' WHERE id=?", args: [id] });

  const r = await cancelFundingPledge({ orderNo, requestedBy: 'admin', reason: '관리자 환불', now: NOW });
  expect(r).toMatchObject({ ok: true, mode: 'recorded' });
  // 배달 불가 주소를 떨어뜨리는 것은 **고객 항목 하나**이고, 그 판정은 발송 계층이 한다
  // (lib/funding/email.test.ts의 '플레이스홀더 주소' 블록). 여기서 통째로 건너뛰면 수기 건
  // 계좌 송금의 시작점인 운영자 사본까지 사라진다.
  expect(sendFundingCancelledEmails).toHaveBeenCalled();

  const row = await client.execute({ sql: 'SELECT status, notification_error FROM orders WHERE id=?', args: [id] });
  expect(row.rows[0].status).toBe('refunded');
  expect(row.rows[0].notification_error).toBeNull();
});

/**
 * 가상계좌 취소 거절 문구는 **보는 사람에 따라 달라야 한다.**
 *
 * 이 message는 후원자 셀프 취소 응답(409) 본문에 그대로 실린다. 운영자용 한 벌만 두면
 * 후원자가 관리 링크에서 취소를 눌렀을 때 "토스 콘솔에서 …" 같은 내부 운영 지시를 보게 된다.
 * DONE 가상계좌는 의도적으로 통과시키므로(lib/booking/toss.ts) 실제로 도달 가능한 경로다.
 *
 * cancelPayment 자체가 토스를 부르지 않는다는 것은 lib/booking/toss.test.ts가 본다.
 * 여기서 보는 것은 **그 결과를 누구에게 어떻게 전하는가**(cancel.ts의 분기)다.
 */
describe('가상계좌 취소 거절 문구', () => {
  const toss = jest.requireActual('../booking/toss');

  const seedVirtualAccountPledge = async (orderNo: string) => {
    const created = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    const id = created.ok ? (await findFundingOrderByOrderNo(created.orderNo))!.id : '';
    await client.execute({ sql: "UPDATE orders SET status='paid', order_no=? WHERE id=?", args: [orderNo, id] });
    await client.execute({
      sql: "INSERT INTO payments (id, order_id, payment_key, method) VALUES ('pva',?, 'pk_va', '가상계좌')",
      args: [id],
    });
    // 실제 구현을 그대로 쓴다 — 가상계좌 가드에 걸려 네트워크로 나가지 않는다.
    (cancelPayment as jest.Mock).mockImplementation(toss.cancelPayment);
    return orderNo;
  };

  it('서포터 셀프 취소에는 운영 지시가 아니라 연락 안내가 나간다', async () => {
    const orderNo = await seedVirtualAccountPledge('FND-20261015-VA000001');
    const r = await cancelFundingPledge({ orderNo, requestedBy: 'customer', reason: '고객 취소', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    const message = r.ok === false ? r.message : '';
    expect(message).not.toContain('토스 콘솔');
    expect(message).toBe(toss.VIRTUAL_ACCOUNT_CANCEL_CUSTOMER_MESSAGE);
  });

  it('관리자 환불에는 운영 지시가 나간다', async () => {
    const orderNo = await seedVirtualAccountPledge('FND-20261015-VA000002');
    const r = await cancelFundingPledge({ orderNo, requestedBy: 'admin', reason: '관리자 환불', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    expect(r.ok === false && r.message).toBe(toss.VIRTUAL_ACCOUNT_CANCEL_ADMIN_MESSAGE);
  });
});
