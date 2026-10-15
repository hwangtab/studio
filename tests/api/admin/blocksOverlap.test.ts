/** @jest-environment node */
/**
 * 예약 불가 블록은 새 예약만 막는다. 이미 잡힌 예약과 겹치면 등록은 되되 응답이 그 사실을 알려야 한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }) }));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/admin/blocks/index';
import { kstDateTime } from '../../../lib/booking/kst';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
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
  for (const t of ['bookings', 'orders', 'availability_blocks']) await client.execute(`DELETE FROM ${t}`);
});

const DATE = '2030-06-10';
const epoch = (hour: number) => Math.floor(kstDateTime(DATE, hour).getTime() / 1000);

const insertBooking = async (id: string, startHour: number, endHour: number, opts: { status?: string; orderStatus?: string; room?: string | null } = {}) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, 'session', ?, ?, '010', 'a@b.c', ?, 100, 10, 110)`,
    args: [id, `NO-${id}`, opts.orderStatus ?? 'paid', `고객-${id}`, `tok-${id}`],
  });
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status, room_number)
          VALUES (?, ?, 'recording-pro', 'recording', ?, ?, ?, ?, ?)`,
    args: [`b-${id}`, id, epoch(startHour), epoch(endHour), endHour - startHour, opts.status ?? 'confirmed', opts.room ?? null],
  });
};

const post = async (body: Record<string, unknown>) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method: 'POST', body, query: {}, headers: {} } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as { ok: boolean; overlapping?: Array<{ orderNo: string }> } };
};

it('겹치는 예약이 있어도 블록은 등록되고, 겹친 예약을 알려 준다', async () => {
  await insertBooking('a', 14, 17); // 겹침
  await insertBooking('b', 17, 19); // 맞닿기만 함 — 겹침 아님
  await insertBooking('c', 10, 12); // 다른 시간
  await insertBooking('d', 15, 16, { status: 'cancelled' }); // 취소됨
  await insertBooking('e', 15, 16, { status: 'confirmed', room: 'R05' }); // 녹음실과 무관한 방

  const r = await post({ date: DATE, startHour: 13, endHour: 17 });

  expect(r.status).toBe(201);
  expect(r.body.overlapping?.map((o) => o.orderNo)).toEqual(['NO-a']);
  expect((await client.execute('SELECT COUNT(*) AS n FROM availability_blocks')).rows[0].n).toBe(1);
});

it('계좌 입금 대기 예약도 시간대를 잡고 있으므로 겹침으로 알린다', async () => {
  await insertBooking('w', 14, 17, { status: 'pending', orderStatus: 'awaiting_deposit' });
  const r = await post({ date: DATE, startHour: 13, endHour: 17 });
  expect(r.body.overlapping?.map((o) => o.orderNo)).toEqual(['NO-w']);
});

it('겹치는 예약이 없으면 빈 목록', async () => {
  const r = await post({ date: DATE, startHour: 13, endHour: 17 });
  expect(r.status).toBe(201);
  expect(r.body.overlapping).toEqual([]);
});

it('R02 블록은 녹음실 예약과도 겹친다(STUDIO_SHARED_ROOMS)', async () => {
  await insertBooking('s', 14, 17, { room: null });
  const r = await post({ date: DATE, startHour: 13, endHour: 17, roomNumber: 'R02' });
  expect(r.body.overlapping?.map((o) => o.orderNo)).toEqual(['NO-s']);
});
