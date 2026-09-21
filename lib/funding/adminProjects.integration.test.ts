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
import { listProjectsForAdmin, loadProjectForAdmin } from './adminProjects';

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

const seedCreator = async (
  email: string,
  overrides: Partial<typeof schema.fundingCreators.$inferInsert> = {},
): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({
    email,
    name: `이름-${email}`,
    ...overrides,
  }).returning();
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
    content: '본문',
    coverUrl: '/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date('2026-10-01T00:00:00Z'),
    endAt: new Date('2026-10-31T00:00:00Z'),
    ...overrides,
  }).returning();
  return project.id;
};

describe('listProjectsForAdmin', () => {
  it('상태와 무관하게 전부 돌려주고 제출 시각 내림차순으로 정렬한다', async () => {
    const creator = await seedCreator('a@example.com');
    const draftId = await seedProject(creator, { reviewStatus: 'draft', submittedAt: null });
    const submittedId = await seedProject(creator, {
      reviewStatus: 'submitted',
      submittedAt: new Date('2026-09-10T00:00:00Z'),
    });
    const approvedId = await seedProject(creator, {
      reviewStatus: 'approved',
      submittedAt: new Date('2026-09-15T00:00:00Z'),
      approvedAt: new Date('2026-09-16T00:00:00Z'),
    });
    const rejectedId = await seedProject(creator, {
      reviewStatus: 'rejected',
      submittedAt: new Date('2026-09-05T00:00:00Z'),
    });

    const list = await listProjectsForAdmin();
    expect(list.map((p) => p.id).sort()).toEqual(
      [draftId, submittedId, approvedId, rejectedId].sort(),
    );

    // submittedAt 내림차순, null(미제출)은 뒤로.
    expect(list.map((p) => p.id)).toEqual([approvedId, submittedId, rejectedId, draftId]);
  });

  it('reviewStatus로 거를 수 있다', async () => {
    const creator = await seedCreator('b@example.com');
    const submittedId = await seedProject(creator, {
      reviewStatus: 'submitted',
      submittedAt: new Date('2026-09-10T00:00:00Z'),
    });
    await seedProject(creator, { reviewStatus: 'draft', submittedAt: null });
    await seedProject(creator, {
      reviewStatus: 'approved',
      submittedAt: new Date('2026-09-15T00:00:00Z'),
      approvedAt: new Date('2026-09-16T00:00:00Z'),
    });

    const list = await listProjectsForAdmin({ reviewStatus: 'submitted' });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(submittedId);
    expect(list[0].reviewStatus).toBe('submitted');
  });

  it('개설자 이름과 연락처를 함께 싣는다', async () => {
    const creator = await seedCreator('creator-name@example.com', { name: '강정피스앤뮤직캠프' });
    const projectId = await seedProject(creator, {
      reviewStatus: 'submitted',
      submittedAt: new Date('2026-09-10T00:00:00Z'),
    });

    const list = await listProjectsForAdmin();
    const found = list.find((p) => p.id === projectId);
    expect(found).toBeDefined();
    expect(found?.creatorName).toBe('강정피스앤뮤직캠프');
    expect(found?.creatorEmail).toBe('creator-name@example.com');
  });

  it('비공개 정산 필드는 싣지 않는다', async () => {
    const creator = await seedCreator('payout@example.com');
    await mockDb.update(schema.fundingCreators).set({
      taxType: 'withholding',
      payoutBankName: '국민은행',
      payoutAccount: '123-456-789012',
      payoutHolder: '개설자',
    }).where(eq(schema.fundingCreators.id, creator));
    await seedProject(creator, { reviewStatus: 'submitted', submittedAt: new Date('2026-09-10T00:00:00Z') });

    const list = await listProjectsForAdmin();
    expect(list.length).toBeGreaterThan(0);
    for (const summary of list) {
      expect(Object.keys(summary).sort()).toEqual(
        [
          'id', 'slug', 'title', 'reviewStatus', 'status', 'hidden',
          'submittedAt', 'approvedAt', 'creatorName', 'creatorEmail',
          'goalAmount', 'startAt', 'endAt',
        ].sort(),
      );
    }
    const serialized = JSON.stringify(list);
    expect(serialized).not.toContain('taxType');
    expect(serialized).not.toContain('payoutBankName');
    expect(serialized).not.toContain('payoutAccount');
    expect(serialized).not.toContain('payoutHolder');
    expect(serialized).not.toContain('국민은행');
  });
});

