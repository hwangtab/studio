/** @jest-environment node */

/**
 * 토스 웹훅을 **실제 테이블**(in-memory libSQL + 실제 마이그레이션)에 대고 돌린다.
 *
 * 여기서 잡는 결함들은 전부 "문장 하나가 아니라 문장 여러 개의 맞물림"이라 모킹으로는
 * 보이지 않는다 — 멱등 키가 이벤트를 삼켜서 대사 함수가 **호출조차 되지 않는** 경우,
 * batch WHERE가 0행이라 자동 취소로 빠지는 경우, 센티널이 남아 메일만 다시 나가는 경우.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./toss', () => ({ confirmPayment: jest.fn(), fetchPayment: jest.fn(), cancelPayment: jest.fn() }));
jest.mock('./gcal', () => ({ createBookingEvent: jest.fn().mockResolvedValue('evt1') }));
jest.mock('./email', () => ({
  sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderConfirmedEmails: jest.fn().mockResolvedValue(null),
}));
jest.mock('../funding/email', () => ({
  sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendFundingCancelledEmails: jest.fn().mockResolvedValue(null),
}));

// eslint-disable-next-line import/first
import { processTossWebhook } from './webhook';
// eslint-disable-next-line import/first
import { confirmBookingPayment } from './confirm';
// eslint-disable-next-line import/first
import { createBookingEvent } from './gcal';
// eslint-disable-next-line import/first
import { cancelPayment, confirmPayment, fetchPayment } from './toss';
// eslint-disable-next-line import/first
import { sendBookingConfirmedEmails, sendMixingOrderConfirmedEmails } from './email';
// eslint-disable-next-line import/first
import { sendFundingCancelledEmails } from '../funding/email';
// eslint-disable-next-line import/first
import { createBookingOrder, createMixingOrder, findOrderByOrderNo, PENDING_HOLD_SECONDS } from './service';
// eslint-disable-next-line import/first
import { confirmFundingPledge } from '../funding/confirm';
// eslint-disable-next-line import/first
import { createFundingPledge, findFundingOrderByOrderNo } from '../funding/service';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../funding/projects';
// eslint-disable-next-line import/first
import type { CreateBookingPayload } from './validation';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from '../funding/validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

const mockFetch = fetchPayment as jest.Mock;
const mockConfirm = confirmPayment as jest.Mock;
const mockCancel = cancelPayment as jest.Mock;
const mockCancelMail = sendFundingCancelledEmails as jest.Mock;

const PROJECT = parseFundingProject(
  `---
slug: demo
title: 데모
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`,
  'demo',
);

const pledgePayload = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

const bookingPayload = (over: Partial<CreateBookingPayload> = {}): CreateBookingPayload => ({
  productId: 'recording-pro', hours: 3, date: '2026-11-10', startHour: 14,
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'singer@example.com',
  refundPolicyAgreed: true, ...over,
});

/** paid 상태의 토스 펀딩 주문 하나. */
const paidPledge = async (): Promise<{ orderNo: string }> => {
  const c = await createFundingPledge(pledgePayload(), PROJECT, PROJECT.rewards[0], NOW);
  if (!c.ok) throw new Error('pledge 생성 실패');
  mockConfirm.mockResolvedValueOnce({
    ok: true,
    payment: { paymentKey: 'pk_f', orderId: c.orderNo, status: 'DONE', totalAmount: 5000, method: '카드' },
  });
  const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_f', amount: 5000 });
  if (!r.ok) throw new Error('pledge 확정 실패');
  return { orderNo: c.orderNo };
};

/** 결제창을 방치한 상태 — 주문·예약 생성 시각을 뒤로 민다. */
const backdate = async (orderNo: string, seconds: number): Promise<void> => {
  await client.execute({
    sql: `UPDATE bookings SET created_at = created_at - ? WHERE order_id IN (SELECT id FROM orders WHERE order_no = ?)`,
    args: [seconds, orderNo],
  });
  await client.execute({ sql: 'UPDATE orders SET created_at = created_at - ? WHERE order_no = ?', args: [seconds, orderNo] });
};

