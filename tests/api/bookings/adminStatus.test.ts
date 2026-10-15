/** @jest-environment node */
/**
 * 관리자 PATCH 완료·노쇼 — 시작 전 세션을 닫지 못하고, 시작 뒤에는 한 번만 전이한다.
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
import adminHandler from '../../../pages/api/admin/bookings/[id]';
import listHandler from '../../../pages/api/admin/bookings/index';
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
  for (const t of ['bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;
const call = async (handler: Handler, req: { method: string; body?: unknown; query?: Record<string, string> }) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method: req.method, body: req.body, query: req.query ?? {}, headers: {} } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] as Record<string, unknown> };
};

const insertSession = async (id: string, startOffsetHours: number, type = 'session') => {
  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, ?, 'paid', '홍길동', '010', 'a@b.c', ?, 100, 10, 110)`,
    args: [id, `NO-${id}`, type, `tok-${id}`],
  });
  if (type !== 'session') return;
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status)
          VALUES (?, ?, 'recording-pro', 'recording', ?, ?, 3, 'confirmed')`,
    args: [`b-${id}`, id, now + startOffsetHours * 3600, now + (startOffsetHours + 3) * 3600],
  });
};
const patch = (id: string, status: string) => call(adminHandler as Handler, { method: 'PATCH', body: { status }, query: { id } });
const bookingStatus = async (id: string) => (await client.execute({ sql: 'SELECT status FROM bookings WHERE order_id = ?', args: [id] })).rows[0].status;

describe('PATCH 완료·노쇼', () => {
  it('아직 시작하지 않은 예약은 완료·노쇼로 바꿀 수 없다', async () => {
    await insertSession('future', 5);
    for (const status of ['completed', 'no_show']) {
      const r = await patch('future', status);
      expect(r.status).toBe(409);
    }
    expect(await bookingStatus('future')).toBe('confirmed');
  });

  it('시작한 예약은 노쇼·완료로 바꾼다 — 두 번째는 409', async () => {
    await insertSession('started', -1);
    expect((await patch('started', 'no_show')).status).toBe(200);
    expect(await bookingStatus('started')).toBe('no_show');
    expect((await patch('started', 'completed')).status).toBe(409);
  });
});

describe('GET /api/admin/bookings', () => {
  it('예약 모집단(session·mixing)만 싣는다 — 후원·구독·티켓 주문은 섞지 않는다', async () => {
    await insertSession('s1', -1);
    await insertSession('m1', 0, 'mixing');
    await insertSession('f1', 0, 'funding');
    await insertSession('t1', 0, 'ticket');

    const r = await call(listHandler as Handler, { method: 'GET' });

    expect(r.status).toBe(200);
    expect((r.body.bookings as Array<{ orderType: string }>).map((b) => b.orderType).sort()).toEqual(['mixing', 'session']);
  });
});