describe('loadProjectForAdmin', () => {
  it('어떤 상태의 프로젝트든 id로 읽는다', async () => {
    const creator = await seedCreator('c@example.com');
    const submittedId = await seedProject(creator, {
      reviewStatus: 'submitted',
      submittedAt: new Date('2026-09-10T00:00:00Z'),
    });
    const draftId = await seedProject(creator, { reviewStatus: 'draft', submittedAt: null });

    const submittedDetail = await loadProjectForAdmin(submittedId);
    expect(submittedDetail).not.toBeNull();
    expect(submittedDetail?.reviewStatus).toBe('submitted');

    const draftDetail = await loadProjectForAdmin(draftId);
    expect(draftDetail).not.toBeNull();
    expect(draftDetail?.reviewStatus).toBe('draft');
  });

  it('리워드를 sortOrder 순으로 싣는다', async () => {
    const creator = await seedCreator('d@example.com');
    const projectId = await seedProject(creator);
    await mockDb.insert(schema.fundingRewards).values([
      {
        projectId, rewardId: 'second', title: '두번째', description: '설명',
        amount: 20000, estimatedDelivery: '2026-11-01', sortOrder: 1,
      },
      {
        projectId, rewardId: 'first', title: '첫번째', description: '설명',
        amount: 10000, estimatedDelivery: '2026-11-01', sortOrder: 0,
      },
    ]);

    const detail = await loadProjectForAdmin(projectId);
    expect(detail?.rewards.map((r) => r.rewardId)).toEqual(['first', 'second']);

    // 리워드도 fundingRewards를 통째로 넘기지 않고 필드를 하나씩 골라 담는다 — id·projectId·
    // downloads·createdAt·updatedAt 같은 내부/무관 컬럼이 새지 않는지 화이트리스트로 본다.
    for (const reward of detail!.rewards) {
      expect(Object.keys(reward).sort()).toEqual(
        [
          'rewardId', 'title', 'description', 'amount', 'totalQuantity',
          'requiresShipping', 'estimatedDelivery', 'imageUrl', 'sortOrder', 'lockedAt',
        ].sort(),
      );
    }
  });

  it('리워드의 lockedAt을 그대로 싣는다', async () => {
    const creator = await seedCreator('e@example.com');
    const projectId = await seedProject(creator);
    const lockedAt = new Date('2026-09-12T00:00:00Z');
    await mockDb.insert(schema.fundingRewards).values([
      {
        projectId, rewardId: 'locked', title: '잠긴 리워드', description: '설명',
        amount: 30000, estimatedDelivery: '2026-11-01', lockedAt,
      },
      {
        projectId, rewardId: 'unlocked', title: '안 잠긴 리워드', description: '설명',
        amount: 40000, estimatedDelivery: '2026-11-01',
      },
    ]);

    const detail = await loadProjectForAdmin(projectId);
    const locked = detail?.rewards.find((r) => r.rewardId === 'locked');
    const unlocked = detail?.rewards.find((r) => r.rewardId === 'unlocked');
    expect(locked?.lockedAt).toEqual(lockedAt);
    expect(unlocked?.lockedAt).toBeNull();
  });

  it('없는 id는 null', async () => {
    expect(await loadProjectForAdmin('없는-id')).toBeNull();
  });

  it('비공개 정산 필드는 상세에도 없다', async () => {
    // listProjectsForAdmin의 화이트리스트 테스트와 달리, 정산 필드를 실제로 채워서
    // seed한다 — 값이 비어 있으면 통째로 스프레드해도 통과해 버린다.
    const creator = await seedCreator('payout-detail@example.com', {
      taxType: 'withholding',
      payoutBankName: '국민은행',
      payoutAccount: '123-456-789012',
      payoutHolder: '개설자',
    });
    const projectId = await seedProject(creator, {
      reviewStatus: 'submitted',
      submittedAt: new Date('2026-09-10T00:00:00Z'),
    });

    const detail = await loadProjectForAdmin(projectId);
    expect(detail).not.toBeNull();

    expect(Object.keys(detail!).sort()).toEqual(
      [
        'id', 'slug', 'title', 'reviewStatus', 'status', 'hidden',
        'submittedAt', 'approvedAt', 'creatorName', 'creatorEmail',
        'goalAmount', 'startAt', 'endAt',
        'summary', 'content', 'coverUrl', 'reviewNote', 'internalNote', 'creatorTermsVersion', 'creator', 'rewards',
      ].sort(),
    );
    expect(Object.keys(detail!.creator).sort()).toEqual(
      ['contactName', 'phone', 'bio', 'links'].sort(),
    );

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain('taxType');
    expect(serialized).not.toContain('payoutBankName');
    expect(serialized).not.toContain('payoutAccount');
    expect(serialized).not.toContain('payoutHolder');
    expect(serialized).not.toContain('국민은행');
    expect(serialized).not.toContain('123-456-789012');
  });
});
