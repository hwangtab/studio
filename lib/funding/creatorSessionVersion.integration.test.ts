/**
 * @jest-environment node
 *
 * H1 — 운영자가 로그인 주소를 바꾸면 **이미 발급된** 개설자 쿠키도 죽어야 한다.
 *
 * `creatorSession`을 대역으로 갈아 끼워 iron-session 암복호를 건너뛴다. 여기서 보려는 것은
 * 쿠키 직렬화가 아니라 "쿠키에 실린 판본과 DB 판본을 대조하는가"다.
 */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import type { CreatorSessionData } from './creatorSession';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

type FakeSession = CreatorSessionData & { save: () => Promise<void>; destroy: () => void };
let fakeSession: FakeSession;
jest.mock('./creatorSession', () => ({
  getCreatorSession: async () => fakeSession,
  getCreatorSessionFromContext: async () => fakeSession,
}));

// eslint-disable-next-line import/first
import { decideCreatorAccount } from './creatorAccountDecision';
// eslint-disable-next-line import/first
import { authenticateCreatorApi, loginCreatorSession } from './creatorAuth';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const makeSession = (data: CreatorSessionData = {}): FakeSession => ({
  ...data,
  save: async () => {},
  destroy: () => { delete fakeSession.creatorId; delete fakeSession.sessionVersion; },
});

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  fakeSession = makeSession();
});

afterEach(() => client.close());

const REASON = '탈취 신고';

const seed = async (): Promise<{ creatorId: string; projectId: string }> => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ email: 'creator@example.com', name: '개설자' }).returning();
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    creatorId: creator.id,
    slug: `slug-${crypto.randomUUID()}`,
    title: '제목',
    summary: '요약',
    content: '본'.repeat(210),
    coverUrl: '/uploads/funding/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date('2026-10-01T00:00:00+09:00'),
    endAt: new Date('2026-10-31T00:00:00+09:00'),
    reviewStatus: 'submitted',
  }).returning();
  return { creatorId: creator.id, projectId: project.id };
};

const readVersion = async (creatorId: string): Promise<number> => {
  const [row] = await mockDb.select().from(schema.fundingCreators)
    .where(eq(schema.fundingCreators.id, creatorId));
  return row.sessionVersion;
};

const req = {} as never;
const res = {} as never;

it('이메일 변경은 판본을 올리고, 변경 전에 받은 쿠키는 더 이상 통하지 않는다', async () => {
  const { creatorId, projectId } = await seed();
  await loginCreatorSession(req, res, creatorId);
  expect(await authenticateCreatorApi(req, res)).toEqual({ ok: true, creatorId });

  const result = await decideCreatorAccount(projectId, 'set_creator_email', { value: 'new@example.com', reason: REASON });
  expect(result.ok).toBe(true);
  expect(await readVersion(creatorId)).toBe(2);

  expect(await authenticateCreatorApi(req, res)).toEqual({ ok: false });
});

it('변경 뒤 새로 로그인하면 통과한다', async () => {
  const { creatorId, projectId } = await seed();
  await decideCreatorAccount(projectId, 'set_creator_email', { value: 'new@example.com', reason: REASON });

  await loginCreatorSession(req, res, creatorId);
  expect(fakeSession.sessionVersion).toBe(2);
  expect(await authenticateCreatorApi(req, res)).toEqual({ ok: true, creatorId });
});

it('이름 변경은 판본을 올리지 않아 세션이 유지된다', async () => {
  const { creatorId, projectId } = await seed();
  await loginCreatorSession(req, res, creatorId);

  await decideCreatorAccount(projectId, 'set_creator_name', { value: '새이름', reason: REASON });

  expect(await readVersion(creatorId)).toBe(1);
  expect(await authenticateCreatorApi(req, res)).toEqual({ ok: true, creatorId });
});

it('sessionVersion이 없는 옛 쿠키는 무효다', async () => {
  const { creatorId } = await seed();
  fakeSession = makeSession({ creatorId });
  expect(await authenticateCreatorApi(req, res)).toEqual({ ok: false });
});

it('개설자 행이 사라졌으면 무효다', async () => {
  const { creatorId } = await seed();
  await loginCreatorSession(req, res, creatorId);
  await mockDb.delete(schema.fundingProjects).where(eq(schema.fundingProjects.creatorId, creatorId));
  await mockDb.delete(schema.fundingCreators).where(eq(schema.fundingCreators.id, creatorId));
  expect(await authenticateCreatorApi(req, res)).toEqual({ ok: false });
});
