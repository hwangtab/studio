/** @jest-environment node */
/**
 * 잔액 환불(관리자 추가 환불)의 **선점**을 실 DB(in-memory libSQL)로 본다.
 *
 * 이 경로에는 붙잡을 상태가 없다 — 예약·주문이 이미 cancelled라 claim UPDATE를 건너뛴다.
 * 그래서 두 탭에서 같은 금액을 동시에 제출하면 토스는 멱등키로 한 번만 취소하는데
 * **우리 원장에는 done 행이 2건** 들어가고 orders.status를 두 번 쓴다. 환불액이 2배로
 * 계상돼 remainingRefundable이 0으로 눌리고 이후의 정당한 잔액 환불이 영영 막힌다.
 *
 * 목 객체로는 증명할 수 없다 — 막아 내는 것이 refunds PK 제약이기 때문이다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./toss', () => ({ ...jest.requireActual('./toss'), cancelPayment: jest.fn() }));
jest.mock('./gcal', () => ({ deleteBookingEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('./email', () => ({
  sendBookingCancelledEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderCancelledEmails: jest.fn().mockResolvedValue(null),
}));

// eslint-disable-next-line import/first
import { cancelBookingWithRefund } from './cancel';
// eslint-disable-next-line import/first
import { cancelPayment } from './toss';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-08-20T00:00:00Z');
const START_AT = Math.floor(NOW.getTime() / 1000) + 3 * 24 * 60 * 60;
let client: Client;

/** 이미 한 번 취소돼 절반만 환불된 세션 예약 — 잔액 137,500원이 남아 있다. */
const seedCancelledBooking = async (over: { orderStatus?: string; refunded?: number } = {}) => {
  const refunded = over.refunded ?? 137_500;
  await client.execute(`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone,
      customer_email, manage_token, item_amount, vat_amount, total_amount, created_at, updated_at)
    VALUES ('o1','SNB-1','session',?, '김보컬','010-1','a@b.c','tok', 250000, 25000, 275000, unixepoch(), unixepoch())`
    .replace('?', `'${over.orderStatus ?? 'partially_refunded'}'`));
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours,
            status, cancelled_at, created_at, updated_at)
          VALUES ('b1','o1','recording-pro','recording',?,?,3,'cancelled', unixepoch(), unixepoch(), unixepoch())`,
    args: [START_AT, START_AT + 10800],
  });
  await client.execute("INSERT INTO payments (id, order_id, payment_key, method) VALUES ('p1','o1','pk','카드')");
  if (refunded > 0) {
    await client.execute({
      sql: `INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES ('r1','p1',?,'첫 취소','customer','done')`,
      args: [refunded],
    });
  }
};

const doneRefunds = async () => {
  const r = await client.execute("SELECT id, amount FROM refunds WHERE status='done' ORDER BY amount");
  return r.rows.map((row) => ({ id: String(row.id), amount: Number(row.amount) }));
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
afterAll(() => client.close());
beforeEach(async () => {
  await client.execute('DELETE FROM refunds');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM bookings');
  await client.execute('DELETE FROM orders');
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  // 토스는 멱등키로 같은 취소를 replay한다 — 두 요청 모두 성공 응답을 받는다.
  (cancelPayment as jest.Mock).mockResolvedValue({
    ok: true, payment: { paymentKey: 'pk', cancels: [{ transactionKey: 'ck', cancelAmount: 137_500 }] },
  });
});
afterEach(() => jest.restoreAllMocks());

const refund = (overrideAmount: number) =>
  cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 잔액 환불', overrideAmount, now: NOW });

it('같은 금액의 잔액 환불 2건이 동시에 오면 한 건만 성립한다', async () => {
  await seedCancelledBooking();
  const [a, b] = await Promise.all([refund(137_500), refund(137_500)]);

  expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  const loser = a.ok ? b : a;
  expect(loser).toMatchObject({ ok: false, code: 'invalid_state' });

  // 원장에 done 행은 첫 취소분 + 이번 1건뿐이어야 한다. 2건이 들어가면 환불액이 2배로
  // 계상돼 remainingRefundable이 0으로 눌리고 이후 정당한 잔액 환불이 막힌다.
  expect(await doneRefunds()).toEqual([{ id: expect.any(String), amount: 137_500 }, { id: expect.any(String), amount: 137_500 }]);
});

it('순차로 같은 금액을 두 번 환불해도 두 번째는 거절된다 — 토스가 replay하는 범위와 같다', async () => {
  await seedCancelledBooking();
  expect((await refund(137_500)).ok).toBe(true);
  const second = await refund(137_500);
  expect(second).toMatchObject({ ok: false, code: 'invalid_state' });
});

it('금액이 다르면 각각 성립한다 — 선점 키는 (주문번호 × 금액)이다', async () => {
  await seedCancelledBooking({ refunded: 0, orderStatus: 'paid' });
  expect((await refund(100_000)).ok).toBe(true);
  expect((await refund(50_000)).ok).toBe(true);
  expect((await doneRefunds()).map((r) => r.amount)).toEqual([50_000, 100_000]);
});

/**
 * 잔액 환불에 0원은 아무 일도 하지 않는 성공이었다 — 토스를 부르지 않고, 예약은 이미
 * 취소돼 있고, orders 상태도 그대로인데 amount=0인 done 행만 남기고 ok를 돌려줬다.
 * 폼의 min=0이 실제로 허용하던 입력이다.
 */
it('0원 잔액 환불은 거절하고 기록도 남기지 않는다', async () => {
  await seedCancelledBooking();
  const r = await refund(0);
  expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
  expect(cancelPayment).not.toHaveBeenCalled();
  expect(await doneRefunds()).toEqual([{ id: 'r1', amount: 137_500 }]);
});

// 토스가 거절하면 선점 행은 failed로 남는다 — 잔액 계산(done만 셈)에 영향이 없고,
// 관리자가 재시도할 근거가 된다. 같은 금액 재시도가 막히지 않아야 한다는 뜻은 아니다.
it('토스가 거절하면 failed 행만 남고 orders 상태는 그대로다', async () => {
  await seedCancelledBooking();
  (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'NOT_CANCELABLE_AMOUNT', message: '초과' });
  const r = await refund(137_500);
  expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
  expect(await doneRefunds()).toEqual([{ id: 'r1', amount: 137_500 }]);
  const rows = await client.execute("SELECT COUNT(*) AS c FROM refunds WHERE status='failed'");
  expect(Number(rows.rows[0].c)).toBe(1);
  const o = await client.execute("SELECT status FROM orders WHERE id='o1'");
  expect(o.rows[0].status).toBe('partially_refunded');
});
