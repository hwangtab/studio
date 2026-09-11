/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/toss', () => ({ confirmPayment: jest.fn(), fetchPayment: jest.fn() }));
jest.mock('./email', () => ({
  sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendFundingCancelledEmails: jest.fn().mockResolvedValue(null),
}));

// eslint-disable-next-line import/first
import { confirmFundingPledge, syncFundingCancelledFromToss } from './confirm';
// eslint-disable-next-line import/first
import { confirmPayment, fetchPayment } from '../booking/toss';
// eslint-disable-next-line import/first
import { sendFundingCancelledEmails, sendFundingConfirmedEmails } from './email';
// eslint-disable-next-line import/first
import { createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { confirmBankDeposit } from './bank-transfer';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const mockConfirm = confirmPayment as jest.Mock;
const mockFetch = fetchPayment as jest.Mock;
const mockEmail = sendFundingConfirmedEmails as jest.Mock;
const mockCancelEmail = sendFundingCancelledEmails as jest.Mock;

// service.integration.test.ts의 PROJECT·payloadFor를 그대로 재사용하는 것이 아니라 값만
// 복제한다 — 테스트 파일을 모듈로 import하면 그 파일의 jest.mock('../../db/client', ...)가
// 이 파일의 mockDb 클로저를 덮어써 서로 다른 in-memory DB를 보게 된다(실제 확인됨).
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

const approved = (orderNo: string, amount: number) => ({
  ok: true,
  payment: { paymentKey: 'pk_1', orderId: orderNo, status: 'DONE', totalAmount: amount, method: '카드', approvedAt: '2026-10-15T03:01:00Z' },
});

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

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
  mockEmail.mockResolvedValue(null);
  mockCancelEmail.mockResolvedValue(null);
  // confirm.ts의 홀드 만료 판정은 Date.now()(실제 벽시계)와 비교한다 — NOW 픽스처가 실행 시점의
  // 실제 시각보다 미래라 고정하지 않으면 "홀드 만료" 케이스가 항상 만료되지 않은 것으로 읽힌다.
  jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(() => client.close());

describe('confirmFundingPledge', () => {
  it('금액이 맞으면 승인하고 paid·payments·paidAt을 기록한다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(r).toMatchObject({ ok: true, orderNo: c.orderNo, projectSlug: 'demo' });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.payments[0].paymentKey).toBe('pk_1');
    expect(o?.fundingPledge?.paidAt).toBeInstanceOf(Date);
  });

  it('이미 paid여도 그 주문의 실제 paymentKey면 토스를 부르지 않고 성공(멱등) — 토큰도 돌려준다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    mockConfirm.mockClear();
    const again = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(again).toMatchObject({ ok: true, orderNo: c.orderNo, manageToken: c.manageToken });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  describe('확정된 후원의 관리 토큰은 소유 증명 없이 나오지 않는다', () => {
    /** 주문번호는 비밀이 아니다 — 확정 메일·화면·토스 영수증·fail URL에 평문으로 실린다. */
    const paidPledge = async (email: string) => {
      const c = await createFundingPledge(payloadFor({ customerEmail: email, customerPhone: '010-3' }), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      mockConfirm.mockClear();
      return c;
    };

    it('틀린 paymentKey로 조회하면 토큰 없는 invalid_state', async () => {
      const c = await paidPledge('probe@example.com');
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_아무거나', amount: 5000 });
      expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
      expect(JSON.stringify(r)).not.toContain(c.manageToken);
      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it('금액만 1원으로 바꿔 찔러도 토큰이 나오지 않는다 (실제 공격 URL 형태)', async () => {
      const c = await paidPledge('probe2@example.com');
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'x', amount: 1 });
      expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
      expect(JSON.stringify(r)).not.toContain(c.manageToken);
    });

    it('웹훅 경로는 소유 증명 없이도 그대로 통과한다 — fetchPayment로 이미 재검증하고 온다', async () => {
      const c = await paidPledge('hook@example.com');
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true });
      expect(r).toMatchObject({ ok: true, manageToken: c.manageToken });
      expect(mockConfirm).not.toHaveBeenCalled();
    });
  });

  describe('무통장 후원은 토스 confirm 경로를 타지 않는다 (A-2)', () => {
    const bankPledge = async (email: string) => {
      const c = await createFundingPledge(
        payloadFor({ paymentMethod: 'bank_transfer', customerEmail: email, customerPhone: '010-4' }),
        PROJECT, reward('mail'), NOW,
      );
      if (!c.ok) throw new Error();
      return c;
    };

    it('제3자의 잘못된 confirm 시도가 무통장 pending 주문을 failed로 만들지 않는다', async () => {
      const c = await bankPledge('bank@example.com');
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_위조', amount: 5000 });
      expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
      expect(JSON.stringify(r)).not.toContain(c.manageToken);
      // 토스를 부르지도 않고, 주문 상태도 그대로다.
      expect(mockConfirm).not.toHaveBeenCalled();
      expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('pending');
    });

    it('방해 시도 뒤에도 관리자 입금 확인이 정상 동작한다', async () => {
      const c = await bankPledge('bank2@example.com');
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_위조', amount: 5000 });
      const o = await findFundingOrderByOrderNo(c.orderNo);
      const deposit = await confirmBankDeposit({ orderId: o!.id, now: NOW });
      expect(deposit).toEqual({ ok: true });
      expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
    });
  });

  it('결제 미존재 계열 거절은 토스 주문을 failed로 낙인하지 않는다', async () => {
    // NOT_FOUND_PAYMENT는 "이 주문의 결제가 거절됐다"가 아니라 "그런 결제가 없다"이다.
    // failed로 찍으면 제3자가 주문번호만으로 남의 후원의 복구 경로를 닫을 수 있다.
    for (const code of ['NOT_FOUND_PAYMENT', 'NOT_FOUND_PAYMENT_SESSION']) {
      const c = await createFundingPledge(
        payloadFor({ customerEmail: `${code}@example.com`, customerPhone: '010-2' }), PROJECT, reward('mail'), NOW,
      );
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce({ ok: false, code, message: '존재하지 않는 결제 정보 입니다.' });
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_없음', amount: 5000 });
      expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
      expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('pending');
    }
  });

  it('승인 응답이 DONE이 아니면(가상계좌 입금 대기) 확정하지 않는다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk_va', orderId: c.orderNo, status: 'WAITING_FOR_DEPOSIT', totalAmount: 5000 },
    });
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_va', amount: 5000 });
    expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    // pending으로 남아야 실제 입금 뒤 오는 DONE 웹훅이 정상 경로로 확정할 수 있다.
    expect(o?.status).toBe('pending');
    expect(o?.payments).toHaveLength(0);
  });

  describe('확정 메일 미발송 센티널 (H)', () => {
    it('발송에 성공하면 센티널이 지워진다', async () => {
      const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBeNull();
    });

    it('메일 단계에서 프로세스가 죽어 센티널이 남으면 웹훅 재시도가 확정 메일을 다시 보낸다', async () => {
      const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      // batch는 커밋됐지만 메일 단계 전에 죽은 상태를 재현한다.
      await client.execute({ sql: `UPDATE orders SET notification_error = 'send_pending' WHERE order_no = ?`, args: [c.orderNo] });
      mockEmail.mockClear();

      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true });
      expect(r).toMatchObject({ ok: true, emailSent: true });
      expect(mockEmail).toHaveBeenCalledTimes(1);
      expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBeNull();
    });

    it('SSR 확정 중 그 승인이 유발한 웹훅이 도착해도 확정 메일은 1통 (후속 리뷰 Important 1)', async () => {
      // SSR이 batch를 커밋해 센티널을 심고 메일(0.3~1.5초)을 보내는 동안, 같은 승인이 유발한
      // 토스 DONE 웹훅이 1~3초 안에 도착한다. 선점이 없으면 그 웹훅이 status='paid' + 센티널을
      // 보고 확정 메일을 한 통 더 보낸다.
      const c = await createFundingPledge(
        payloadFor({ customerEmail: 'dup@example.com', customerPhone: '010-1' }), PROJECT, reward('mail'), NOW,
      );
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      let webhookOutcome: unknown;
      mockEmail.mockImplementationOnce(async () => {
        webhookOutcome = await confirmFundingPledge(
          { orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 },
          { trustedByWebhook: true },
        );
        return null;
      });

      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      expect(r).toMatchObject({ ok: true, emailSent: true });
      expect(webhookOutcome).toMatchObject({ ok: true });
      expect(mockEmail).toHaveBeenCalledTimes(1); // 정확히 1통
      expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBeNull();
    });

    it('센티널이 없으면 웹훅 재도착은 메일을 다시 보내지 않는다', async () => {
      const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      mockEmail.mockClear();
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true });
      expect(mockEmail).not.toHaveBeenCalled();
    });

    it('발송 중에는 센티널이 비어 있지 않다 (send_inflight) — 그 구간에서 죽어도 healthCheck가 잡는다', async () => {
      // 선점 값이 NULL이면 발송 구간(0.3~1.5초)에서 죽었을 때 주문은 paid인데 확정 메일 0통,
      // notificationError도 null이라 어떤 점검에도 안 걸린다(무증상 사고).
      const c = await createFundingPledge(
        payloadFor({ customerEmail: 'inflight@example.com', customerPhone: '010-0' }), PROJECT, reward('mail'), NOW,
      );
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      let seen: string | null = 'unread';
      mockEmail.mockImplementationOnce(async () => {
        const rows = await client.execute({ sql: 'SELECT notification_error AS e FROM orders WHERE order_no = ?', args: [c.orderNo] });
        seen = (rows.rows[0].e as string | null) ?? null;
        return null;
      });
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      expect(seen).toBe('send_inflight');
      expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBeNull();
    });

    it('선점은 원자적이다 — 두 복구가 동시에 들어와도 확정 메일은 1통', async () => {
      const c = await createFundingPledge(
        payloadFor({ customerEmail: 'cas@example.com', customerPhone: '010-00' }), PROJECT, reward('mail'), NOW,
      );
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      await client.execute({ sql: `UPDATE orders SET notification_error = 'send_pending' WHERE order_no = ?`, args: [c.orderNo] });
      mockEmail.mockClear();

      const results = await Promise.all([
        confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true }),
        confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true }),
      ]);
      expect(mockEmail).toHaveBeenCalledTimes(1);
      const sent = results.map((r) => (r.ok ? r.emailSent : 'failed'));
      expect(sent.filter((v) => v === true)).toHaveLength(1);
      expect(sent.filter((v) => v === undefined)).toHaveLength(1);
      expect((await findFundingOrderByOrderNo(c.orderNo))?.notificationError).toBeNull();
    });

    it('메일 함수가 예외를 던져도 confirm은 성공으로 끝나고 사유가 기록된다', async () => {
      const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
      mockEmail.mockRejectedValueOnce(new Error('SMTP 폭발'));
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      expect(r).toMatchObject({ ok: true, emailSent: false });
      const o = await findFundingOrderByOrderNo(c.orderNo);
      expect(o?.status).toBe('paid');
      expect(o?.notificationError).toContain('SMTP 폭발');
    });
  });

  it('금액 불일치·홀드 만료는 토스를 부르지 않고 거부', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    expect((await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk', amount: 4999 })).ok).toBe(false);
    const stale = await createFundingPledge(
      payloadFor({ customerEmail: 's@example.com', customerPhone: '010-0' }),
      PROJECT,
      reward('mail'),
      new Date(NOW.getTime() - 2000 * 1000),
    );
    if (!stale.ok) throw new Error();
    const r = await confirmFundingPledge({ orderNo: stale.orderNo, paymentKey: 'pk', amount: 5000 });
    expect(r).toMatchObject({ ok: false, code: 'hold_expired' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('승인 왕복 중 expired로 바뀌어도 paid로 되돌리고 결제를 기록한다', async () => {
    // 실제 경합: 토스 승인이 오가는 동안 expireStalePledges나 다른 요청의 자기 홀드 해제가
    // 이 주문을 expired로 바꾼다. UPDATE가 'pending'만 대상이면 0행인데도 성공을 반환해
    // 돈만 받고 pending도 paid도 아닌 주문이 남았다.
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockImplementationOnce(async () => {
      await client.execute({ sql: `UPDATE orders SET status = 'expired' WHERE order_no = ?`, args: [c.orderNo] });
      return approved(c.orderNo, 5000);
    });
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(r.ok).toBe(true);
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.payments[0].paymentKey).toBe('pk_1');
  });

  it('expireStalePledges로 expired가 된 뒤 온 DONE 웹훅도 확정한다 — SSR 경로는 여전히 거부', async () => {
    // 실제 사고 형태: 홀드가 지나 expireStalePledges가 먼저 돌고, 그 뒤 토스 DONE 웹훅이 온다.
    const stale = await createFundingPledge(
      payloadFor({ customerEmail: 'w@example.com', customerPhone: '010-9' }),
      PROJECT, reward('mail'), new Date(NOW.getTime() - 2000 * 1000),
    );
    if (!stale.ok) throw new Error();
    await expireStalePledges(NOW);
    expect((await findFundingOrderByOrderNo(stale.orderNo))?.status).toBe('expired');

    // SSR 경로: expired는 그대로 거부한다.
    expect(await confirmFundingPledge({ orderNo: stale.orderNo, paymentKey: 'pk_1', amount: 5000 }))
      .toMatchObject({ ok: false, code: 'invalid_state' });
    expect(mockConfirm).not.toHaveBeenCalled();

    mockConfirm.mockResolvedValueOnce(approved(stale.orderNo, 5000));
    const r = await confirmFundingPledge({ orderNo: stale.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true });
    expect(r.ok).toBe(true);
    const o = await findFundingOrderByOrderNo(stale.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.payments[0].paymentKey).toBe('pk_1');
    // 만료 뒤 승인은 재고를 넘겼을 수 있다 — 운영자가 관리자 화면에서 볼 수 있게 흔적을 남긴다.
    expect(o?.fundingPledge?.adminMemo).toContain('[웹훅] 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요');
  });

  it('토스 왕복 중 expired가 된 건도 웹훅 되살림 흔적을 남긴다 — 진입 스냅샷이 아니라 전이 직전 상태 기준', async () => {
    // 실제 사고 형태: 진입 시점엔 pending이라 예전 판정(order.status === 'expired')으로는
    // 흔적이 안 남았다. 토스 승인 왕복(수 초) 동안 expireStalePledges가 돌아 expired가 되고,
    // batch의 UPDATE는 'expired'까지 받으므로 재고를 초과한 채 확정된다 — 그런데 관리자
    // 화면엔 아무 흔적도 없었다.
    const c = await createFundingPledge(
      payloadFor({ customerEmail: 'race@example.com', customerPhone: '010-3' }), PROJECT, reward('mail'), NOW,
    );
    if (!c.ok) throw new Error();
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('pending'); // 진입 스냅샷은 pending
    mockConfirm.mockImplementationOnce(async () => {
      await client.execute({ sql: `UPDATE orders SET status = 'expired' WHERE order_no = ?`, args: [c.orderNo] });
      return approved(c.orderNo, 5000);
    });
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true });
    expect(r.ok).toBe(true);
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.fundingPledge?.adminMemo).toContain('[웹훅] 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요');
  });

  it('SSR 지연 승인으로 되살린 건도 흔적을 남긴다 — 경로가 라벨로 구분된다', async () => {
    const c = await createFundingPledge(
      payloadFor({ customerEmail: 'ssr@example.com', customerPhone: '010-4' }), PROJECT, reward('mail'), NOW,
    );
    if (!c.ok) throw new Error();
    mockConfirm.mockImplementationOnce(async () => {
      await client.execute({ sql: `UPDATE orders SET status = 'expired' WHERE order_no = ?`, args: [c.orderNo] });
      return approved(c.orderNo, 5000);
    });
    expect((await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 })).ok).toBe(true);
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.adminMemo)
      .toContain('[지연승인] 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요');
  });

  it('정상 pending 확정에는 흔적을 남기지 않는다', async () => {
    const c = await createFundingPledge(
      payloadFor({ customerEmail: 'clean@example.com', customerPhone: '010-2' }), PROJECT, reward('mail'), NOW,
    );
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.adminMemo).toBeNull();
  });

  it('웹훅 경로여도 refunded 주문은 거부한다 — 이미 결론이 난 주문', async () => {
    const c = await createFundingPledge(payloadFor({ customerEmail: 'f@example.com', customerPhone: '010-6' }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    for (const status of ['refunded', 'partially_refunded']) {
      await client.execute({ sql: 'UPDATE orders SET status = ? WHERE order_no = ?', args: [status, c.orderNo] });
      expect(await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true }))
        .toMatchObject({ ok: false, code: 'invalid_state' });
    }
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('네트워크 오류는 failed로 확정하지 않고 pending으로 남긴다', async () => {
    // NETWORK_ERROR·CONFIG_ERROR는 "토스가 거절했다"가 아니라 "물어보지도 못했다"이다.
    // 여기서 failed를 찍으면 실제로는 승인된 결제를 뒤늦게 복구하러 오는 웹훅이 막힌다.
    for (const code of ['NETWORK_ERROR', 'CONFIG_ERROR']) {
      const c = await createFundingPledge(payloadFor({ customerEmail: `${code}@example.com`, customerPhone: '010-7' }), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce({ ok: false, code, message: '내부 사정' });
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_net', amount: 5000 });
      expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
      // 내부 오류의 원문은 고객에게 보이지 않는다.
      expect((r as { message: string }).message).not.toContain('내부 사정');
      expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('pending');
    }
  });

  it('네트워크 오류로 failed가 된 옛 주문도 웹훅이 paid로 복구한다 — SSR 경로는 거부', async () => {
    const c = await createFundingPledge(payloadFor({ customerEmail: 'x@example.com', customerPhone: '010-8' }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await client.execute({ sql: `UPDATE orders SET status = 'failed' WHERE order_no = ?`, args: [c.orderNo] });

    // SSR 경로는 그대로 거부한다(토스를 부르지도 않는다).
    expect(await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }))
      .toMatchObject({ ok: false, code: 'invalid_state' });
    expect(mockConfirm).not.toHaveBeenCalled();

    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    expect((await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true })).ok).toBe(true);
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.payments[0].paymentKey).toBe('pk_1');
    expect(o?.fundingPledge?.adminMemo).toContain('failed 처리 후 승인 확인');
  });

  it('웹훅 경로의 invalid_state·amount_mismatch는 대사 단서를 로그로 남긴다', async () => {
    const c = await createFundingPledge(payloadFor({ customerEmail: 'log@example.com', customerPhone: '010-5' }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await client.execute({ sql: `UPDATE orders SET status = 'refunded' WHERE order_no = ?`, args: [c.orderNo] });
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true });
    expect(spy.mock.calls.some(([m]) => String(m).includes('확정 불가 상태'))).toBe(true);

    await client.execute({ sql: `UPDATE orders SET status = 'pending' WHERE order_no = ?`, args: [c.orderNo] });
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 4999 }, { trustedByWebhook: true });
    expect(spy.mock.calls.some(([m]) => String(m).includes('금액 불일치'))).toBe(true);
  });

  it('예약 주문번호로 오면 not_found', async () => {
    // findFundingOrderByOrderNo는 type='funding'이 아닌 행을 걸러내므로, 정말로 존재하는
    // type='session' 주문에 대해서도 not_found가 나와야 한다(주문이 아예 없는 경우와 구분).
    await mockDb.insert(schema.orders).values({
      orderNo: 'SNB-20260101-ABCDEF12',
      type: 'session',
      customerName: '김예약',
      customerPhone: '010-2222-3333',
      customerEmail: 'b@example.com',
      itemAmount: 1,
      vatAmount: 0,
      totalAmount: 1,
      manageToken: 'session-token',
    });
    const r = await confirmFundingPledge({ orderNo: 'SNB-20260101-ABCDEF12', paymentKey: 'pk', amount: 1 });
    expect(r).toMatchObject({ ok: false, code: 'not_found' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('ALREADY_PROCESSED_PAYMENT 재조회 성공 — paid로 기록한다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce({ ok: false, code: 'ALREADY_PROCESSED_PAYMENT', message: '이미 처리된 결제' });
    mockFetch.mockResolvedValueOnce(approved(c.orderNo, 5000));
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(r).toMatchObject({ ok: true, orderNo: c.orderNo });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.payments[0].paymentKey).toBe('pk_1');
  });

  it('ALREADY_PROCESSED_PAYMENT 재조회 결과가 불일치하면 toss_rejected, 주문은 pending 유지', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce({ ok: false, code: 'ALREADY_PROCESSED_PAYMENT', message: '이미 처리된 결제' });
    // 재조회 결과의 금액이 주문과 다르다 — 검증 실패로 취급한다.
    mockFetch.mockResolvedValueOnce(approved(c.orderNo, 9999));
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('pending');
  });

  it('거절 계열(allowlist) 코드만 orders.status를 failed로 남긴다', async () => {
    for (const code of [
      'REJECT_CARD_COMPANY', 'INVALID_CARD_EXPIRATION', 'EXCEED_MAX_DAILY_PAYMENT_COUNT', 'NOT_ENOUGH_BALANCE',
      // 접두사 계열에서 빠져 있던 두 가지 — INVALID_로 시작하지만 카드 거절이고,
      // INVALID_ACCOUNT_INFO는 뒤에 접미어가 붙는 변형이 있다.
      'INVALID_REJECT_CARD', 'INVALID_ACCOUNT_INFO_RESEND',
    ]) {
      const c = await createFundingPledge(payloadFor({ customerEmail: `${code}@example.com` }), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce({ ok: false, code, message: '카드사 거절' });
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      expect(r).toMatchObject({ ok: false, code: 'toss_rejected', message: '카드사 거절' });
      expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('failed');
    }
  });

  it('거절 계열 밖 코드는 주문을 건드리지 않는다 — 제3자가 남의 후원을 failed로 만들 수 없다', async () => {
    // 예전 denylist(NOT_FOUND_PAYMENT 계열만 제외)에서는 이 코드들이 전부 낙인으로 이어졌다.
    for (const code of ['INVALID_REQUEST', 'UNAUTHORIZED_KEY', 'FORBIDDEN_REQUEST', 'PROVIDER_ERROR']) {
      const c = await createFundingPledge(payloadFor({ customerEmail: `${code}@example.com` }), PROJECT, reward('mail'), NOW);
      if (!c.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce({ ok: false, code, message: '내부 사정' });
      const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
      expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
      expect((r as { message: string }).message).not.toContain('내부 사정'); // 원문 노출 금지
      expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('pending');
    }
  });
});

describe('syncFundingCancelledFromToss', () => {
  /** paid 상태의 펀딩 주문을 만들어 orderNo·paymentId를 돌려준다. */
  const paidOrder = async (): Promise<{ orderNo: string; paymentId: string }> => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    return { orderNo: c.orderNo, paymentId: o!.payments[0].id };
  };

  const cancelPayload = (orderNo: string, cancelAmount: number, transactionKey = 'ck_1') => ({
    paymentKey: 'pk_1', orderId: orderNo, status: 'CANCELED', totalAmount: 5000,
    cancels: [{ transactionKey, cancelAmount }],
  });

  it('전체 취소 — paid에서 refunded로, refunds 1행에 totalAmount', async () => {
    const { orderNo, paymentId } = await paidOrder();
    await syncFundingCancelledFromToss(cancelPayload(orderNo, 5000));
    const o = await findFundingOrderByOrderNo(orderNo);
    expect(o?.status).toBe('refunded');
    const refunds = await mockDb.query.refunds.findMany({ where: (t, { eq: e }) => e(t.paymentId, paymentId) });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amount: 5000, status: 'done' });
  });

  it('부분 취소 — paid에서 partially_refunded로, refunds 1행에 부분 금액', async () => {
    const { orderNo, paymentId } = await paidOrder();
    await syncFundingCancelledFromToss(cancelPayload(orderNo, 2000));
    const o = await findFundingOrderByOrderNo(orderNo);
    expect(o?.status).toBe('partially_refunded');
    const refunds = await mockDb.query.refunds.findMany({ where: (t, { eq: e }) => e(t.paymentId, paymentId) });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amount: 2000, status: 'done' });
  });

  it('부분 취소 뒤 전체 취소 — 두 번째 이벤트가 델타만 추가하고 refunded로 전이한다', async () => {
    const { orderNo, paymentId } = await paidOrder();
    await syncFundingCancelledFromToss(cancelPayload(orderNo, 2000, 'ck_1'));
    await syncFundingCancelledFromToss(cancelPayload(orderNo, 5000, 'ck_2'));
    const o = await findFundingOrderByOrderNo(orderNo);
    expect(o?.status).toBe('refunded');
    const refunds = await mockDb.query.refunds.findMany({ where: (t, { eq: e }) => e(t.paymentId, paymentId) });
    expect(refunds).toHaveLength(2);
    expect(refunds.reduce((sum, r) => sum + r.amount, 0)).toBe(5000);
    expect(refunds.find((r) => r.amount === 3000)).toBeDefined(); // 델타(5000-2000)
  });

  it('같은 CANCELED 이벤트가 두 번 도착해도 refunds 행은 1개로 유지된다', async () => {
    const { orderNo, paymentId } = await paidOrder();
    await syncFundingCancelledFromToss(cancelPayload(orderNo, 5000));
    await syncFundingCancelledFromToss(cancelPayload(orderNo, 5000));
    const o = await findFundingOrderByOrderNo(orderNo);
    expect(o?.status).toBe('refunded');
    const refunds = await mockDb.query.refunds.findMany({ where: (t, { eq: e }) => e(t.paymentId, paymentId) });
    expect(refunds).toHaveLength(1);
  });

  it('재조회 응답에 cancels가 없으면 아무것도 기록하지 않는다', async () => {
    const { orderNo, paymentId } = await paidOrder();
    await syncFundingCancelledFromToss({ paymentKey: 'pk_1', orderId: orderNo, status: 'CANCELED', totalAmount: 5000 });
    const o = await findFundingOrderByOrderNo(orderNo);
    expect(o?.status).toBe('paid'); // 상태 그대로
    const refunds = await mockDb.query.refunds.findMany({ where: (t, { eq: e }) => e(t.paymentId, paymentId) });
    expect(refunds).toHaveLength(0);
  });
});
