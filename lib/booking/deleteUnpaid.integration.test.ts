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
  for (const t of ['review_requests', 'refund_accounts', 'payments', 'payment_window_opens', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const DAY = 24 * 60 * 60;
const seed = async (id: string, status: string, gcal: string | null = null, ageSeconds = 0) => {
  await client.execute(
    `INSERT INTO orders (id, order_no, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token, status, created_at)
     VALUES ('o-${id}', 'SNB-${id}', 'session', '고객', '-', 'a@b.c', 100, 10, 110, 't-${id}', '${status}', unixepoch() - ${ageSeconds})`,
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

  it('결제창을 열었다가 끝내지 않은 만료·실패 주문은 하루가 지나면 지운다', async () => {
    await seed('e', 'expired', null, DAY + 60);
    await seed('f', 'failed', null, 2 * DAY);
    await client.execute(`INSERT INTO payment_window_opens (order_id, first_opened_at, last_opened_at, browser) VALUES ('o-e', 1, 1, 'chrome')`);
    expect(await deleteUnpaidCancelledOrder('o-e')).toEqual({ ok: true, orderNo: 'SNB-e' });
    expect(await deleteUnpaidCancelledOrder('o-f')).toEqual({ ok: true, orderNo: 'SNB-f' });
    expect(await count('orders')).toBe(0);
    expect(await count('payment_window_opens')).toBe(0);
  });

  it('만료된 지 하루가 안 된 주문은 늦은 결제 승인을 기다려 지우지 않는다', async () => {
    await seed('n', 'expired', null, 60 * 60);
    expect(await deleteUnpaidCancelledOrder('o-n')).toMatchObject({ ok: false, code: 'not_allowed', message: expect.stringMatching(/하루/) });
    expect(await count('orders')).toBe(1);
  });

  it('만료 주문이라도 결제 행이 있으면(늦게 승인된 결제) 지우지 않는다', async () => {
    await seed('l', 'expired', null, 2 * DAY);
    await client.execute(`INSERT INTO payments (id, order_id, payment_key) VALUES ('pay-l', 'o-l', 'k')`);
    expect(await deleteUnpaidCancelledOrder('o-l')).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await count('orders')).toBe(1);
  });
});
