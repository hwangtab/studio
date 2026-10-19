/** @jest-environment node */
/**
 * 예약금(`orders.type='deposit'`) 환불 — 예약·작업 행이 없는 주문에 잔액만 돌려주는 운영자 전용 경로.
 * 이전에는 "토스 콘솔 또는 계좌 송금으로 처리하라"며 거절해서 카드 결제분을 시스템에서 취소할 방법이 없었다
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
import { createFakeToss } from '../../tests/fakes/fakeToss';
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

});

// 계좌 직접 입금분의 환불 기록은 recordLinkBankRefund(lib/payments/linkRefund.ts) 한 곳이다 — 이 경로는 받지 않는다.
describe('계좌 입금 예약금', () => {
  it('여기서는 받지 않고 환불 기록으로 안내한다 — 토스도 메일도 없다', async () => {
    await seed({ paymentKey: 'bank-deposit:DEP-1', method: '계좌 입금' });

    const r = await refund(110_000);

    expect(r).toMatchObject({ ok: false, code: 'invalid_state', message: expect.stringContaining('환불 기록') });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(sendDepositRefundEmail).not.toHaveBeenCalled();
    expect(await order()).toBe('paid');
    expect(await refundRows()).toEqual([]);
  });
});

/**
 * 토스를 흉내 내는 가짜(tests/fakes/fakeToss.ts)로 본 **돈이 실제로 나간 횟수** — 멱등키 재생까지 같다.
 * 실거래 환불은 검증할 수 없으니, 요청이 몇 번·어떤 키로 나가는지를 여기서 고정한다.
 */
describe('가짜 토스로 본 취소 호출', () => {
  const PK = 'toss-pk';
  let fake: ReturnType<typeof createFakeToss>;

  beforeEach(async () => {
    fake = createFakeToss();
    await fake.confirmPayment({ paymentKey: PK, orderId: 'DEP-1', amount: 110_000 });
    (cancelPayment as jest.Mock).mockImplementation((input) => fake.cancelPayment(input));
  });

  const cancelsOf = () => fake._payments.get(PK)?.cancels ?? [];

  it('같은 금액을 동시에 두 번 눌러도 토스 취소는 한 번만 나간다', async () => {
    await seed();
    await Promise.all([refund(50_000), refund(50_000)]);
    expect(cancelsOf()).toHaveLength(1);
    expect(cancelsOf()[0].cancelAmount).toBe(50_000);
  });

  it('금액이 다른 부분 환불은 각각 나간다 — 멱등키가 (주문번호, 금액)이라 서로 재생되지 않는다', async () => {
    await seed();
    await refund(40_000);
    await refund(70_000);
    expect(cancelsOf().map((c) => c.cancelAmount)).toEqual([40_000, 70_000]);
    expect(await order()).toBe('refunded');
  });

  // 같은 금액을 두 번째로 환불하면 첫 환불의 멱등키가 재생돼 돈이 안 나가고 성공만 오는 사고를 막는 설계다(cancel.ts REMAINDER_PREFIX).
  // 운영자에게는 "금액을 다르게 나눠 입력"하라고 안내한다.
  it('이미 기록된 것과 같은 금액의 두 번째 환불은 거절하고 금액을 다르게 나누라고 안내한다', async () => {
    await seed();
    await refund(40_000);
    const second = await refund(40_000);
    expect(second).toMatchObject({ ok: false, code: 'invalid_state', message: expect.stringContaining('금액을 다르게') });
    expect(cancelsOf()).toHaveLength(1);
    expect(await order()).toBe('partially_refunded');
    // 1원 달리 나누면 나간다.
    expect((await refund(39_999)).ok).toBe(true);
    expect(cancelsOf().map((c) => c.cancelAmount)).toEqual([40_000, 39_999]);
  });
});
