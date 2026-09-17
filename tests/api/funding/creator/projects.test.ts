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
jest.mock('../../../../lib/funding/projects', () => ({
  ...jest.requireActual('../../../../lib/funding/projects'),
  getFundingProject: jest.fn().mockReturnValue(null),
}));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import createHandler from '../../../../pages/api/funding/creator/projects';
// eslint-disable-next-line import/first
import sectionHandler from '../../../../pages/api/funding/creator/projects/[id]';
// eslint-disable-next-line import/first
import rewardsHandler from '../../../../pages/api/funding/creator/projects/[id]/rewards';
// eslint-disable-next-line import/first
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
// eslint-disable-next-line import/first
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const CREATOR_A = 'creator-a';
const CREATOR_B = 'creator-b';

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

  await client.execute('DELETE FROM funding_rewards');
  await client.execute('DELETE FROM funding_projects');
  await client.execute('DELETE FROM funding_creators');
  await mockDb.insert(schema.fundingCreators).values([
    { id: CREATOR_A, email: 'a@example.com', name: '개설자A' },
    { id: CREATOR_B, email: 'b@example.com', name: '개설자B' },
  ]);
});

const call = async (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  { method = 'POST', body, query = {} }: { method?: string; body?: unknown; query?: Record<string, string> } = {},
) => {
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, body, query, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0], setHeader };
};

/** 소유자용 초안 프로젝트를 하나 만든다. */
const seedDraftProject = async (creatorId: string, overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {}) => {
  const [row] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      creatorId,
      slug: `draft-${Math.random().toString(36).slice(2)}`,
      title: '',
      summary: '',
      content: '',
      coverUrl: '',
      goalAmount: 100_000,
      startAt: new Date(),
      endAt: new Date(),
      ...overrides,
    })
    .returning();
  return row!;
};

const VALID_BASIC = {
  title: '데모 프로젝트',
  summary: '한 줄 요약입니다',
  slug: 'demo-slug',
  goalAmount: 1_000_000,
  startAt: new Date(Date.now() + 10 * 86_400_000).toISOString(),
  endAt: new Date(Date.now() + 40 * 86_400_000).toISOString(),
  coverUrl: '/api/funding/media/cover.webp',
};

const VALID_REWARD = {
  rewardId: 'basic',
  title: '기본 리워드',
  description: '설명입니다',
  amount: 10_000,
  totalQuantity: null,
  requiresShipping: false,
  estimatedDelivery: '2026-12',
  imageUrl: null,
};

