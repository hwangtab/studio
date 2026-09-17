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
// 나머지는 실제 함수를 그대로 쓴다.
jest.mock('../../../../lib/funding/creatorProjectWrite', () => {
  const actual = jest.requireActual('../../../../lib/funding/creatorProjectWrite');
  return { ...actual, loadProjectForCreator: jest.fn(actual.loadProjectForCreator) };
});

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../../pages/api/funding/creator/projects/[id]/submit';
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

const call = async (query: Record<string, string>, body: unknown = {}, method = 'POST') => {
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, body, query, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};

const FULL_BASIC = {
  title: '완성된 프로젝트',
  summary: '요약',
  slug: `full-${Math.random().toString(36).slice(2)}`,
  coverUrl: '/api/funding/media/cover.webp',
};

/** 제출에 필요한 모든 조각을 다 갖춘 프로젝트를 만든다. */
const seedCompleteProject = async (overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {}) => {
  const [project] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      creatorId: CREATOR_A,
      ...FULL_BASIC,
      content: '본문'.repeat(150), // 300자 ≥ 200자
      goalAmount: 1_000_000,
      startAt: new Date(Date.now() + 10 * 86_400_000),
      endAt: new Date(Date.now() + 40 * 86_400_000),
      ...overrides,
    })
    .returning();
  await mockDb.insert(schema.fundingRewards).values({
    projectId: project!.id,
    rewardId: 'basic',
    title: '기본 리워드',
    description: '설명',
    amount: 10_000,
    requiresShipping: false,
    estimatedDelivery: '2026-12',
  });
  return project!;
};

const seedEmptyDraft = async () => {
  const [project] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      creatorId: CREATOR_A,
      slug: `draft-${Math.random().toString(36).slice(2)}`,
      title: '',
      summary: '',
      content: '',
      coverUrl: '',
      goalAmount: 100_000,
      startAt: new Date(),
      endAt: new Date(),
    })
    .returning();
  return project!;
};

it('POST가 아니면 405', async () => {
  const project = await seedCompleteProject();
  const r = await call({ id: project.id }, {}, 'GET');
  expect(r.status).toBe(405);
});

it('허용되지 않은 Origin이면 403', async () => {
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
  const project = await seedCompleteProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(403);
});

it('세션 없으면 401', async () => {
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
  const project = await seedCompleteProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(401);
});

it('남의 프로젝트 id → 404이고 DB가 바뀌지 않는다', async () => {
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'other-creator' });
  const project = await seedCompleteProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(404);

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('draft');
  expect(row?.submittedAt).toBeNull();
});

it('요청 제한을 넘으면 429 — creator_save:<creatorId> 분당 30회', async () => {
  const project = await seedCompleteProject();
  const seen: Array<[string, number, number]> = [];
  (consumeRateLimit as jest.Mock).mockImplementation((key: string, limit: number, windowSeconds: number) => {
    seen.push([key, limit, windowSeconds]);
    return Promise.resolve(false);
  });
  const r = await call({ id: project.id });
  expect(r.status).toBe(429);
  expect(seen).toEqual(expect.arrayContaining([[`creator_save:${CREATOR_A}`, 30, 60]]));
});

it('필수값이 빈 프로젝트 → 400이고 어느 구획이 비었는지 메시지에 있다', async () => {
  const project = await seedEmptyDraft();
  const r = await call({ id: project.id });
  expect(r.status).toBe(400);
  expect(r.body.message).toEqual(expect.stringContaining('기본정보'));
  expect(r.body.message).toEqual(expect.stringContaining('스토리'));
  expect(r.body.message).toEqual(expect.stringContaining('리워드'));

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('draft');
});

it('본문이 200자 미만이면 스토리 항목이 메시지에 있다', async () => {
  const project = await seedCompleteProject({ content: '짧은 본문' });
  const r = await call({ id: project.id });
  expect(r.status).toBe(400);
  expect(r.body.message).toEqual(expect.stringContaining('스토리'));
});

it('리워드가 하나도 없으면 리워드 항목이 메시지에 있다', async () => {
  const [project] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      creatorId: CREATOR_A,
      ...FULL_BASIC,
      slug: `noreward-${Math.random().toString(36).slice(2)}`,
      content: '본문'.repeat(150),
      goalAmount: 1_000_000,
      startAt: new Date(Date.now() + 10 * 86_400_000),
      endAt: new Date(Date.now() + 40 * 86_400_000),
    })
    .returning();
  const r = await call({ id: project!.id });
  expect(r.status).toBe(400);
  expect(r.body.message).toEqual(expect.stringContaining('리워드'));
});

