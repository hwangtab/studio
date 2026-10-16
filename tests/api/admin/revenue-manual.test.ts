/** @jest-environment node */
/** 수기 매출 API — 인증·입력 검증·환불 변경 이력·소프트 삭제(누가 지웠는지 남고 이후 조회에서 빠진다). */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
const authMock = jest.fn();
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: (...a: unknown[]) => authMock(...a) }));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/admin/revenue/manual';
import { loadManualRevenueRows } from '../../../lib/ops/manualRevenue';
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
  await client.execute('DELETE FROM manual_revenues');
  authMock.mockReset().mockResolvedValue({ ok: true, actor: 'kyungha' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const call = async (method: string, body?: unknown) => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method, body, headers: {} } as unknown as NextApiRequest, res);
  return { status: res.status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};
const VALID = { receivedOn: '2026-10-01', type: 'session', description: '녹음 3시간', totalAmount: 275000, vatMode: 'included', method: '계좌 입금' };
const RANGE = { from: new Date('2026-09-30T00:00:00Z'), toExclusive: new Date('2026-10-31T00:00:00Z') };
const row = async (id: string) => (await client.execute({ sql: 'SELECT * FROM manual_revenues WHERE id = ?', args: [id] })).rows[0];

it('세션이 없으면 401이고 아무것도 쓰지 않는다', async () => {
  authMock.mockResolvedValue({ ok: false });
  expect((await call('POST', VALID)).status).toBe(401);
  expect(Number((await client.execute('SELECT COUNT(*) AS n FROM manual_revenues')).rows[0].n)).toBe(0);
});

it('등록은 201과 id, 입력이 틀리면 400, 허용하지 않는 메서드는 405', async () => {
  const ok = await call('POST', VALID);
  expect(ok.status).toBe(201);
  expect(await row(ok.body.id)).toMatchObject({ total_amount: 275000, vat_amount: 25000, created_by: 'kyungha' });
  expect((await call('POST', { ...VALID, totalAmount: 0 })).status).toBe(400);
  expect((await call('POST', { ...VALID, receivedOn: '2099-01-01' })).status).toBe(400);
  expect((await call('GET')).status).toBe(405);
});

it('환불을 고치면 메모에 누가·얼마→얼마가 남고, 총액을 넘으면 400이다', async () => {
  const { body } = await call('POST', VALID);
  expect((await call('PATCH', { id: body.id, refundedAmount: 75000 })).status).toBe(200);
  expect(String((await row(body.id)).memo)).toMatch(/\[환불 0→75,000원 · kyungha · \d{4}-\d{2}-\d{2}\]/);
  expect((await call('PATCH', { id: body.id, refundedAmount: 999999999 })).status).toBe(400);
  expect((await call('PATCH', { id: 'nope', refundedAmount: 1 })).status).toBe(404);
  expect((await call('PATCH', { id: body.id })).status).toBe(400);
});

it('삭제는 행을 지우지 않고 누가·언제를 남기며, 이후 조회에서 빠지고 두 번째 삭제는 404다', async () => {
  const { body } = await call('POST', VALID);
  expect(await loadManualRevenueRows(RANGE)).toHaveLength(1);

  expect((await call('DELETE', { id: body.id })).status).toBe(200);
  const kept = await row(body.id);
  expect(kept).toMatchObject({ deleted_by: 'kyungha' });
  expect(kept.deleted_at).not.toBeNull();
  expect(await loadManualRevenueRows(RANGE)).toHaveLength(0);

  authMock.mockResolvedValue({ ok: true, actor: 'other' });
  expect((await call('DELETE', { id: body.id })).status).toBe(404);
  expect(await row(body.id)).toMatchObject({ deleted_by: 'kyungha' }); // 처음 지운 사람의 기록이 덮이지 않는다
  expect((await call('PATCH', { id: body.id, refundedAmount: 1 })).status).toBe(404); // 지운 행은 고칠 수 없다
});