const refundRows = async (orderNo: string) => {
  const rows = await client.execute({
    sql: `SELECT r.amount AS amount, r.status AS status FROM refunds r
          JOIN payments p ON p.id = r.payment_id
          JOIN orders o ON o.id = p.order_id WHERE o.order_no = ?`,
    args: [orderNo],
  });
  return rows.rows as unknown as { amount: number; status: string }[];
};

const eventKeys = async (): Promise<string[]> => {
  const rows = await client.execute('SELECT event_key FROM webhook_events ORDER BY rowid');
  return rows.rows.map((r) => String(r.event_key));
};

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (statement.trim()) await client.execute(statement.trim());
    }
  }
});

beforeEach(async () => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  for (const table of ['webhook_events', 'refunds', 'funding_pledges', 'work_orders', 'bookings', 'payments', 'orders']) {
    await client.execute(`DELETE FROM ${table}`);
  }
  jest.clearAllMocks();
  mockCancelMail.mockResolvedValue(null);
  (sendBookingConfirmedEmails as jest.Mock).mockResolvedValue(null);
  (sendMixingOrderConfirmedEmails as jest.Mock).mockResolvedValue(null);
  (createBookingEvent as jest.Mock).mockResolvedValue('evt1');
  jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => client.close());

describe('부분취소 2회 — 멱등 키에 취소 합계를 넣는다 (항목 1)', () => {
  /** 토스 재조회 응답: 부분취소가 누적된 상태. status는 두 번 다 PARTIAL_CANCELED다. */
  const partialCancelled = (orderNo: string, cancels: Array<{ transactionKey: string; cancelAmount: number }>) => ({
    ok: true,
    payment: { paymentKey: 'pk_f', orderId: orderNo, status: 'PARTIAL_CANCELED', totalAmount: 5000, cancels },
  });

  it('두 번째 부분취소가 중복으로 스킵되지 않고 원장에 반영된다 — 최종 refunded', async () => {
    const { orderNo } = await paidPledge();

    // ① 1회차 부분취소 2,500원.
    mockFetch.mockResolvedValueOnce(partialCancelled(orderNo, [{ transactionKey: 'c1', cancelAmount: 2500 }]));
    expect(await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'PARTIAL_CANCELED' } })).toEqual({ status: 200 });
    expect((await findFundingOrderByOrderNo(orderNo))?.status).toBe('partially_refunded');
    expect((await refundRows(orderNo)).reduce((s, r) => s + r.amount, 0)).toBe(2500);

    // ② 2회차 부분취소 2,500원 — 재조회 status는 여전히 PARTIAL_CANCELED다. 멱등 키가
    //    `paymentKey:status`뿐이던 시절엔 이 이벤트가 unique 위반으로 통째로 스킵됐다.
    mockFetch.mockResolvedValueOnce(
      partialCancelled(orderNo, [
        { transactionKey: 'c1', cancelAmount: 2500 },
        { transactionKey: 'c2', cancelAmount: 2500 },
      ]),
    );
    expect(await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'PARTIAL_CANCELED' } })).toEqual({ status: 200 });

    const rows = await refundRows(orderNo);
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(5000); // 두 번 다 반영
    expect(rows.every((r) => r.status === 'done')).toBe(true);
    expect((await findFundingOrderByOrderNo(orderNo))?.status).toBe('refunded');
    // 키에 누적 합계가 들어가 서로 다른 이벤트가 된다.
    expect(await eventKeys()).toEqual(['pk_f:PARTIAL_CANCELED:2500', 'pk_f:PARTIAL_CANCELED:5000']);
  });

  it('같은 취소 이벤트의 재도착은 여전히 중복으로 스킵된다 (멱등성 유지)', async () => {
    const { orderNo } = await paidPledge();
    const same = partialCancelled(orderNo, [{ transactionKey: 'c1', cancelAmount: 2500 }]);
    mockFetch.mockResolvedValueOnce(same).mockResolvedValueOnce(same);

    await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'PARTIAL_CANCELED' } });
    await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'PARTIAL_CANCELED' } });

    expect(await refundRows(orderNo)).toHaveLength(1);
    expect(await eventKeys()).toEqual(['pk_f:PARTIAL_CANCELED:2500']);
  });

  it('DONE 이벤트의 키는 그대로 `paymentKey:status`다', async () => {
    const c = await createFundingPledge(pledgePayload(), PROJECT, PROJECT.rewards[0], NOW);
    if (!c.ok) throw new Error();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk_f', orderId: c.orderNo, status: 'DONE', totalAmount: 5000 },
    });
    mockConfirm.mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk_f', orderId: c.orderNo, status: 'DONE', totalAmount: 5000 },
    });
    await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'DONE' } });
    expect(await eventKeys()).toEqual(['pk_f:DONE']);
  });
});

