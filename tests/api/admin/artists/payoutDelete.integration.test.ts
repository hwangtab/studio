/** @jest-environment node */
/**
 * 이체 전(pending) 정산 기록 삭제 — 인증, 삭제 성공, 지급 완료 409, 없는 행 404.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
const mockAuth = jest.fn();
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: (...a: unknown[]) => mockAuth(...a) }));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/artists/payouts/[id]';
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
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterAll(() => client.close());
beforeEach(async () => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ ok: true });
  await client.execute('DELETE FROM artist_payouts');
});

const seed = (id: string, status: 'pending' | 'paid') =>
  client.execute({
    sql: `INSERT INTO artist_payouts (id, artist_slug, period, gross_amount, refund_amount, supply_amount, share_amount, withholding_amount, net_amount, subscriber_count, status, created_at, updated_at)
          VALUES (?, 'jai', '2026-09', 10000, 0, 9091, 8182, 269, 7913, 1, ?, 0, 0)`,
    args: [id, status],
  });

const call = async (id: string, body: unknown = { action: 'delete' }) => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method: 'POST', query: { id }, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: res.status.mock.calls[0][0] as number, res };
};
const count = async () => Number((await client.execute('SELECT count(*) AS c FROM artist_payouts')).rows[0].c);

it('로그인하지 않았으면 401이고 지우지 않는다', async () => {
  await seed('p1', 'pending');
  mockAuth.mockResolvedValue({ ok: false });
  expect((await call('p1')).status).toBe(401);
  expect(await count()).toBe(1);
});

it('이체 전 기록은 지워지고 no-store로 응답한다', async () => {
  await seed('p1', 'pending');
  const { status, res } = await call('p1');
  expect(status).toBe(200);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(await count()).toBe(0);
});

it('지급 완료 기록은 409로 거절하고 남겨 둔다', async () => {
  await seed('p1', 'paid');
  expect((await call('p1')).status).toBe(409);
  expect(await count()).toBe(1);
});

it('없는 기록은 404', async () => {
  expect((await call('nope')).status).toBe(404);
});

it('알 수 없는 action은 400', async () => {
  await seed('p1', 'pending');
  expect((await call('p1', { action: 'purge' })).status).toBe(400);
  expect(await count()).toBe(1);
});