it('시작일이 leadDays(3일) 안쪽이면 400 — 저장 시점엔 유효했어도 묵히면 무효가 된다', async () => {
  // 저장 순간에는(예: 10일 뒤) 유효했지만, 그사이 오늘이 시작일에 바짝 다가온 상태를 흉내낸다.
  const project = await seedCompleteProject({ startAt: new Date(Date.now() + 86_400_000) }); // 내일
  const r = await call({ id: project.id });
  expect(r.status).toBe(400);
  expect(r.body.message).toEqual(expect.stringContaining('시작일'));

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('draft');
});

it('시작일이 이미 지났으면(경과) 400', async () => {
  const project = await seedCompleteProject({ startAt: new Date(Date.now() - 86_400_000) });
  const r = await call({ id: project.id });
  expect(r.status).toBe(400);
  expect(r.body.message).toEqual(expect.stringContaining('시작일'));
});

it('개설자 이름이 비어 있으면 개설자 정보 항목이 메시지에 있다', async () => {
  await mockDb.update(schema.fundingCreators).set({ name: '' }).where(eq(schema.fundingCreators.id, CREATOR_A));
  const project = await seedCompleteProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(400);
  expect(r.body.message).toEqual(expect.stringContaining('개설자'));
});

it('정상 → 200이고 reviewStatus가 submitted, submittedAt이 채워진다', async () => {
  const project = await seedCompleteProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('submitted');
  expect(row?.submittedAt).not.toBeNull();
});

it('운영자 메일 — 수신자는 OPERATOR_EMAIL, 제목은 "[펀딩] 심사 요청 — {제목}" 형식', async () => {
  const project = await seedCompleteProject();
  await call({ id: project.id });

  expect(sendEmail).toHaveBeenCalledTimes(1);
  const params = sendEmail.mock.calls[0][0];
  expect(params.to).toBe(OPERATOR_EMAIL);
  expect(params.subject).toBe(`[펀딩] 심사 요청 — ${project.title}`);
});

it('이미 submitted면 409 — nextReviewStatus(submitted, submit)는 없다', async () => {
  const project = await seedCompleteProject({ reviewStatus: 'submitted' });
  const r = await call({ id: project.id });
  expect(r.status).toBe(409);
});

it('읽은 뒤(경합) 운영자가 먼저 승인해 버리면 409 — approved가 submitted로 되돌아가지 않는다', async () => {
  const project = await seedCompleteProject();

  // loadProjectForCreator가 돌려주는 스냅샷은 여전히 draft(심사 신청 시점에 읽은 값)지만,
  // 그 사이 실제 DB 행은 이미 승인됐다고 가정한다.
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
    reviewStatus: 'draft',
    status: project.status,
    reviewNote: project.reviewNote,
    creator: { name: '개설자A', contactName: null, phone: null, bio: null, links: null },
    rewards: [
      {
        id: 'r1', projectId: project.id, rewardId: 'basic', title: '기본 리워드', description: '설명',
        amount: 10_000, totalQuantity: null, requiresShipping: false, estimatedDelivery: '2026-12',
        imageUrl: null, downloads: null, sortOrder: 0, lockedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ],
  };
  (loadProjectForCreator as jest.Mock).mockResolvedValueOnce(stale);
  await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved', approvedAt: new Date() })
    .where(eq(schema.fundingProjects.id, project.id));

  const r = await call({ id: project.id });
  expect(r.status).toBe(409);

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('approved');
  expect(row?.submittedAt).toBeNull();
});

it('changes_requested 상태에서는 다시 제출할 수 있다', async () => {
  const project = await seedCompleteProject({ reviewStatus: 'changes_requested' });
  const r = await call({ id: project.id });
  expect(r.status).toBe(200);
});

it('메일 발송이 실패해도 200이고 상태는 바뀐다', async () => {
  sendEmail.mockResolvedValue({ ok: false, errorCode: 'API_ERROR' });
  const project = await seedCompleteProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(200);

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('submitted');
});

it('메일 발송이 예외를 던져도 200이고 상태는 바뀐다', async () => {
  sendEmail.mockRejectedValue(new Error('network down'));
  const project = await seedCompleteProject();
  const r = await call({ id: project.id });
  expect(r.status).toBe(200);

  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
  expect(row?.reviewStatus).toBe('submitted');
});

it('FUNDING_CREATOR_TERMS_VERSION이 빈 문자열인 동안은 agreedTermsVersion을 요구하지 않는다', async () => {
  const project = await seedCompleteProject();
  const r = await call({ id: project.id }, {}); // agreedTermsVersion 없이 호출
  expect(r.status).toBe(200);
});

it('Cache-Control: no-store가 실린다', async () => {
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json: jest.fn() });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method: 'GET', body: {}, query: { id: 'x' }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});