describe('토스 콘솔 취소 통지·무로그 조기 반환 (항목 4)', () => {
  it('외부 취소를 반영한 뒤 후원자에게 취소 메일을 보낸다 — 누적 취소 합계로', async () => {
    const { orderNo } = await paidPledge();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      payment: {
        paymentKey: 'pk_f', orderId: orderNo, status: 'CANCELED', totalAmount: 5000,
        cancels: [{ transactionKey: 'c1', cancelAmount: 5000 }],
      },
    });
    await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'CANCELED' } });

    expect(mockCancelMail).toHaveBeenCalledTimes(1);
    expect(mockCancelMail).toHaveBeenCalledWith(
      expect.objectContaining({ orderNo }),
      null, // 테스트 픽스처 프로젝트는 content/funding에 없다 — 메일은 슬러그로 폴백한다
      'recorded',
      5000,
    );
    expect((await findFundingOrderByOrderNo(orderNo))?.notificationError).toBeNull();
  });

  it('메일이 실패해도 동기화는 뒤집히지 않고 notificationError에 남는다', async () => {
    const { orderNo } = await paidPledge();
    mockCancelMail.mockResolvedValueOnce('customer:API_ERROR');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      payment: {
        paymentKey: 'pk_f', orderId: orderNo, status: 'CANCELED', totalAmount: 5000,
        cancels: [{ transactionKey: 'c1', cancelAmount: 5000 }],
      },
    });
    expect(await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'CANCELED' } })).toEqual({ status: 200 });

    const order = await findFundingOrderByOrderNo(orderNo);
    expect(order?.status).toBe('refunded');
    expect(order?.notificationError).toBe('customer:API_ERROR');
  });

  it('델타가 0이면(같은 취소 재도착) 메일을 다시 보내지 않는다', async () => {
    const { orderNo } = await paidPledge();
    const payload = {
      ok: true,
      payment: {
        paymentKey: 'pk_f', orderId: orderNo, status: 'CANCELED', totalAmount: 5000,
        cancels: [{ transactionKey: 'c1', cancelAmount: 5000 }],
      },
    };
    mockFetch.mockResolvedValueOnce(payload).mockResolvedValueOnce(payload);
    await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'CANCELED' } });
    // 두 번째는 같은 키라 웹훅 단계에서 스킵되지만, 키를 지워 대사 경로까지 한 번 더 태워도
    // 델타가 0이라 메일이 나가지 않아야 한다.
    await client.execute('DELETE FROM webhook_events');
    await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'CANCELED' } });
    expect(mockCancelMail).toHaveBeenCalledTimes(1);
  });

  it('payments 행이 없으면 무로그로 물러나지 않고 대사 단서를 남긴다', async () => {
    const c = await createFundingPledge(pledgePayload(), PROJECT, PROJECT.rewards[0], NOW);
    if (!c.ok) throw new Error();
    await client.execute({ sql: `UPDATE orders SET status = 'paid' WHERE order_no = ?`, args: [c.orderNo] });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      payment: {
        paymentKey: 'pk_none', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000,
        cancels: [{ transactionKey: 'c1', cancelAmount: 5000 }],
      },
    });
    expect(await processTossWebhook({ data: { paymentKey: 'pk_none', status: 'CANCELED' } })).toEqual({ status: 200 });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[funding-confirm] 취소 동기화 스킵 — 주문에 payments 행이 없음',
      expect.objectContaining({ orderNo: c.orderNo }),
    );
  });

  it('cancels가 없어 취소 합계가 0이면 로그만 남기고 아무것도 기록하지 않는다', async () => {
    const { orderNo } = await paidPledge();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk_f', orderId: orderNo, status: 'CANCELED', totalAmount: 5000 },
    });
    await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'CANCELED' } });
    expect((await findFundingOrderByOrderNo(orderNo))?.status).toBe('paid');
    expect(await refundRows(orderNo)).toHaveLength(0);
    expect(mockCancelMail).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[funding-confirm] 취소 동기화 스킵 — 취소 합계 0(cancels 부재)',
      expect.objectContaining({ orderNo }),
    );
  });
});

