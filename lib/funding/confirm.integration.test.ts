/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/toss', () => ({ confirmPayment: jest.fn(), fetchPayment: jest.fn() }));
jest.mock('./email', () => ({ sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null) }));

// eslint-disable-next-line import/first
import { confirmFundingPledge, syncFundingCancelledFromToss } from './confirm';
// eslint-disable-next-line import/first
import { confirmPayment, fetchPayment } from '../booking/toss';
// eslint-disable-next-line import/first
import { createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const mockConfirm = confirmPayment as jest.Mock;
const mockFetch = fetchPayment as jest.Mock;

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

  it('이미 paid면 토스를 부르지 않고 성공(멱등)', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    mockConfirm.mockClear();
    const again = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(again.ok).toBe(true);
    expect(mockConfirm).not.toHaveBeenCalled();
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

  it('웹훅 경로여도 failed·refunded 주문은 거부한다', async () => {
    const c = await createFundingPledge(payloadFor({ customerEmail: 'f@example.com', customerPhone: '010-6' }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    for (const status of ['failed', 'refunded', 'partially_refunded']) {
      await client.execute({ sql: 'UPDATE orders SET status = ? WHERE order_no = ?', args: [status, c.orderNo] });
      expect(await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 }, { trustedByWebhook: true }))
        .toMatchObject({ ok: false, code: 'invalid_state' });
    }
    expect(mockConfirm).not.toHaveBeenCalled();
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

  it('토스 일반 거부는 orders.status를 failed로 남긴다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce({ ok: false, code: 'REJECT_CARD_COMPANY', message: '카드사 거절' });
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('failed');
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
