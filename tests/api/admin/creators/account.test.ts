/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

jest.mock('../../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/revalidate', () => ({ revalidateFundingPaths: jest.fn() }));
jest.mock('../../../../lib/funding/creatorEmail', () => ({
  sendCreatorNameChangedEmail: jest.fn(),
  sendCreatorEmailChangedEmails: jest.fn(),
  sendCreatorAccountOperatorFallback: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../../../db/schema';
import { getDb } from '../../../../db/client';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { sendCreatorEmailChangedEmails, sendCreatorNameChangedEmail } from '../../../../lib/funding/creatorEmail';
import { revalidateFundingPaths } from '../../../../lib/funding/revalidate';
import handler from '../../../../pages/api/admin/creators/[creatorId]/account';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let db: ReturnType<typeof drizzle<typeof schema>>;

const call = async (method: string, creatorId: unknown, body?: unknown) => {
  const out: { status: number; json: Record<string, unknown> } = { status: 0, json: {} };
  const res = {
    setHeader: jest.fn(),
    status(code: number) { out.status = code; return this; },
    json(v: Record<string, unknown>) { out.json = v; return this; },
  } as unknown as NextApiResponse;
  await handler({ method, query: { creatorId }, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return out;
};

const seedCreator = async (email: string, name = '옛이름'): Promise<string> => {
  const [creator] = await db.insert(schema.fundingCreators).values({ email, name }).returning();
  return creator.id;
};
const readCreator = async (id: string) =>
  (await db.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, id)))[0];

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  db = drizzle(client, { schema });
  jest.clearAllMocks();
  (getDb as jest.Mock).mockReturnValue(db);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
  (sendCreatorNameChangedEmail as jest.Mock).mockResolvedValue(null);
  (sendCreatorEmailChangedEmails as jest.Mock).mockResolvedValue(null);
  (revalidateFundingPaths as jest.Mock).mockResolvedValue(null);
});

afterEach(() => {
  client.close();
  jest.restoreAllMocks();
});

it('인증 없으면 401이고 아무것도 바꾸지 않는다', async () => {
  const id = await seedCreator('a@example.com');
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call('POST', id, { action: 'set_creator_email', value: 'b@example.com', reason: '분실' });
  expect(r.status).toBe(401);
  expect((await readCreator(id)).email).toBe('a@example.com');
});

it('POST가 아니면 405, 알 수 없는 action이면 400', async () => {
  const id = await seedCreator('a@example.com');
  expect((await call('GET', id)).status).toBe(405);
  expect((await call('POST', id, { action: 'drop', value: 'x', reason: 'y' })).status).toBe(400);
});

it('이메일을 바꾸면 session_version이 오르고 로그인 토큰이 지워지며 옛·새 주소에 알린다', async () => {
  const id = await seedCreator('a@example.com');
  await db.insert(schema.fundingCreatorTokens).values({ tokenHash: 'h1', creatorId: id, expiresAt: new Date('2099-01-01T00:00:00Z') });
  const before = await readCreator(id);
  const r = await call('POST', id, { action: 'set_creator_email', value: 'New@Example.com', reason: '메일함 분실' });
  expect(r.status).toBe(200);
  const after = await readCreator(id);
  expect(after.email).toBe('new@example.com');
  expect(after.sessionVersion).toBe(before.sessionVersion + 1);
  expect(await db.select().from(schema.fundingCreatorTokens).where(eq(schema.fundingCreatorTokens.creatorId, id))).toHaveLength(0);
  expect(sendCreatorEmailChangedEmails).toHaveBeenCalledWith('a@example.com', 'new@example.com', '메일함 분실');
});

it('다른 개설자가 쓰는 이메일이면 400이고 아무것도 바뀌지 않는다', async () => {
  const id = await seedCreator('a@example.com');
  await seedCreator('taken@example.com', '다른사람');
  const before = await readCreator(id);
  const r = await call('POST', id, { action: 'set_creator_email', value: 'taken@example.com', reason: '정정' });
  expect(r.status).toBe(400);
  const after = await readCreator(id);
  expect(after.email).toBe('a@example.com');
  expect(after.sessionVersion).toBe(before.sessionVersion);
  expect(sendCreatorEmailChangedEmails).not.toHaveBeenCalled();
});

it('이름을 바꿔도 session_version은 오르지 않는다', async () => {
  const id = await seedCreator('a@example.com');
  const before = await readCreator(id);
  const r = await call('POST', id, { action: 'set_creator_name', value: '새이름', reason: '오타' });
  expect(r.status).toBe(200);
  const after = await readCreator(id);
  expect(after.name).toBe('새이름');
  expect(after.sessionVersion).toBe(before.sessionVersion);
  expect(sendCreatorNameChangedEmail).toHaveBeenCalled();
});

it('사유가 없으면 400, 없는 개설자면 404', async () => {
  const id = await seedCreator('a@example.com');
  expect((await call('POST', id, { action: 'set_creator_name', value: '새이름', reason: ' ' })).status).toBe(400);
  expect((await call('POST', 'nope', { action: 'set_creator_name', value: '새이름', reason: '사유' })).status).toBe(404);
});