describe('SSR 확정과 그 승인이 유발한 웹훅이 겹칠 때 (후속 리뷰 Important 1·2)', () => {
  const doneFor = (orderNo: string, amount: number, paymentKey = 'pk_b') => ({
    ok: true,
    payment: { paymentKey, orderId: orderNo, status: 'DONE', totalAmount: amount, method: '카드' },
  });

  /** SSR 확정이 후처리 중일 때 웹훅이 도착하는 상황을 재현한다. */
  const confirmWithWebhookDuring = async (
    hook: 'gcal' | 'email',
  ): Promise<{ orderNo: string; webhook: { status: number } | undefined }> => {
    // SSR 경로는 선점 만료를 Date.now()와 created_at(실제 벽시계)으로 비교한다 — NOW 픽스처를
    // 그대로 두면 미래 시각이라 정상 주문이 만료로 읽힌다. 이 묶음은 실제 시계를 쓴다.
    (Date.now as unknown as jest.SpyInstance).mockRestore();
    const a = await createBookingOrder(bookingPayload(), NOW);
    if (!a.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    mockFetch.mockResolvedValue(doneFor(a.orderNo, a.totalAmount));
    let webhook: { status: number } | undefined;
    const arrive = async () => {
      webhook = await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });
    };
    if (hook === 'gcal') {
      (createBookingEvent as jest.Mock).mockImplementationOnce(async () => {
        await arrive();
        return 'evt1';
      });
    } else {
      (sendBookingConfirmedEmails as jest.Mock).mockImplementationOnce(async () => {
        await arrive();
        return null;
      });
    }
    const r = await confirmBookingPayment({ orderNo: a.orderNo, paymentKey: 'pk_b', amount: a.totalAmount });
    expect(r).toMatchObject({ ok: true, emailSent: true });
    return { orderNo: a.orderNo, webhook };
  };

  it('캘린더 등록 중(0.2~0.8초)에 웹훅이 와도 확정 메일 1통·캘린더 1건', async () => {
    const { orderNo, webhook } = await confirmWithWebhookDuring('gcal');
    expect(webhook).toEqual({ status: 200 });
    expect(createBookingEvent).toHaveBeenCalledTimes(1);
    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);
    expect((await findOrderByOrderNo(orderNo))?.notificationError).toBeNull();
  });

  it('확정 메일 발송 중(0.3~1.5초)에 웹훅이 와도 확정 메일은 1통', async () => {
    const { orderNo, webhook } = await confirmWithWebhookDuring('email');
    expect(webhook).toEqual({ status: 200 });
    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);
    expect(createBookingEvent).toHaveBeenCalledTimes(1);
    expect((await findOrderByOrderNo(orderNo))?.notificationError).toBeNull();
  });

  it('센티널 복구는 캘린더 구멍도 함께 메운다 — gcal_event_id·gcal_error가 둘 다 null이면 등록한다', async () => {
    const a = await createBookingOrder(bookingPayload(), NOW);
    if (!a.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });
    // batch 직후 프로세스가 죽은 상태: 센티널만 남고 gcal·메일 둘 다 못 갔다.
    await client.execute({ sql: `UPDATE orders SET notification_error = 'send_pending' WHERE order_no = ?`, args: [a.orderNo] });
    await client.execute('UPDATE bookings SET gcal_event_id = NULL, gcal_error = NULL');
    (createBookingEvent as jest.Mock).mockClear();
    (sendBookingConfirmedEmails as jest.Mock).mockClear();

    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    await client.execute('DELETE FROM webhook_events');
    await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });

    expect(createBookingEvent).toHaveBeenCalledTimes(1);
    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);
    const order = await findOrderByOrderNo(a.orderNo);
    expect(order?.bookings[0].gcalEventId).toBe('evt1');
    expect(order?.notificationError).toBeNull();
  });

  it('이미 등록됐거나 실패 기록이 있으면 복구가 캘린더 이벤트를 다시 만들지 않는다', async () => {
    for (const setup of ["gcal_event_id = 'already'", "gcal_error = 'create(2026-10-15): 500'"]) {
      await client.execute('DELETE FROM webhook_events');
      await client.execute('DELETE FROM payments');
      await client.execute('DELETE FROM bookings');
      await client.execute('DELETE FROM orders');
      const a = await createBookingOrder(bookingPayload(), NOW);
      if (!a.ok) throw new Error();
      mockConfirm.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
      mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
      await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });
      await client.execute({ sql: `UPDATE orders SET notification_error = 'send_pending' WHERE order_no = ?`, args: [a.orderNo] });
      await client.execute(`UPDATE bookings SET gcal_event_id = NULL, gcal_error = NULL, ${setup}`);
      (createBookingEvent as jest.Mock).mockClear();

      mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
      await client.execute('DELETE FROM webhook_events');
      await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });
      expect(createBookingEvent).not.toHaveBeenCalled();
    }
  });
});

