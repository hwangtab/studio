/** @jest-environment node */
/** 입금 전 취소 기록 삭제 — 돈이 오간 적 없는 것만 지운다. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { deleteUnpaidCancelledOrder } from './deleteUnpaid';
/* eslint-enable import/first */

let client: Client;
const count = async (t: string) => Number(((await client.execute(`SELECT COUNT(*) c FROM ${t}`)).rows[0] as Record<string, unknown>).c);

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(path.join(process.cwd(), 'drizzle/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(process.cwd(), 'drizzle/migrations', file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  for (const t of ['review_requests', 'refund_accounts', 'payments', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const seed = async (id: string, status: string, gcal: string | null = null) => {
  await client.execute(
    `INSERT INTO orders (id, order_no, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token, status)
     VALUES ('o-${id}', 'SNB-${id}', 'session', '고객', '-', 'a@b.c', 100, 10, 110, 't-${id}', '${status}')`,
  );
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status, gcal_event_id)
          VALUES (?, ?, 'recording-pro', 'recording', 1000, 2000, 3, 'cancelled', ?)`,
    args: [`b-${id}`, `o-${id}`, gcal],
  });
};

describe('deleteUnpaidCancelledOrder', () => {
  it('입금 전 취소 기록을 예약과 함께 지운다', async () => {
    await seed('a', 'deposit_cancelled');
    expect(await deleteUnpaidCancelledOrder('o-a')).toEqual({ ok: true, orderNo: 'SNB-a' });
    expect(await count('orders')).toBe(0);
    expect(await count('bookings')).toBe(0);
  });

  it('입금 대기·결제 완료 주문은 지우지 않는다', async () => {
    await seed('w', 'awaiting_deposit');
    await seed('p', 'paid');
    expect(await deleteUnpaidCancelledOrder('o-w')).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await deleteUnpaidCancelledOrder('o-p')).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await count('orders')).toBe(2);
  });

  it('결제 행이 있거나 캘린더 일정이 남아 있으면 지우지 않는다', async () => {
    await seed('x', 'deposit_cancelled');
    await client.execute(`INSERT INTO payments (id, order_id, payment_key) VALUES ('pay-x', 'o-x', 'k')`);
    expect(await deleteUnpaidCancelledOrder('o-x')).toMatchObject({ ok: false, code: 'not_allowed' });
    await seed('g', 'deposit_cancelled', 'evt-1');
    expect(await deleteUnpaidCancelledOrder('o-g')).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await deleteUnpaidCancelledOrder('nope')).toMatchObject({ ok: false, code: 'not_found' });
  });
});