describe('POST /api/funding/creator/projects (초안 생성)', () => {
  it('POST가 아니면 405', async () => {
    const r = await call(createHandler, { method: 'GET' });
    expect(r.status).toBe(405);
  });

  it('허용되지 않은 Origin이면 403', async () => {
    (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
    const r = await call(createHandler);
    expect(r.status).toBe(403);
  });

  it('세션 없으면 401', async () => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(createHandler);
    expect(r.status).toBe(401);
  });

  it('요청 제한을 넘으면 429', async () => {
    (consumeRateLimit as jest.Mock).mockResolvedValue(false);
    const r = await call(createHandler);
    expect(r.status).toBe(429);
  });

  it('요청 제한은 IP와 계정 두 겹 — creator_save:ip:*와 creator_save:<creatorId>를 각각 분당 30회로 부른다', async () => {
    const seen: Array<[string, number, number]> = [];
    (consumeRateLimit as jest.Mock).mockImplementation((key: string, limit: number, windowSeconds: number) => {
      seen.push([key, limit, windowSeconds]);
      return Promise.resolve(true);
    });
    await call(createHandler);
    expect(seen).toEqual(
      expect.arrayContaining([
        ['creator_save:ip:unknown', 30, 60],
        [`creator_save:${CREATOR_A}`, 30, 60],
      ]),
    );
  });

  it('IP 요청 제한만 초과해도 429 — 계정 쪽이 통과했더라도', async () => {
    (consumeRateLimit as jest.Mock).mockImplementation((key: string) => Promise.resolve(!key.startsWith('creator_save:ip:')));
    const r = await call(createHandler);
    expect(r.status).toBe(429);
  });

  it('성공 → 200, id를 돌려주고 draft 행이 만들어진다', async () => {
    const r = await call(createHandler);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.id).toBe('string');

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, r.body.id));
    expect(row?.creatorId).toBe(CREATOR_A);
    expect(row?.reviewStatus).toBe('draft');
  });

  it('계정당 프로젝트 상한(draftsMax)을 넘으면 400 — 승인·반려된 것도 함께 센다', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedDraftProject(CREATOR_A, { reviewStatus: i % 2 === 0 ? 'approved' : 'draft' });
    }
    const r = await call(createHandler);
    expect(r.status).toBe(400);
    expect(r.body.message).toEqual(expect.stringContaining('프로젝트'));

    const rows = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.creatorId, CREATOR_A));
    expect(rows).toHaveLength(10);
  });

  it('다른 개설자의 프로젝트 수는 상한에 영향을 주지 않는다', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedDraftProject(CREATOR_B);
    }
    const r = await call(createHandler);
    expect(r.status).toBe(200);
  });

  it('Cache-Control: no-store가 실린다', async () => {
    const r = await call(createHandler, { method: 'GET' });
    expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('POST /api/funding/creator/projects/[id] (구획별 저장)', () => {
  it('POST가 아니면 405', async () => {
    const r = await call(sectionHandler, { method: 'GET', query: { id: 'x' } });
    expect(r.status).toBe(405);
  });

  it('허용되지 않은 Origin이면 403', async () => {
    (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
    const r = await call(sectionHandler, { query: { id: 'x' }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(403);
  });

  it('세션 없으면 401', async () => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(sectionHandler, { query: { id: 'x' }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(401);
  });

  it('남의 프로젝트 id로 기본정보를 저장하면 404이고 DB가 바뀌지 않는다', async () => {
    const project = await seedDraftProject(CREATOR_B);
    const r = await call(sectionHandler, { query: { id: project.id }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(404);

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
    expect(row?.title).toBe('');
    expect(row?.slug).toBe(project.slug);
  });

  it('없는 프로젝트 id → 404', async () => {
    const r = await call(sectionHandler, { query: { id: 'no-such-id' }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(404);
  });

  it('구획 값이 올바르지 않으면 400 — 한국어 메시지', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(sectionHandler, {
      query: { id: project.id },
      body: { section: 'basic', value: { ...VALID_BASIC, title: '' } },
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toEqual(expect.stringContaining('제목'));
  });

  it('section 값이 이상하면 400', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(sectionHandler, { query: { id: project.id }, body: { section: 'nope', value: {} } });
    expect(r.status).toBe(400);
  });

  it('요청 제한을 넘으면 429 — creator_save:<creatorId> 분당 30회', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const seen: Array<[string, number, number]> = [];
    (consumeRateLimit as jest.Mock).mockImplementation((key: string, limit: number, windowSeconds: number) => {
      seen.push([key, limit, windowSeconds]);
      return Promise.resolve(false);
    });
    const r = await call(sectionHandler, { query: { id: project.id }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(429);
    expect(seen).toEqual(expect.arrayContaining([[`creator_save:${CREATOR_A}`, 30, 60]]));
  });

  it('기본정보 저장 성공 → 200, DB에 반영', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(sectionHandler, { query: { id: project.id }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(200);

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
    expect(row?.title).toBe(VALID_BASIC.title);
    expect(row?.slug).toBe(VALID_BASIC.slug);
  });

  it('심사 중인 프로젝트(submitted)에 기본정보를 저장하면 409', async () => {
    const project = await seedDraftProject(CREATOR_A, { reviewStatus: 'submitted' });
    const r = await call(sectionHandler, { query: { id: project.id }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(409);
  });

  it('스토리 저장 성공 → 200, DB에 반영', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(sectionHandler, { query: { id: project.id }, body: { section: 'story', value: { content: '내용'.repeat(10) } } });
    expect(r.status).toBe(200);

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
    expect(row?.content).toBe('내용'.repeat(10));
  });

  it('개설자 프로필 저장은 프로젝트 id의 소유 여부와 무관하다 — 계정 소속이라 남의 프로젝트 id를 줘도 성공한다', async () => {
    const project = await seedDraftProject(CREATOR_B);
    const r = await call(sectionHandler, {
      query: { id: project.id },
      body: { section: 'creator', value: { name: '새 이름', contactName: null, phone: null, bio: null, links: null } },
    });
    expect(r.status).toBe(200);

    const [row] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, CREATOR_A));
    expect(row?.name).toBe('새 이름');
    // B 계정은 건드리지 않는다.
    const [rowB] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, CREATOR_B));
    expect(rowB?.name).toBe('개설자B');
  });

  it('Cache-Control: no-store가 실린다', async () => {
    const r = await call(sectionHandler, { method: 'GET', query: { id: 'x' } });
    expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('POST /api/funding/creator/projects/[id]/rewards (리워드 CRUD)', () => {
  it('POST가 아니면 405', async () => {
    const r = await call(rewardsHandler, { method: 'GET', query: { id: 'x' } });
    expect(r.status).toBe(405);
  });

  it('허용되지 않은 Origin이면 403', async () => {
    (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
    const r = await call(rewardsHandler, { query: { id: 'x' }, body: { mode: 'create', value: VALID_REWARD } });
    expect(r.status).toBe(403);
  });

  it('세션 없으면 401', async () => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(rewardsHandler, { query: { id: 'x' }, body: { mode: 'create', value: VALID_REWARD } });
    expect(r.status).toBe(401);
  });

  it('남의 프로젝트 id → 404이고 DB가 바뀌지 않는다', async () => {
    const project = await seedDraftProject(CREATOR_B);
    const r = await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });
    expect(r.status).toBe(404);

    const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, project.id));
    expect(rewards).toHaveLength(0);
  });

  it('mode가 이상하면 400', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'reorder' } });
    expect(r.status).toBe(400);
  });

  it('요청 제한을 넘으면 429 — creator_save:<creatorId> 분당 30회', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const seen: Array<[string, number, number]> = [];
    (consumeRateLimit as jest.Mock).mockImplementation((key: string, limit: number, windowSeconds: number) => {
      seen.push([key, limit, windowSeconds]);
      return Promise.resolve(false);
    });
    const r = await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });
    expect(r.status).toBe(429);
    expect(seen).toEqual(expect.arrayContaining([[`creator_save:${CREATOR_A}`, 30, 60]]));
  });

  it('리워드 값이 올바르지 않으면 400 — 한국어 메시지', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(rewardsHandler, {
      query: { id: project.id },
      body: { mode: 'create', value: { ...VALID_REWARD, rewardId: '' } },
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toEqual(expect.stringContaining('리워드'));
  });

  it('생성 성공 → 200, DB에 반영', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });
    expect(r.status).toBe(200);

    const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, project.id));
    expect(rewards).toHaveLength(1);
    expect(rewards[0]?.rewardId).toBe('basic');
  });

  it('mode: create인데 같은 rewardId가 이미 있으면 400 — upsertReward가 조용히 덮어쓰지 않는다', async () => {
    const project = await seedDraftProject(CREATOR_A);
    await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });

    const r = await call(rewardsHandler, {
      query: { id: project.id },
      body: { mode: 'create', value: { ...VALID_REWARD, title: '덮어쓰기 시도', amount: 99_000 } },
    });
    expect(r.status).toBe(400);

    const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, project.id));
    expect(rewards).toHaveLength(1);
    // 기존 행이 덮이지 않았다.
    expect(rewards[0]?.title).toBe(VALID_REWARD.title);
    expect(rewards[0]?.amount).toBe(VALID_REWARD.amount);
  });

  it('mode: create의 중복 검사는 프로젝트 소유자 기준이다 — 남의 프로젝트에 같은 rewardId가 있어도 내 프로젝트 생성엔 영향 없다', async () => {
    const other = await seedDraftProject(CREATOR_B);
    await mockDb.insert(schema.fundingRewards).values({
      projectId: other.id,
      rewardId: 'basic',
      title: '남의 리워드',
      description: 'd',
      amount: 5_000,
      requiresShipping: false,
      estimatedDelivery: '2026-12',
    });

    const mine = await seedDraftProject(CREATOR_A);
    const r = await call(rewardsHandler, { query: { id: mine.id }, body: { mode: 'create', value: VALID_REWARD } });
    expect(r.status).toBe(200);
  });

  it.each<[string, unknown]>([
    ['빠뜨림', undefined],
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['null', null],
    ['숫자', 123],
    ['배열', ['basic']],
  ])(
    'mode: update인데 previousRewardId가 %s(%s)면 400 — 서비스가 "새 리워드 추가"로 오인하지 않는다',
    async (_label, previousRewardId) => {
      const project = await seedDraftProject(CREATOR_A);
      await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });

      const r = await call(rewardsHandler, {
        query: { id: project.id },
        body: { mode: 'update', previousRewardId, value: { ...VALID_REWARD, rewardId: 'renamed' } },
      });
      expect(r.status).toBe(400);

      const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, project.id));
      expect(rewards).toHaveLength(1);
      expect(rewards[0]?.rewardId).toBe('basic');
    },
  );

  it('mode: update + previousRewardId → 개명 성공(행이 늘지 않는다)', async () => {
    const project = await seedDraftProject(CREATOR_A);
    await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });

    const r = await call(rewardsHandler, {
      query: { id: project.id },
      body: { mode: 'update', previousRewardId: 'basic', value: { ...VALID_REWARD, rewardId: 'renamed' } },
    });
    expect(r.status).toBe(200);

    const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, project.id));
    expect(rewards).toHaveLength(1);
    expect(rewards[0]?.rewardId).toBe('renamed');
  });

  it('잠긴(공개된) 리워드의 금액을 바꾸면 409', async () => {
    const project = await seedDraftProject(CREATOR_A);
    await mockDb.insert(schema.fundingRewards).values({
      projectId: project.id,
      rewardId: 'basic',
      title: '기본',
      description: 'd',
      amount: 10_000,
      requiresShipping: false,
      estimatedDelivery: '2026-12',
      lockedAt: new Date(),
    });

    const r = await call(rewardsHandler, {
      query: { id: project.id },
      body: { mode: 'update', previousRewardId: 'basic', value: { ...VALID_REWARD, amount: 20_000 } },
    });
    expect(r.status).toBe(409);
  });

  it('삭제 rewardId가 공백만이면 400', async () => {
    const project = await seedDraftProject(CREATOR_A);
    await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });

    const r = await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'delete', rewardId: '   ' } });
    expect(r.status).toBe(400);

    const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, project.id));
    expect(rewards).toHaveLength(1);
  });

  it('삭제 성공 → 200, 행이 지워진다', async () => {
    const project = await seedDraftProject(CREATOR_A);
    await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'create', value: VALID_REWARD } });

    const r = await call(rewardsHandler, { query: { id: project.id }, body: { mode: 'delete', rewardId: 'basic' } });
    expect(r.status).toBe(200);

    const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, project.id));
    expect(rewards).toHaveLength(0);
  });

  it('Cache-Control: no-store가 실린다', async () => {
    const r = await call(rewardsHandler, { method: 'GET', query: { id: 'x' } });
    expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