describe('예약 웹훅 복구 대칭 (항목 5)', () => {
  const doneFor = (orderNo: string, amount: number, paymentKey = 'pk_b') => ({
    ok: true,
    payment: { paymentKey, orderId: orderNo, status: 'DONE', totalAmount: amount, method: '카드' },
  });

  it('failed로 낙인된 과거 예약도 DONE 웹훅이 paid·confirmed로 복구한다', async () => {
    const a = await createBookingOrder(bookingPayload(), NOW);
    if (!a.ok) throw new Error();
    await client.execute({ sql: `UPDATE orders SET status = 'failed' WHERE order_no = ?`, args: [a.orderNo] });

    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    mockConfirm.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    expect(await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } })).toEqual({ status: 200 });

    const order = await findOrderByOrderNo(a.orderNo);
    expect(order?.status).toBe('paid');
    expect(order?.bookings[0].status).toBe('confirmed');
    expect(order?.payments[0].paymentKey).toBe('pk_b');
    // 확정 메일이 나갔으므로 센티널은 지워져 있다.
    expect(order?.notificationError).toBeNull();
    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('선점이 풀린 세션 주문은 웹훅이 와도 확정하지 않고 전액 자동 취소한다 (이중 예약 금지)', async () => {
    const a = await createBookingOrder(bookingPayload(), NOW);
    if (!a.ok) throw new Error();
    await backdate(a.orderNo, PENDING_HOLD_SECONDS + 60);

    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    mockConfirm.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    mockCancel.mockResolvedValueOnce({
      ok: true,
      payment: {
        paymentKey: 'pk_b', orderId: a.orderNo, status: 'CANCELED', totalAmount: a.totalAmount,
        cancels: [{ transactionKey: 'auto', cancelAmount: a.totalAmount }],
      },
    });
    expect(await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } })).toEqual({ status: 200 });

    const order = await findOrderByOrderNo(a.orderNo);
    // status는 여전히 pending이다 — 막은 것은 상태가 아니라 batch WHERE의 sessionHoldGuard다.
    // (autoCancelStaleApproval의 계약: "0행 = pending이 아니다"가 더 이상 성립하지 않는다.)
    expect(order?.status).toBe('pending');
    expect(order?.bookings[0].status).toBe('pending'); // confirmed로 넘어가지 않는다
    expect(mockCancel).toHaveBeenCalledTimes(1);
    const rows = await refundRows(a.orderNo);
    expect(rows).toEqual([{ amount: a.totalAmount, status: 'done' }]);
  });

  it('믹싱은 슬롯이 없어 24시간짜리 오래된 pending도 웹훅이 그대로 확정한다', async () => {
    const m = await createMixingOrder(
      {
        productId: 'mixing-level1', songCount: 1, vocalTuning: false,
        customerName: '박믹싱', customerPhone: '010-3333-4444', customerEmail: 'mix@example.com',
        refundPolicyAgreed: true,
      },
      NOW,
    );
    await client.execute({
      sql: 'UPDATE orders SET created_at = created_at - ? WHERE order_no = ?',
      args: [PENDING_HOLD_SECONDS + 3600, m.orderNo],
    });

    mockFetch.mockResolvedValueOnce(doneFor(m.orderNo, m.totalAmount, 'pk_m'));
    mockConfirm.mockResolvedValueOnce(doneFor(m.orderNo, m.totalAmount, 'pk_m'));
    expect(await processTossWebhook({ data: { paymentKey: 'pk_m', status: 'DONE' } })).toEqual({ status: 200 });

    const order = await findOrderByOrderNo(m.orderNo);
    expect(order?.status).toBe('paid');
    expect(order?.workOrders[0].status).toBe('received');
    expect(sendMixingOrderConfirmedEmails).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('확정 메일 단계에서 죽어 센티널이 남으면 웹훅 재도착이 메일만 다시 보낸다', async () => {
    const a = await createBookingOrder(bookingPayload(), NOW);
    if (!a.ok) throw new Error();
    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    mockConfirm.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });
    // batch는 커밋됐지만 메일 단계 전에 프로세스가 죽은 상태를 재현한다.
    await client.execute({ sql: `UPDATE orders SET notification_error = 'send_pending' WHERE order_no = ?`, args: [a.orderNo] });
    (sendBookingConfirmedEmails as jest.Mock).mockClear();

    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    await client.execute('DELETE FROM webhook_events'); // 토스 재시도 = 같은 키가 아닌 새 배달로 취급
    expect(await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } })).toEqual({ status: 200 });

    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);
    expect((await findOrderByOrderNo(a.orderNo))?.notificationError).toBeNull();
    expect(mockConfirm).toHaveBeenCalledTimes(1); // 토스 재승인은 부르지 않는다
  });

  it('센티널이 없으면 웹훅 재도착은 확정 메일을 다시 보내지 않는다', async () => {
    const a = await createBookingOrder(bookingPayload(), NOW);
    if (!a.ok) throw new Error();
    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    mockConfirm.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });
    (sendBookingConfirmedEmails as jest.Mock).mockClear();

    mockFetch.mockResolvedValueOnce(doneFor(a.orderNo, a.totalAmount));
    await client.execute('DELETE FROM webhook_events');
    await processTossWebhook({ data: { paymentKey: 'pk_b', status: 'DONE' } });
    expect(sendBookingConfirmedEmails).not.toHaveBeenCalled();
  });
});
