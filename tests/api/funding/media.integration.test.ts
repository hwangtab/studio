/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));

const get = jest.fn();
jest.mock('@vercel/blob', () => ({ get: (...args: unknown[]) => get(...args) }));

jest.mock('../../../lib/funding/creatorSession', () => ({ getCreatorSession: jest.fn() }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));

// eslint-disable-next-line import/first
import handler from '../../../pages/api/funding/media/[...path]';
// eslint-disable-next-line import/first
import { getCreatorSession } from '../../../lib/funding/creatorSession';
// eslint-disable-next-line import/first
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const OWNER = 'c0ffee';
const OWNED_KEY = `${OWNER}-1111.webp`;
const LEGACY_KEY = '2222.webp';

const seedCreator = async (id: string): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ id, email: `${id}@example.com`, name: '개설자', sessionVersion: 1 }).returning();
  return creator.id;
};

const seedProject = async (
  creatorId: string,
  overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {},
): Promise<string> => {
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    creatorId,
    slug: `slug-${Math.random().toString(16).slice(2)}`,
    title: '제목',
    summary: '요약',
    content: '본문',
    coverUrl: '/api/funding/media/other.webp',
    goalAmount: 1_000_000,
    startAt: new Date('2026-10-01T00:00:00Z'),
    endAt: new Date('2026-10-31T00:00:00Z'),
    reviewStatus: 'draft',
    ...overrides,
  }).returning();
  return project.id;
};

beforeEach(async () => {
  jest.clearAllMocks();
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  get.mockResolvedValue({ stream: new Blob([Buffer.from('img')]).stream() });
  (getCreatorSession as jest.Mock).mockResolvedValue({});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
});

afterEach(() => client.close());

const loginCreator = (creatorId: string, sessionVersion = 1) => {
  (getCreatorSession as jest.Mock).mockResolvedValue({ creatorId, sessionVersion });
};

const call = async (key: string, method = 'GET') => {
  const json = jest.fn();
  const send = jest.fn();
  const end = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json, send, end });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, headers: {}, query: { path: [key] } } as unknown as NextApiRequest, res);
  const headers = Object.fromEntries(setHeader.mock.calls as [string, string][]);
  return { status: status.mock.calls[0][0] as number, headers };
};

it('승인 프로젝트의 표지는 무인증으로 열리고 immutable 캐시가 붙는다', async () => {
  const creatorId = await seedCreator(OWNER);
  await seedProject(creatorId, {
    reviewStatus: 'approved',
    coverUrl: `/api/funding/media/${OWNED_KEY}?w=1200&h=675`,
  });
  const { status, headers } = await call(OWNED_KEY);
  expect(status).toBe(200);
  expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
});

it('승인 프로젝트 본문에만 있는 이미지도 무인증으로 열린다', async () => {
  const creatorId = await seedCreator(OWNER);
  await seedProject(creatorId, {
    reviewStatus: 'approved',
    content: `본문 <img src="/api/funding/media/${OWNED_KEY}?w=800&h=600" />`,
  });
  expect((await call(OWNED_KEY)).status).toBe(200);
});

it('초안 표지는 무인증 404, 소유 개설자 200(no-store), 다른 개설자 404, 관리자 200', async () => {
  const creatorId = await seedCreator(OWNER);
  await seedCreator('other');
  await seedProject(creatorId, { coverUrl: `/api/funding/media/${OWNED_KEY}` });

  expect((await call(OWNED_KEY)).status).toBe(404);

  loginCreator(OWNER);
  const owner = await call(OWNED_KEY);
  expect(owner.status).toBe(200);
  expect(owner.headers['Cache-Control']).toBe('private, no-store');

  loginCreator('other');
  expect((await call(OWNED_KEY)).status).toBe(404);

  (getCreatorSession as jest.Mock).mockResolvedValue({});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'admin', name: '운영자' });
  expect((await call(OWNED_KEY)).status).toBe(200);
});

it('반려 프로젝트의 표지는 무인증 404, 소유 개설자 200', async () => {
  const creatorId = await seedCreator(OWNER);
  await seedProject(creatorId, { reviewStatus: 'rejected', coverUrl: `/api/funding/media/${OWNED_KEY}` });
  expect((await call(OWNED_KEY)).status).toBe(404);
  loginCreator(OWNER);
  expect((await call(OWNED_KEY)).status).toBe(200);
});

it('세션 판본이 DB와 다르면 소유자라도 404', async () => {
  const creatorId = await seedCreator(OWNER);
  await seedProject(creatorId, { coverUrl: `/api/funding/media/${OWNED_KEY}` });
  loginCreator(OWNER, 9);
  expect((await call(OWNED_KEY)).status).toBe(404);
});

it('어디에서도 참조하지 않는 키는 소유 개설자만 열 수 있다', async () => {
  await seedCreator(OWNER);
  expect((await call(OWNED_KEY)).status).toBe(404);
  loginCreator(OWNER);
  expect((await call(OWNED_KEY)).status).toBe(200);
});

it('옛 형식 키(uuid만)는 개설자 세션으로 열리지 않는다 — 승인 참조·관리자만', async () => {
  const creatorId = await seedCreator(OWNER);
  await seedProject(creatorId, { coverUrl: `/api/funding/media/${LEGACY_KEY}` });
  loginCreator(OWNER);
  expect((await call(LEGACY_KEY)).status).toBe(404);

  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'admin', name: '운영자' });
  expect((await call(LEGACY_KEY)).status).toBe(200);
});

it('승인 리워드 이미지는 공개, HEAD도 같은 판정', async () => {
  const creatorId = await seedCreator(OWNER);
  const projectId = await seedProject(creatorId, { reviewStatus: 'approved' });
  await mockDb.insert(schema.fundingRewards).values({
    projectId, rewardId: 'basic', title: '리워드', description: '설명',
    amount: 30_000, estimatedDelivery: '2026-11-01',
    imageUrl: `/api/funding/media/${OWNED_KEY}?w=800&h=600`,
  });
  expect((await call(OWNED_KEY)).status).toBe(200);
  expect((await call(OWNED_KEY, 'HEAD')).status).toBe(200);
});

it('공개 여부 조회가 실패하면 404다 (fail-closed)', async () => {
  const creatorId = await seedCreator(OWNER);
  await seedProject(creatorId, { reviewStatus: 'approved', coverUrl: `/api/funding/media/${OWNED_KEY}` });
  client.close();
  expect((await call(OWNED_KEY)).status).toBe(404);
});
