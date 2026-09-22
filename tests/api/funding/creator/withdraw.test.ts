/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorApi: jest.fn() }));
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

const sendEmail = jest.fn().mockResolvedValue({ ok: true, status: 200 });
jest.mock('../../../../lib/email/resend', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

// 경합 재현(낡은 스냅샷 vs 실제 DB) 테스트 하나만 loadProjectForCreator를 오버라이드한다 —
// 나머지는 실제 함수를 그대로 쓴다. submit.test.ts와 같은 패턴이다.
jest.mock('../../../../lib/funding/creatorProjectWrite', () => {
  const actual = jest.requireActual('../../../../lib/funding/creatorProjectWrite');
  return { ...actual, loadProjectForCreator: jest.fn(actual.loadProjectForCreator) };
});

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../../pages/api/funding/creator/projects/[id]/withdraw';
// eslint-disable-next-line import/first
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
// eslint-disable-next-line import/first
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
// eslint-disable-next-line import/first
import { loadProjectForCreator, type CreatorProjectDetail } from '../../../../lib/funding/creatorProjectWrite';
// eslint-disable-next-line import/first
import { OPERATOR_EMAIL } from '../../../../lib/operatorContact';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const CREATOR_A = 'creator-a';

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
  jest.clearAllMocks();
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(true);
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: CREATOR_A });
  sendEmail.mockResolvedValue({ ok: true, status: 200 });

  await client.execute('DELETE FROM funding_rewards');
  await client.execute('DELETE FROM funding_projects');
  await client.execute('DELETE FROM funding_creators');
  await mockDb.insert(schema.fundingCreators).values({ id: CREATOR_A, email: 'a@example.com', name: '개설자A' });
});

const call = async (query: Record<string, string>, method = 'POST') => {
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, body: {}, query, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};

const seedProject = async (overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {}) => {
  const [project] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      creatorId: CREATOR_A,
      title: '제출된 프로젝트',
      summary: '요약',
      slug: `sub-${Math.random().toString(36).slice(2)}`,
      coverUrl: '/api/funding/media/cover.webp',
      content: '본문'.repeat(150),
      goalAmount: 1_000_000,
      startAt: new Date(Date.now() + 10 * 86_400_000),
      endAt: new Date(Date.now() + 40 * 86_400_000),
      reviewStatus: 'submitted',
      submittedAt: new Date(),
      ...overrides,
    })
    .returning();
  return project!;
};

it('POST가 아니면 405', async () => {
  const project = await seedProject();
  const r = await call({ id: project.id }, 'GET');
  expect(r.status).toBe(405);
});

it('허용되지 않은 Origin이면 403', async () => {
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
  const project = await seedProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(403);
});

it('세션 없으면 401', async () => {
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
  const project = await seedProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(401);
});

it('남의 프로젝트 id → 404이고 DB가 바뀌지 않는다', async () => {
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'other-creator' });
  const project = await seedProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(404);

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('submitted');
});

it('요청 제한을 넘으면 429 — creator_save:<creatorId> 분당 30회(submit.ts와 같은 예산)', async () => {
  const project = await seedProject();
  const seen: Array<[string, number, number]> = [];
  (consumeRateLimit as jest.Mock).mockImplementation((key: string, limit: number, windowSeconds: number) => {
    seen.push([key, limit, windowSeconds]);
    return Promise.resolve(false);
  });
  const r = await call({ id: project.id });
  expect(r.status).toBe(429);
  expect(seen).toEqual(expect.arrayContaining([[`creator_save:${CREATOR_A}`, 30, 60]]));
});

it('submitted에서만 철회된다 — draft면 409', async () => {
  const project = await seedProject({ reviewStatus: 'draft', submittedAt: null });
  const r = await call({ id: project.id });
  expect(r.status).toBe(409);
});

it('approved에서는 철회할 수 없다 — 409', async () => {
  const project = await seedProject({ reviewStatus: 'approved', status: 'auto', approvedAt: new Date() });
  const r = await call({ id: project.id });
  expect(r.status).toBe(409);

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('approved');
});

it('정상 → 200이고 reviewStatus가 draft로 돌아간다', async () => {
  const project = await seedProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('draft');
});

it('철회하면 submitted_at이 비워진다 — 남으면 관리자 목록에서 "제출 시각"이 옛 값으로 남고 정렬이 뒤틀린다', async () => {
  const project = await seedProject();
  expect(project.submittedAt).not.toBeNull();
  await call({ id: project.id });

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.submittedAt).toBeNull();
});

it('철회하면 다시 편집·재제출할 수 있는 상태(draft)가 된다 — creator_terms_version은 건드리지 않는다', async () => {
  const project = await seedProject({ creatorTermsVersion: 'funding-creator-terms-2026-09-01', creatorTermsAgreedAt: new Date() });
  await call({ id: project.id });

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('draft');
  // submit.ts가 재제출 때 다시 찍으므로, 철회 자체는 이 값을 지우거나 바꾸지 않는다.
  expect(row?.creatorTermsVersion).toBe('funding-creator-terms-2026-09-01');
});

it('운영자 메일 — 수신자는 OPERATOR_EMAIL, 제목은 "[펀딩] 심사 철회 — {제목}" 형식', async () => {
  const project = await seedProject();
  await call({ id: project.id });

  expect(sendEmail).toHaveBeenCalledTimes(1);
  const params = sendEmail.mock.calls[0][0];
  expect(params.to).toBe(OPERATOR_EMAIL);
  expect(params.subject).toBe(`[펀딩] 심사 철회 — ${project.title}`);
});

it('읽은 뒤(경합) 운영자가 먼저 승인해 버리면 409 — approved가 draft로 되돌아가지 않는다', async () => {
  const project = await seedProject();

  const stale: CreatorProjectDetail = {
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    content: project.content,
    coverUrl: project.coverUrl,
    goalAmount: project.goalAmount,
    startAt: project.startAt,
    endAt: project.endAt,
    reviewStatus: 'submitted',
    status: project.status,
    reviewNote: project.reviewNote,
    creator: { name: '개설자A', email: 'a@example.com', contactName: null, phone: null, bio: null, links: null },
    rewards: [],
  };
  (loadProjectForCreator as jest.Mock).mockResolvedValueOnce(stale);
  await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved', status: 'auto', approvedAt: new Date() })
    .where(eq(schema.fundingProjects.id, project.id));

  const r = await call({ id: project.id });
  expect(r.status).toBe(409);
  // reviewDecision.ts(운영자 승인·반려 경로)의 같은 경합 상황과 같은 문구다 — 위
  // "approved에서는 철회할 수 없다"(전이표가 애초에 막는 경우)와는 다른 메시지다.
  expect(r.body.message).toBe('그 사이 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.');

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('approved');
});

it('메일 발송이 실패해도 200이고 상태는 바뀐다', async () => {
  sendEmail.mockResolvedValue({ ok: false, errorCode: 'API_ERROR' });
  const project = await seedProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(200);

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('draft');
});

it('메일 발송이 예외를 던져도 200이고 상태는 바뀐다', async () => {
  sendEmail.mockRejectedValue(new Error('network down'));
  const project = await seedProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(200);
});

it('Cache-Control: no-store가 실린다', async () => {
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json: jest.fn() });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method: 'GET', body: {}, query: { id: 'x' }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});
