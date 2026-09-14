/** @jest-environment node */
/**
 * 지시받은 두 시나리오를 **토스 쪽 멱등 동작까지 흉내내어** 끝에서 끝까지 재현한다.
 * fake 토스는 (키 → 최초 응답)을 기억하고, 같은 키로 다시 오면 돈을 움직이지 않고 replay한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/booking/toss', () => ({ ...jest.requireActual('../../../../lib/booking/toss'), cancelPayment: jest.fn() }));
jest.mock('../../../../lib/booking/gcal', () => ({ deleteBookingEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../../lib/booking/email', () => ({
  sendBookingCancelledEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderCancelledEmails: jest.fn().mockResolvedValue(null),
}));

// eslint-disable-next-line import/first
import { cancelBookingWithRefund } from '../../../../lib/booking/cancel';
// eslint-disable-next-line import/first
import { cancelPayment } from '../../../../lib/booking/toss';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-08-20T00:00:00Z');
let client: Client;

/** 실제로 토스 계좌에서 빠져나간 금액의 총합 — replay는 여기에 더하지 않는다. */
let actuallyRefunded = 0;
const seenKeys = new Map<string, unknown>();

const fakeToss = jest.fn(async ({ idempotencyKey, cancelAmount }: { idempotencyKey: string; cancelAmount: number }) => {
  if (seenKeys.has(idempotencyKey)) return seenKeys.get(idempotencyKey); // replay — 돈이 안 나간다
  actuallyRefunded += cancelAmount;
  const res = { ok: true, payment: { paymentKey: 'pk', cancels: [{ transactionKey: `ck${seenKeys.size}`, cancelAmount }] } };
  seenKeys.set(idempotencyKey, res);
  return res;
});

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
  for (const t of ['refunds', 'payments', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  actuallyRefunded = 0; seenKeys.clear(); jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (cancelPayment as jest.Mock).mockImplementation(fakeToss);
});
afterEach(() => jest.restoreAllMocks());

const START = Math.floor(NOW.getTime() / 1000) + 24 * 60 * 60; // 내일 = 50% 티어

/** 275,000원 확정 예약 하나. */
const seedConfirmed = async () => {
  await client.execute(`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone,
      customer_email, manage_token, item_amount, vat_amount, total_amount, created_at, updated_at)
    VALUES ('o1','SNB-1','session','paid','김보컬','010-1','a@b.c','tok',250000,25000,275000,unixepoch(),unixepoch())`);
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours,
            status, created_at, updated_at)
          VALUES ('b1','o1','recording-pro','recording',?,?,3,'confirmed',unixepoch(),unixepoch())`,
    args: [START, START + 10800],
  });
  await client.execute("INSERT INTO payments (id, order_id, payment_key, method) VALUES ('p1','o1','pk','카드')");
};

const ledger = async () => {
  const r = await client.execute("SELECT COALESCE(SUM(amount),0) AS s FROM refunds WHERE status='done'");
  const o = await client.execute("SELECT status FROM orders WHERE id='o1'");
  return { recorded: Number(r.rows[0].s), orderStatus: String(o.rows[0].status) };
};

it('(a) 1차 50% 취소 → 같은 금액 잔액 환불: replay되지 않고 실제로 돈이 나간다', async () => {
  await seedConfirmed();

  // 1차: 고객 셀프 취소 → 50% 티어 137,500
  const first = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 취소', now: NOW });
  expect(first).toMatchObject({ ok: true, refundAmount: 137_500 });
  expect(actuallyRefunded).toBe(137_500);

  // 2차: 관리자가 잔액 137,500을 마저 환불 — 금액이 1차와 **같다**
  const second = await cancelBookingWithRefund({
    orderNo: 'SNB-1', requestedBy: 'admin', reason: '호의 환불', overrideAmount: 137_500, now: NOW,
  });
  expect(second).toMatchObject({ ok: true, refundAmount: 137_500 });

  // 핵심: 토스에서 실제로 275,000이 빠져나가야 한다. replay되면 137,500에 머문다.
  expect(actuallyRefunded).toBe(275_000);
  expect(await ledger()).toEqual({ recorded: 275_000, orderStatus: 'refunded' });
});

it('(b) 타임아웃 뒤 같은 금액 재시도: 허용되고 replay로 이중 환불을 막는다', async () => {
  await seedConfirmed();
  await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 취소', now: NOW });
  expect(actuallyRefunded).toBe(137_500);

  // 토스는 취소했는데 응답만 못 받은 경우 — 돈은 나갔고 우리는 NETWORK_ERROR를 본다.
  (cancelPayment as jest.Mock).mockImplementationOnce(async (args: { idempotencyKey: string; cancelAmount: number }) => {
    await fakeToss(args); // 실제로는 처리됨
    return { ok: false, code: 'NETWORK_ERROR', message: 'timeout' };
  });
  const attempt = await cancelBookingWithRefund({
    orderNo: 'SNB-1', requestedBy: 'admin', reason: '호의 환불', overrideAmount: 137_500, now: NOW,
  });
  expect(attempt).toMatchObject({ ok: false, code: 'toss_failed' });
  expect(actuallyRefunded).toBe(275_000); // 돈은 이미 나갔다

  // 운영자가 **같은 금액으로** 재시도 — 막히지 않아야 하고, 돈이 또 나가면 안 된다.
  const retry = await cancelBookingWithRefund({
    orderNo: 'SNB-1', requestedBy: 'admin', reason: '호의 환불', overrideAmount: 137_500, now: NOW,
  });
  expect(retry.ok).toBe(true);
  expect(actuallyRefunded).toBe(275_000); // replay — 이중 환불 없음
  expect(await ledger()).toEqual({ recorded: 275_000, orderStatus: 'refunded' });
});
