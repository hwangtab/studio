/** @jest-environment node */

/**
 * 구독 회차 환불을 실제 SQLite(in-memory)에 대고 돌린다. 토스 취소만 모킹한다.
 *
 * 지켜야 할 것: 회차 환불은 돈(refunds·orders)만 움직이고 구독·회차 상태는 건드리지 않는다.
 * 잔액을 넘는 금액은 토스를 부르기 전에 거절한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

const cancelPayment = jest.fn();
jest.mock('../booking/toss', () => ({
  ...jest.requireActual('../booking/toss'),
  cancelPayment: (...args: unknown[]) => cancelPayment(...args),
}));

// eslint-disable-next-line import/first
import { listSubscriptionRefundSummary, refundSubscriptionPayment } from './refund';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-09-16T03:00:00Z');
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());

beforeEach(async () => {
  cancelPayment.mockReset();
  for (const t of ['refunds', 'payments', 'subscription_payments', 'subscriptions', 'orders']) {
    await client.execute(`DELETE FROM ${t}`);
  }
  await client.execute({
    sql: `INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key,
            item_amount, vat_amount, total_amount, billing_day, status, manage_token)
          VALUES ('sub1', 'lesson', '김수강', '010-1234-5678', 's@example.com', 'ck_1', 350000, 35000, 385000, 5, 'cancelled', 'mt_1')`,
    args: [],
  });
});

const insertPaidCycle = async (id: string, orderNo: string, paymentKey: string) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
            manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, 'subscription', 'paid', '김수강', '010-1234-5678', 's@example.com', ?, 350000, 35000, 385000)`,
    args: [`o_${id}`, orderNo, `tok_${id}`],
  });
  await client.execute({
    sql: `INSERT INTO payments (id, order_id, payment_key, method) VALUES (?, ?, ?, '카드')`,
    args: [`p_${id}`, `o_${id}`, paymentKey],
  });
  await client.execute({
    sql: `INSERT INTO subscription_payments (id, subscription_id, order_id, cycle_ym, attempt, amount, status, payment_key)
          VALUES (?, 'sub1', ?, '2026-09', 1, 385000, 'paid', ?)`,
    args: [id, `o_${id}`, paymentKey],
  });
};

const cancelOk = (amount: number) => ({
  ok: true,
  payment: { paymentKey: 'pay_1', orderId: 'x', status: 'CANCELED', totalAmount: 385000, cancels: [{ transactionKey: 'tx_1', cancelAmount: amount }] },
});

it('전액 환불하면 refunds에 done이 남고 주문은 refunded, 구독·회차 상태는 그대로다', async () => {
  await insertPaidCycle('sp1', 'SNB-1', 'pay_1');
  cancelPayment.mockResolvedValue(cancelOk(385000));

  const result = await refundSubscriptionPayment({ subscriptionId: 'sub1', subscriptionPaymentId: 'sp1', reason: '해지 후 뒤늦은 승인', now: NOW });

  expect(result).toEqual({ ok: true, refundAmount: 385000, orderNo: 'SNB-1' });
  expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentKey: 'pay_1', cancelAmount: 385000, cancelReason: '해지 후 뒤늦은 승인' }));

  const order = (await client.execute("SELECT status FROM orders WHERE id = 'o_sp1'")).rows[0];
  expect(order.status).toBe('refunded');
  const refund = (await client.execute("SELECT amount, status, requested_by, toss_transaction_key FROM refunds")).rows[0];
  expect(refund).toMatchObject({ amount: 385000, status: 'done', requested_by: 'admin', toss_transaction_key: 'tx_1' });
  const cycle = (await client.execute("SELECT status FROM subscription_payments WHERE id = 'sp1'")).rows[0];
  expect(cycle.status).toBe('paid');
  const sub = (await client.execute("SELECT status FROM subscriptions WHERE id = 'sub1'")).rows[0];
  expect(sub.status).toBe('cancelled');
});

it('부분 환불은 partially_refunded로 남고 요약의 잔액이 줄어든다', async () => {
  await insertPaidCycle('sp1', 'SNB-1', 'pay_1');
  cancelPayment.mockResolvedValue(cancelOk(100000));

  const result = await refundSubscriptionPayment({ subscriptionId: 'sub1', subscriptionPaymentId: 'sp1', reason: '일부 이용', amount: 100000, now: NOW });
  expect(result.ok).toBe(true);

  const order = (await client.execute("SELECT status FROM orders WHERE id = 'o_sp1'")).rows[0];
  expect(order.status).toBe('partially_refunded');

  const summary = await listSubscriptionRefundSummary('sub1');
  expect(summary).toEqual([
    { subscriptionPaymentId: 'sp1', orderNo: 'SNB-1', orderStatus: 'partially_refunded', refundedAmount: 100000, remainingAmount: 285000 },
  ]);
});

it('잔액을 넘는 금액은 토스를 부르지 않고 거절한다', async () => {
  await insertPaidCycle('sp1', 'SNB-1', 'pay_1');

  const result = await refundSubscriptionPayment({ subscriptionId: 'sub1', subscriptionPaymentId: 'sp1', reason: 'x', amount: 385001, now: NOW });

  expect(result.ok).toBe(false);
  expect(cancelPayment).not.toHaveBeenCalled();
});

it('다른 구독의 회차 id로는 환불할 수 없다', async () => {
  await insertPaidCycle('sp1', 'SNB-1', 'pay_1');

  const result = await refundSubscriptionPayment({ subscriptionId: 'sub_other', subscriptionPaymentId: 'sp1', reason: 'x', now: NOW });

  expect(result).toMatchObject({ ok: false, code: 'not_found' });
  expect(cancelPayment).not.toHaveBeenCalled();
});

it('토스가 거절하면 failed 행만 남고 주문 상태는 paid 그대로다', async () => {
  await insertPaidCycle('sp1', 'SNB-1', 'pay_1');
  cancelPayment.mockResolvedValue({ ok: false, code: 'NOT_CANCELABLE_AMOUNT', message: '취소 가능 금액을 초과했습니다.' });

  const result = await refundSubscriptionPayment({ subscriptionId: 'sub1', subscriptionPaymentId: 'sp1', reason: 'x', now: NOW });

  expect(result).toMatchObject({ ok: false, code: 'toss_failed' });
  const order = (await client.execute("SELECT status FROM orders WHERE id = 'o_sp1'")).rows[0];
  expect(order.status).toBe('paid');
  const refund = (await client.execute('SELECT status FROM refunds')).rows[0];
  expect(refund.status).toBe('failed');
});
