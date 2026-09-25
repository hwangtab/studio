/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { decidePublicStatus } from './publicStatusDecision';
// eslint-disable-next-line import/first
import { getDbFundingProject } from './dbProjects';
// eslint-disable-next-line import/first
import { validateCreatePledgePayload, type CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

const seedCreator = async (email: string, name = '개설자'): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name }).returning();
  return creator.id;
};

const seedProject = async (
  creatorId: string,
  overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {},
): Promise<string> => {
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    creatorId,
    slug: `slug-${crypto.randomUUID()}`,
    title: '제목',
    summary: '요약',
    content: '본'.repeat(210),
    coverUrl: '/uploads/funding/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date('2026-10-01T00:00:00Z'),
    endAt: new Date('2026-10-31T00:00:00Z'),
    reviewStatus: 'submitted',
    ...overrides,
  }).returning();
  return project.id;
};

const seedReward = async (
  projectId: string,
  overrides: Partial<typeof schema.fundingRewards.$inferInsert> = {},
) => {
  await mockDb.insert(schema.fundingRewards).values({
    projectId,
    rewardId: 'basic',
    title: '기본 리워드',
    description: '설명',
    amount: 30_000,
    estimatedDelivery: '2026-11-01',
    ...overrides,
  });
};

const readProject = async (id: string) => {
  const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, id));
  return row;
};

const PLEDGE_PAYLOAD: Omit<CreatePledgePayload, 'projectSlug' | 'rewardId'> = {
  quantity: 1,
  additionalAmount: 0,
  paymentMethod: 'toss',
  customerName: '후원자',
  customerPhone: '010-0000-0000',
  customerEmail: 'supporter@example.com',
  displayNamePublic: false,
  termsAgreed: true,
};

