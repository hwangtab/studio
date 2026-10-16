/** @jest-environment node */
/**
 * 이미 잡힌 예약 위에 블록을 걸면 예전엔 말없이 성공했다 — 예약은 남은 채 그 시간만 "휴무"가 됐다.
 * 같은 자원을 점유하는 예약이 겹치면 409(conflicts)로 멈추고, force일 때만 통과한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/admin/blocks/index';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
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
  for (const t of ['availability_blocks', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

const seedBooking = async (room: string | null, status = 'confirmed') => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token)
          VALUES ('o1','SNB-1','session','paid','홍길동','010','a@b.c',100,10,110,'tok')`,
    args: [],
  });
  // KST 2026-11-20 14:00~17:00 (= 05:00~08:00Z)
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, room_number, status, start_at, end_at, duration_hours)
          VALUES ('b1','o1','recording-pro','recording',?,?,?,?,3)`,
    args: [room, status, EPOCH('2026-11-20T05:00:00Z'), EPOCH('2026-11-20T08:00:00Z')],
  });
};

const post = async (body: Record<string, unknown>) => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method: 'POST', body, headers: {} } as unknown as NextApiRequest, res);
  return { status: res.status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};
const blockCount = async () => Number((await client.execute('SELECT COUNT(*) AS n FROM availability_blocks')).rows[0].n);
const base = { date: '2026-11-20', startHour: 15, endHour: 16 };

it('겹치는 확정 예약이 있으면 409와 주문번호 목록을 주고 블록을 만들지 않는다', async () => {
  await seedBooking(null);
  const r = await post(base);
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ code: 'conflicts', conflicts: [{ orderNo: 'SNB-1' }] });
  expect(r.body.conflicts[0]).not.toHaveProperty('customerName');
  expect(await blockCount()).toBe(0);
});

it('force면 알고도 걸 수 있다', async () => {
  await seedBooking(null);
  expect((await post({ ...base, force: true })).status).toBe(201);
  expect(await blockCount()).toBe(1);
});

it('겹치지 않거나, 다른 자원(방)이거나, 이미 취소된 예약이면 그냥 만든다', async () => {
  await seedBooking(null);
  expect((await post({ ...base, startHour: 18, endHour: 19 })).status).toBe(201); // 시간이 안 겹침
  expect((await post({ ...base, roomNumber: 'R05' })).status).toBe(201); // 녹음실 예약은 R05를 점유하지 않는다
  await client.execute(`UPDATE bookings SET status = 'cancelled'`);
  expect((await post({ ...base, startHour: 14, endHour: 17 })).status).toBe(201);
});

it('계좌 입금 대기 예약도 시간을 점유하므로 겹침으로 본다', async () => {
  await seedBooking(null, 'pending');
  await client.execute(`UPDATE orders SET status = 'awaiting_deposit'`);
  expect((await post(base)).status).toBe(409);
});
