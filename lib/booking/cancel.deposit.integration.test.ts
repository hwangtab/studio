/** @jest-environment node */
/**
 * 예약금(`orders.type='deposit'`) 환불 — 예약·작업 행이 없는 주문에 잔액만 돌려주는 운영자 전용 경로.
 * 이전에는 "토스 콘솔 또는 계좌 송금으로 처리하라"며 거절해서 시스템에 환불을 기록할 방법이 없었다
 * (주문이 영원히 paid로 남고 매출장부에 환불이 안 잡힌다).
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./toss', () => ({ ...jest.requireActual('./toss'), cancelPayment: jest.fn() }));
jest.mock('./email', () => ({
  sendBookingCancelledEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderCancelledEmails: jest.fn().mockResolvedValue(null),
  sendDepositRefundEmail: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import { cancelBookingWithRefund } from './cancel';
import { cancelPayment } from './toss';
import { sendDepositRefundEmail } from './email';
import { canAdminRefund } from './admin-serialize';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T00:00:00Z');
let client: Client;

const seed = async (over: { paymentKey?: string; method?: string; status?: string } = {}) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token,
            item_amount, vat_amount, total_amount) VALUES ('d1','DEP-1','deposit',?, '김예약금','010','a@b.c','tok', 100000, 10000, 110000)`,
    args: [over.status ?? 'paid'],
  });
  await client.execute({
    sql: 'INSERT INTO payments (id, order_id, payment_key, method) VALUES (?, ?, ?, ?)',
    args: ['p1', 'd1', over.paymentKey ?? 'toss-pk', over.method ?? '카드'],
  });
};

const refund = (overrideAmount: number | undefined, requestedBy: 'admin' | 'customer' = 'admin') =>
  cancelBookingWithRefund({ orderNo: 'DEP-1', requestedBy, reason: '고객 요청', overrideAmount, now: NOW });

const order = async () => (await client.execute("SELECT status FROM orders WHERE id = 'd1'")).rows[0].status;
const refundRows = async () =>
  (await client.execute('SELECT amount, status FROM refunds ORDER BY amount')).rows.map((r) => ({ amount: Number(r.amount), status: String(r.status) }));

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
  for (const t of ['refunds', 'payments', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (cancelPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { paymentKey: 'toss-pk', cancels: [{ transactionKey: 'ck', cancelAmount: 1 }] } });
});
afterEach(() => jest.restoreAllMocks());

describe('토스 결제 예약금', () => {
  it('일부를 환불하면 토스를 취소하고 partially_refunded, 나머지를 마저 돌려주면 refunded', async () => {
    await seed();

    const first = await refund(40_000);
    expect(first).toEqual({ ok: true, refundAmount: 40_000, refundVia: 'payment' });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentKey: 'toss-pk', cancelAmount: 40_000 }));
    expect(await order()).toBe('partially_refunded');

    const second = await refund(70_000);
    expect(second.ok).toBe(true);
    expect(await order()).toBe('refunded');
    expect(await refundRows()).toEqual([
      { amount: 40_000, status: 'done' },
      { amount: 70_000, status: 'done' },
    ]);
  });

  it('토스가 거절하면 failed 이력만 남기고 주문 상태는 그대로다', async () => {
    await seed();
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'ALREADY_CANCELED_PAYMENT', message: '이미 취소된 결제입니다.' });

    const r = await refund(110_000);

    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    expect(await order()).toBe('paid');
    expect(await refundRows()).toEqual([{ amount: 110_000, status: 'failed' }]);
  });

  it('남은 금액을 넘는 금액·0원·소수는 거절하고 토스를 부르지 않는다', async () => {
    await seed();
    for (const amount of [110_001, 0, -1, 1.5, undefined]) {
      const r = await refund(amount as number);
      expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    }
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(await order()).toBe('paid');
  });

  it('전액 환불된 주문과 결제 전 주문은 거절한다', async () => {
    await seed();
    await refund(110_000);
    expect(await refund(1)).toMatchObject({ ok: false, message: expect.stringContaining('환불') });

    await client.execute('DELETE FROM refunds');
    await client.execute('DELETE FROM payments');
    await client.execute('DELETE FROM orders');
    await seed({ status: 'pending' });
    expect(await refund(1000)).toMatchObject({ ok: false, code: 'invalid_state' });
  });

  it('고객 셀프 환불은 없다', async () => {
    await seed();
    expect(await refund(1000, 'customer')).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it('같은 금액을 동시에 두 번 눌러도 원장은 한 번만 센다', async () => {
    await seed();
    const [a, b] = await Promise.all([refund(50_000), refund(50_000)]);
    expect([a.ok, b.ok]).toEqual([true, true]);
    expect(await refundRows()).toEqual([{ amount: 50_000, status: 'done' }]);
  });
});

describe('고객 환불 안내 메일', () => {
  const notificationError = async () => (await client.execute("SELECT notification_error AS e FROM orders WHERE id = 'd1'")).rows[0].e;

  it('환불할 때마다 환불액과 남은 결제 금액을 실어 보낸다', async () => {
    await seed();
    await refund(40_000);
    expect(sendDepositRefundEmail).toHaveBeenLastCalledWith(expect.objectContaining({ orderNo: 'DEP-1' }), 40_000, 70_000, 'payment');
    await refund(70_000);
    expect(sendDepositRefundEmail).toHaveBeenLastCalledWith(expect.objectContaining({ orderNo: 'DEP-1' }), 70_000, 0, 'payment');
    expect(await notificationError()).toBeNull();
  });

  it('메일이 실패해도 환불은 성공이고 사유를 notificationError에 남긴다', async () => {
    await seed();
    (sendDepositRefundEmail as jest.Mock).mockResolvedValue('API_ERROR');

    expect((await refund(40_000)).ok).toBe(true);
    expect(await order()).toBe('partially_refunded');
    expect(await notificationError()).toBe('API_ERROR');
  });

  it('환불이 거절되면 메일을 보내지 않는다', async () => {
    await seed();
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'X', message: '거절' });
    await refund(40_000);
    expect(sendDepositRefundEmail).not.toHaveBeenCalled();
  });

  it('계좌 입금 건은 송금 기록 뒤 bank_account로 보낸다', async () => {
    await seed({ paymentKey: 'bank-deposit:DEP-1', method: '계좌 입금' });
    await refund(110_000);
    expect(sendDepositRefundEmail).toHaveBeenCalledWith(expect.anything(), 110_000, 0, 'bank_account');
  });
});

describe('계좌 입금 예약금', () => {
  it('토스를 부르지 않고 운영자가 보낸 송금을 기록한다', async () => {
    await seed({ paymentKey: 'bank-deposit:DEP-1', method: '계좌 입금' });

    const r = await refund(110_000);

    expect(r).toEqual({ ok: true, refundAmount: 110_000, refundVia: 'bank_account' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(await order()).toBe('refunded');
    expect(await refundRows()).toEqual([{ amount: 110_000, status: 'done' }]);
  });
});

describe('화면 판정(canAdminRefund)과 서버가 같다', () => {
  it('예약금 주문은 예약 행이 없어도 결제 완료·잔액이 있으면 폼이 뜬다', () => {
    expect(canAdminRefund({ orderType: 'deposit', orderStatus: 'paid', entityStatus: null, refundableAmount: 1000 })).toBe(true);
    expect(canAdminRefund({ orderType: 'deposit', orderStatus: 'partially_refunded', entityStatus: null, refundableAmount: 1000 })).toBe(true);
    expect(canAdminRefund({ orderType: 'deposit', orderStatus: 'awaiting_deposit', entityStatus: null, refundableAmount: 1000 })).toBe(false);
    expect(canAdminRefund({ orderType: 'deposit', orderStatus: 'refunded', entityStatus: null, refundableAmount: 0 })).toBe(false);
    // 다른 종류는 여전히 행이 있어야 한다.
    expect(canAdminRefund({ orderType: 'session', orderStatus: 'paid', entityStatus: null, refundableAmount: 1000 })).toBe(false);
  });
});
