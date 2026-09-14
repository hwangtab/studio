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
// eslint-disable-next-line import/first
import { refundIdempotencyKey } from './cancel';

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

/**
 * 동시 2건이 지켜야 하는 것은 "한 건만 ok"가 아니라 **원장이 한 번만 세는 것**이다.
 *
 * 둘 다 같은 선점 행(refunds.id)을 공유하고 같은 멱등키로 토스를 부르므로, 실제 취소도
 * 원장 기록도 한 번뿐이다. 두 탭이 모두 성공을 보는 것은 거짓이 아니다 — 환불은 실제로
 * (한 번) 일어났다. 예전 구조는 done 행을 2건 쌓아 환불액을 2배로 계상했고, 그러면
 * remainingRefundable이 0으로 눌려 이후의 정당한 잔액 환불이 영영 막혔다.
 */
it('같은 금액의 잔액 환불 2건이 동시에 와도 원장은 한 번만 센다', async () => {
  await seedCancelledBooking();
  const [a, b] = await Promise.all([refund(137_500), refund(137_500)]);
  expect([a.ok, b.ok]).toEqual([true, true]);

  // done 행은 첫 취소분(r1) + 이번 1건뿐 — 잔액 환불이 2행으로 늘면 이중 계상이다.
  expect(await doneRefunds()).toEqual([
    { id: expect.any(String), amount: 137_500 },
    { id: expect.any(String), amount: 137_500 },
  ]);
  const total = await client.execute('SELECT COUNT(*) AS c FROM refunds');
  expect(Number(total.rows[0].c)).toBe(2);

  // 두 요청이 같은 멱등키를 써야 토스도 한 번만 취소한다.
  const keys = (cancelPayment as jest.Mock).mock.calls.map((c) => c[0].idempotencyKey);
  expect(new Set(keys).size).toBe(1);
});

/**
 * **잔액이 남은 상태**로 봐야 선점이 증명된다. 예전 seed(잔액 137,500 전액 환불)는 1차 성공으로
 * remaining이 0이 되어 validateOverrideAmount가 먼저 거절했다 — 선점을 제거해도 통과하는
 * 무효 테스트였다. 총액 275,000에서 100,000씩 두 번이면 두 번째 시점에도 잔액이 175,000 남는다.
 */
it('이미 done으로 기록된 금액은 다시 환불되지 않는다 — 잔액이 남아 있어도', async () => {
  await seedCancelledBooking({ refunded: 0, orderStatus: 'paid' });
  expect((await refund(100_000)).ok).toBe(true);

  const second = await refund(100_000);
  expect(second).toMatchObject({ ok: false, code: 'invalid_state' });
  // 잔액이 막아 준 것이 아니라 **선점**이 막았다는 것을 분명히 한다.
  expect(second.ok === false && second.message).toContain('이미 환불되어');
  expect((await doneRefunds()).map((r) => r.amount)).toEqual([100_000]);
});

/**
 * [HIGH] 잔액 환불이 **1차 취소의 멱등키를 재사용하면 고객이 돈을 못 받는다.**
 *
 * 275,000원 예약을 50% 티어로 137,500 취소하면 멱등키 `refund:SNB-1:137500`이 쓰인다.
 * 이어서 잔액 137,500을 환불할 때 같은 키가 만들어지면 토스는 15일간 1차 취소를 replay한다 —
 * **돈은 안 나가고 성공 응답만 오고**, 우리는 done 행을 하나 더 쌓아 주문을 refunded로 올린다.
 * 고객은 137,500원을 덜 받았는데 원장은 전액 환불이라고 말한다.
 *
 * 목으로는 안 드러나는 종류라 **멱등키 문자열 자체**를 단언한다.
 */
it('잔액 환불의 멱등키는 1차 취소의 키와 겹치지 않는다', async () => {
  await seedCancelledBooking(); // 1차 취소 137,500이 이미 나간 상태
  expect((await refund(137_500)).ok).toBe(true);

  const sent = (cancelPayment as jest.Mock).mock.calls.at(-1)![0];
  // 1차 취소(고객 셀프)가 썼을 키 — 접두사가 갈리지 않으면 이 값과 같아진다.
  expect(sent.idempotencyKey).not.toBe(refundIdempotencyKey('SNB-1', 137_500));
  expect(sent.idempotencyKey).toBe(refundIdempotencyKey('SNB-1', 137_500, 'remainder'));
});

// 선점 키(refunds.id)와 멱등키가 **문자 그대로 같아야** 두 범위가 일치한다.
it('선점 키와 멱등키가 같은 문자열이다', async () => {
  await seedCancelledBooking();
  expect((await refund(137_500)).ok).toBe(true);
  const sent = (cancelPayment as jest.Mock).mock.calls.at(-1)![0];
  const rows = await client.execute("SELECT id FROM refunds WHERE status='done' AND id != 'r1'");
  expect(String(rows.rows[0].id)).toBe(sent.idempotencyKey);
});

/**
 * [HIGH] 타임아웃 뒤 **같은 금액 재시도**는 허용되어야 한다.
 *
 * cancelPayment의 NETWORK_ERROR는 "요청이 안 닿았다"와 "토스는 취소했는데 응답만 못 받았다"를
 * 구분하지 못한다. 같은 금액 재시도는 멱등키가 replay로 보호하는 **유일하게 안전한 경로**다.
 * 그걸 막으면 운영자는 금액을 1원 바꿔 넣고, 그건 새 멱등키라 토스가 실제로 두 번째 취소를
 * 승인한다 — 우리가 이중 환불을 유도하는 꼴이 된다.
 */
it('네트워크 오류 뒤 같은 금액 재시도가 허용되고, 같은 멱등키로 replay 보호를 받는다', async () => {
  await seedCancelledBooking();
  (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });

  const first = await refund(137_500);
  expect(first).toMatchObject({ ok: false, code: 'toss_failed' });

  const retry = await refund(137_500);
  expect(retry.ok).toBe(true);

  const keys = (cancelPayment as jest.Mock).mock.calls.map((c) => c[0].idempotencyKey);
  expect(keys).toEqual([keys[0], keys[0]]); // 두 번 다 같은 키 — 토스가 replay한다
  // 원장에는 선점 행 하나가 failed → done으로 올라갔을 뿐이다.
  expect((await doneRefunds()).map((r) => r.amount)).toEqual([137_500, 137_500]);
  const total = await client.execute('SELECT COUNT(*) AS c FROM refunds');
  expect(Number(total.rows[0].c)).toBe(2); // 첫 취소 r1 + 잔액 환불 1건
});

// 재시도 안내가 "금액을 달리해 주세요"이면 안 된다 — 그 지시가 이중 환불을 만든다.
it('재시도 안내가 금액 변경을 권하지 않는다', async () => {
  await seedCancelledBooking({ refunded: 0, orderStatus: 'paid' });
  await refund(100_000);
  const second = await refund(100_000);
  expect(second.ok === false && second.message).not.toContain('금액을 달리');
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
