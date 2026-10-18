/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { purgeEndedTenancies } from './retention';
/* eslint-enable import/first */

let client: Client;
const one = async (q: string) => (await client.execute(q)).rows[0] as Record<string, unknown> | undefined;

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

const ins = (id: string, status: string, endedOn: string | null) =>
  client.execute({
    sql: `INSERT INTO room_tenancies (id, kind, room_number, tenant_name, status, monthly_amount, start_date, ended_on, billing_day, next_due_on, private_enc)
          VALUES (?, 'room', ?, ?, ?, 1, '2020-01-01', ?, 1, '2030-01-01', 'v2:x')`,
    args: [id, `R${id.slice(1).padStart(2, '0')}`, id, status, endedOn],
  });

it('퇴실 3년이면 개인정보를 비우고 5년이면 기록을 지우며, 입주 중·최근 퇴실은 건드리지 않는다', async () => {
  const now = new Date('2026-10-18T00:00:00Z');
  await ins('t1', 'active', null);
  await ins('t2', 'ended', '2026-01-01'); // 최근 퇴실
  await ins('t3', 'ended', '2023-10-17'); // 3년 지남
  await ins('t4', 'ended', '2021-10-17'); // 5년 지남
  await client.execute(`INSERT INTO room_tenancy_payments (id, tenancy_id, paid_on, amount) VALUES ('p4', 't4', '2021-01-01', 1), ('p3', 't3', '2023-01-01', 1)`);
  expect(await purgeEndedTenancies(now)).toEqual({ personalCleared: 2, recordsDeleted: 1 });
  expect((await one(`SELECT private_enc FROM room_tenancies WHERE id = 't1'`))?.private_enc).toBe('v2:x');
  expect((await one(`SELECT private_enc FROM room_tenancies WHERE id = 't2'`))?.private_enc).toBe('v2:x');
  expect((await one(`SELECT private_enc FROM room_tenancies WHERE id = 't3'`))?.private_enc).toBeNull();
  expect(await one(`SELECT id FROM room_tenancies WHERE id = 't4'`)).toBeUndefined();
  expect(await one(`SELECT id FROM room_tenancy_payments WHERE id = 'p4'`)).toBeUndefined();
  expect(await one(`SELECT id FROM room_tenancy_payments WHERE id = 'p3'`)).toBeDefined();
});