describe('승인 전 프로젝트', () => {
  it('draft·submitted 상태에서는 close·hide 둘 다 거부한다', async () => {
    const creator = await seedCreator('a@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'submitted', status: 'draft' });

    const close = await decidePublicStatus(projectId, 'close', { note: '사유' });
    expect(close.ok).toBe(false);
    if (!close.ok) expect(close.code).toBe('conflict');

    const hide = await decidePublicStatus(projectId, 'hide', {});
    expect(hide.ok).toBe(false);

    const after = await readProject(projectId);
    expect(after.status).toBe('draft');
    expect(after.hidden).toBe(false);
  });

  it('없는 프로젝트는 not_found', async () => {
    const result = await decidePublicStatus('ghost', 'close', { note: '사유' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_found');
  });
});

describe('종료(close)', () => {
  const approved = async (overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {}) => {
    const creator = await seedCreator(`close-${crypto.randomUUID()}@example.com`);
    return seedProject(creator, { reviewStatus: 'approved', status: 'auto', ...overrides });
  };

  it('사유 없이는 거부한다 — DB도 그대로다', async () => {
    const projectId = await approved();
    const result = await decidePublicStatus(projectId, 'close', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('incomplete');
    const after = await readProject(projectId);
    expect(after.status).toBe('auto');
  });

  it('사유가 있으면 status가 closed로 바뀌고 reviewNote·lastmod를 함께 남긴다', async () => {
    const projectId = await approved();
    const now = new Date('2026-09-22T15:30:00Z');
    const result = await decidePublicStatus(projectId, 'close', { note: '가격 오류 발견' }, now);
    expect(result.ok).toBe(true);

    const after = await readProject(projectId);
    expect(after.status).toBe('closed');
    expect(after.reviewNote).toBe('가격 오류 발견');
    // UTC 15:30 = KST 00:30(다음날) — 날짜 경계를 실제로 넘겨서 KST 변환이 적용됐는지 본다.
    expect(after.lastmod).toBe('2026-09-23');
  });

  it('이미 closed면 다시 종료할 수 없다(낙관적 잠금) — 두 번째 호출은 conflict', async () => {
    const projectId = await approved({ status: 'closed' });
    const result = await decidePublicStatus(projectId, 'close', { note: '사유' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict');
  });
});

describe('다시 열기(reopen)', () => {
  it('closed → auto로 되돌린다 — 종료가 편도가 아니다', async () => {
    const creator = await seedCreator('reopen@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'closed',
      reviewNote: '종료 사유',
    });

    const result = await decidePublicStatus(projectId, 'reopen', {});
    expect(result.ok).toBe(true);
    const after = await readProject(projectId);
    expect(after.status).toBe('auto');
  });

  it('사유 없이 되돌리면 기존 reviewNote(종료 사유)를 보존한다', async () => {
    const creator = await seedCreator('reopen-note@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'closed',
      reviewNote: '종료 사유',
    });

    await decidePublicStatus(projectId, 'reopen', {});
    const after = await readProject(projectId);
    expect(after.reviewNote).toBe('종료 사유');
  });

  /**
   * M8 — `close → record_payout → reopen`이 정산의 `not_closed` 게이트를 무력화한다.
   * 다시 열린 뒤 들어온 후원은 `project_id` UNIQUE 탓에 `already_recorded`로 거절되어
   * 영구히 정산에서 빠진다 — 개설자가 받을 돈이 조용히 사라진다.
   */
  it('정산이 기록된 프로젝트는 다시 열 수 없다 — conflict이고 status도 그대로', async () => {
    const creator = await seedCreator('reopen-payout@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'closed' });
    await mockDb.insert(schema.fundingProjectPayouts).values({
      projectId,
      grossAmount: 1_000_000,
      refundAmount: 0,
      supplyAmount: 909_091,
      feeAmount: 100_000,
      shareAmount: 900_000,
      withholdingAmount: 0,
      netAmount: 900_000,
      backerCount: 10,
    });

    const result = await decidePublicStatus(projectId, 'reopen', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict');
    expect((await readProject(projectId)).status).toBe('closed');
  });

  it('이미 auto면 다시 열 수 없다 — conflict', async () => {
    const creator = await seedCreator('reopen-conflict@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto' });
    const result = await decidePublicStatus(projectId, 'reopen', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict');
  });
});

describe('숨김(hide)·노출(unhide)', () => {
  it('hide는 사유 없이도 되고 hidden을 true로 바꾼다', async () => {
    const creator = await seedCreator('hide@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto', hidden: false });

    const result = await decidePublicStatus(projectId, 'hide', {});
    expect(result.ok).toBe(true);
    const after = await readProject(projectId);
    expect(after.hidden).toBe(true);
    // status는 건드리지 않는다 — 숨김은 별개 축이라 모금은 계속 열려 있다.
    expect(after.status).toBe('auto');
  });

  it('unhide는 hidden을 false로 되돌린다', async () => {
    const creator = await seedCreator('unhide@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto', hidden: true });

    const result = await decidePublicStatus(projectId, 'unhide', {});
    expect(result.ok).toBe(true);
    const after = await readProject(projectId);
    expect(after.hidden).toBe(false);
  });

  it('이미 숨겨진 프로젝트를 다시 hide하면 conflict', async () => {
    const creator = await seedCreator('hide-conflict@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto', hidden: true });
    const result = await decidePublicStatus(projectId, 'hide', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('conflict');
  });

  it('사유 없이 hide하면 기존 reviewNote를 보존한다', async () => {
    const creator = await seedCreator('hide-note@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'auto',
      hidden: false,
      reviewNote: '기존 메모',
    });
    await decidePublicStatus(projectId, 'hide', {});
    const after = await readProject(projectId);
    expect(after.reviewNote).toBe('기존 메모');
  });
});

/**
 * 이 작업의 존재 이유 — "종료하면 정말 후원이 막히는가"를 한 줄로 꿴다. 기존
 * `validation.test.ts`는 `computeProjectState`가 'live'가 아니면 거부한다는 것만 보고,
 * 그 앞단인 `decidePublicStatus`(DB에 실제로 status를 쓰는 코드)와는 이어져 있지 않았다.
 * 여기서는 승인된 프로젝트를 실제로 종료한 뒤, 공개 조회 경로(`getDbFundingProject`)가
 * 만든 `FundingProject`로 결제 검증까지 그대로 통과시킨다.
 */
describe('종료 → 결제 거부까지 한 줄로', () => {
  it('종료 전에는 결제가 통과하고, 종료 후에는 같은 프로젝트가 거부된다', async () => {
    const creator = await seedCreator('e2e-close@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'auto',
      startAt: new Date('2026-10-01T00:00:00Z'),
      endAt: new Date('2026-10-31T00:00:00Z'),
    });
    await seedReward(projectId);
    const project = await readProject(projectId);
    const now = new Date('2026-10-15T00:00:00Z'); // 모금 기간(10/1~10/31) 한가운데 — 'live'

    const before = await getDbFundingProject(project.slug);
    expect(before).not.toBeNull();
    const beforeResult = validateCreatePledgePayload(
      { ...PLEDGE_PAYLOAD, projectSlug: project.slug, rewardId: 'basic' },
      before,
      now,
    );
    expect(beforeResult.ok).toBe(true);

    const closeResult = await decidePublicStatus(projectId, 'close', { note: '가격 표기 오류' }, now);
    expect(closeResult.ok).toBe(true);

    const after = await getDbFundingProject(project.slug);
    expect(after?.status).toBe('closed');
    const afterResult = validateCreatePledgePayload(
      { ...PLEDGE_PAYLOAD, projectSlug: project.slug, rewardId: 'basic' },
      after,
      now,
    );
    expect(afterResult.ok).toBe(false);
    if (!afterResult.ok) expect(afterResult.message).toBe('지금은 펀딩을 받지 않는 프로젝트입니다.');
  });
});

describe('hide에 담은 사유는 서버가 실제로 저장한다', () => {
  it('note를 보내면 reviewNote에 저장된다 — 메일에만 싣고 DB에는 안 남기는 비대칭이 없다', async () => {
    const creator = await seedCreator('hide-persist@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'approved', status: 'auto', hidden: false });

    const result = await decidePublicStatus(projectId, 'hide', { note: '신고 접수 — 확인 중' });
    expect(result.ok).toBe(true);

    const after = await readProject(projectId);
    expect(after.hidden).toBe(true);
    expect(after.reviewNote).toBe('신고 접수 — 확인 중');
  });
});
