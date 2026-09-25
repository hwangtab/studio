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
// 승인 뒤 저장 알림(sendCreatorEditedNotice)을 목으로 대체한다 — 실제 메일 발송(Resend)을
// 타지 않고, "호출됐는가/무엇을 받았는가"만 본다. reviewEmail.ts의 다른 export는 이
// 라우트가 쓰지 않으므로 목에 없어도 된다.
jest.mock('../../../../lib/funding/reviewEmail', () => ({ sendCreatorEditedNotice: jest.fn().mockResolvedValue(null) }));

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
// eslint-disable-next-line import/first
import { sendCreatorEditedNotice } from '../../../../lib/funding/reviewEmail';
import { kstEndOfDayIso, kstStartOfDayIso, toKstDateString } from '../../../../lib/funding/creatorDateInput';

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
  (sendCreatorEditedNotice as jest.Mock).mockResolvedValue(null);

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
  startAt: toKstDateString(new Date(Date.now() + 10 * 86_400_000)),
  endAt: toKstDateString(new Date(Date.now() + 40 * 86_400_000)),
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

  it('계정당 미심사 프로젝트 상한(draftsMax)을 넘으면 400 — draft·submitted·changes_requested만 센다', async () => {
    const statuses = ['draft', 'submitted', 'changes_requested'] as const;
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedDraftProject(CREATOR_A, { reviewStatus: statuses[i % statuses.length] });
    }
    const r = await call(createHandler);
    expect(r.status).toBe(400);
    expect(r.body.message).toEqual(expect.stringContaining('심사'));

    const rows = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.creatorId, CREATOR_A));
    expect(rows).toHaveLength(10);
  });

  it('승인·반려는 세지 않는다 — 펀딩을 여러 번 성공(또는 반려)시킨 개설자도 새 프로젝트를 만들 수 있다', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedDraftProject(CREATOR_A, { reviewStatus: i % 2 === 0 ? 'approved' : 'rejected' });
    }
    const r = await call(createHandler);
    expect(r.status).toBe(200);
  });

  it('미심사(draft·submitted·changes_requested) 10개가 섞여 있으면 상한에 걸린다', async () => {
    await seedDraftProject(CREATOR_A, { reviewStatus: 'approved' });
    await seedDraftProject(CREATOR_A, { reviewStatus: 'rejected' });
    const statuses = ['draft', 'submitted', 'changes_requested'] as const;
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedDraftProject(CREATOR_A, { reviewStatus: statuses[i % statuses.length] });
    }
    const r = await call(createHandler);
    expect(r.status).toBe(400);
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

describe('POST /api/funding/creator/projects/[id] (승인 뒤 저장 — 날짜 우회·알림)', () => {
  /**
   * 모금이 이미 시작된(startAt이 과거인) 승인 프로젝트를 심는다. `validateBasicSection`은
   * 상태와 무관하게 `startAt >= now + leadDays(3일)`를 요구하므로, 이 시드로 회귀를 재현할
   * 수 있다 — startAt을 미래로 두면 지금 코드도 통과해 회귀를 못 잡는다(리뷰 지적).
   */
  const seedLiveApprovedProject = (overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {}) =>
    seedDraftProject(CREATOR_A, {
      reviewStatus: 'approved',
      status: 'auto',
      slug: 'live-project',
      title: '기존 제목',
      summary: '기존 요약',
      content: '본문',
      coverUrl: '/api/funding/media/cover.webp',
      goalAmount: 1_000_000,
      startAt: new Date(kstStartOfDayIso(toKstDateString(new Date(Date.now() - 10 * 86_400_000)))),
      endAt: new Date(kstEndOfDayIso(toKstDateString(new Date(Date.now() + 10 * 86_400_000)))),
      ...overrides,
    });

  it('모금이 이미 시작된 승인 프로젝트에서 제목만 바꾸면 200이고 제목이 실제로 바뀐다', async () => {
    const project = await seedLiveApprovedProject();
    // 화면(BasicSectionForm)은 잠긴 날짜 필드도 폼 값에 실어 매번 함께 보낸다 — 여기서도
    // 미래 날짜를 그대로 보낸다. 서버가 이 값을 무시하고 DB의 기존 날짜로 강제 치환해야
    // (validateBasicSection의 leadDays 검사를 우회해야) 저장이 통과한다.
    const r = await call(sectionHandler, {
      query: { id: project.id },
      body: {
        section: 'basic',
        value: { ...VALID_BASIC, slug: 'live-project', goalAmount: 1_000_000, title: '새 제목' },
      },
    });
    expect(r.status).toBe(200);

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
    expect(row?.title).toBe('새 제목');
    // 날짜는 그대로다 — 요청이 보낸 미래 날짜가 아니라 시드된 기존 값(초 단위로 저장되므로
    // Date.now()를 여기서 다시 계산하지 않고 시드 자체의 startAt과 비교한다)이 유지됐다.
    expect(row?.startAt.getTime()).toBe(project.startAt.getTime());
  });

  it('초안 저장에는 운영자 메일이 가지 않는다', async () => {
    const project = await seedDraftProject(CREATOR_A);
    const r = await call(sectionHandler, { query: { id: project.id }, body: { section: 'basic', value: VALID_BASIC } });
    expect(r.status).toBe(200);
    expect(sendCreatorEditedNotice).not.toHaveBeenCalled();
  });

  it('승인 뒤 저장에는 운영자 메일이 간다', async () => {
    const project = await seedLiveApprovedProject();
    const r = await call(sectionHandler, {
      query: { id: project.id },
      body: { section: 'basic', value: { ...VALID_BASIC, slug: 'live-project', goalAmount: 1_000_000 } },
    });
    expect(r.status).toBe(200);
    expect(sendCreatorEditedNotice).toHaveBeenCalledTimes(1);
  });

  it('알림 레이트리밋 키는 프로젝트별이다 — funding_creator_edit:<projectId>를 1시간에 1회로 부른다', async () => {
    const project = await seedLiveApprovedProject();
    const seen: Array<[string, number, number]> = [];
    (consumeRateLimit as jest.Mock).mockImplementation((key: string, limit: number, windowSeconds: number) => {
      seen.push([key, limit, windowSeconds]);
      return Promise.resolve(true);
    });
    await call(sectionHandler, {
      query: { id: project.id },
      body: { section: 'basic', value: { ...VALID_BASIC, slug: 'live-project', goalAmount: 1_000_000 } },
    });
    expect(seen).toEqual(expect.arrayContaining([[`funding_creator_edit:${project.id}`, 1, 3600]]));
  });

  it('창 안의 두 번째 저장은 알림을 억제한다 — 레이트리밋이 막으면 메일을 부르지 않는다', async () => {
    const project = await seedLiveApprovedProject();
    (consumeRateLimit as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(!key.startsWith('funding_creator_edit:')));
    const r = await call(sectionHandler, {
      query: { id: project.id },
      body: { section: 'basic', value: { ...VALID_BASIC, slug: 'live-project', goalAmount: 1_000_000 } },
    });
    expect(r.status).toBe(200); // 알림 억제는 저장 자체를 막지 않는다.
    expect(sendCreatorEditedNotice).not.toHaveBeenCalled();
  });

  it('loadProjectForAdmin의 정산·내부 메모 필드가 저장 응답에 새지 않는다', async () => {
    await mockDb.update(schema.fundingCreators).set({
      taxType: 'withholding',
      payoutAccountEnc: 'v2:00000000:aaaa:bbbb:cccc',
      payoutAccountLast4: '9012',
    }).where(eq(schema.fundingCreators.id, CREATOR_A));
    const project = await seedLiveApprovedProject();
    await mockDb.update(schema.fundingProjects).set({ internalNote: '운영자 전용 메모' })
      .where(eq(schema.fundingProjects.id, project.id));

    const r = await call(sectionHandler, {
      query: { id: project.id },
      body: { section: 'basic', value: { ...VALID_BASIC, slug: 'live-project', goalAmount: 1_000_000 } },
    });
    expect(r.status).toBe(200);
    const serialized = JSON.stringify(r.body);
    expect(serialized).not.toContain('taxType');
    expect(serialized).not.toContain('payoutBankName');
    expect(serialized).not.toContain('국민은행');
    expect(serialized).not.toContain('123-456-789012');
    expect(serialized).not.toContain('운영자 전용 메모');
  });

  it('알림 메일 처리가 던져도(throw) 저장은 실패하지 않는다', async () => {
    (sendCreatorEditedNotice as jest.Mock).mockRejectedValueOnce(new Error('resend 장애'));
    const project = await seedLiveApprovedProject();
    const r = await call(sectionHandler, {
      query: { id: project.id },
      body: { section: 'basic', value: { ...VALID_BASIC, slug: 'live-project', goalAmount: 1_000_000, title: '던져도 저장됨' } },
    });
    expect(r.status).toBe(200);

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
    expect(row?.title).toBe('던져도 저장됨');
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
