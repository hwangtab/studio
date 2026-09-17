/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// getFundingProject(파일 프로젝트)는 slug 중복 검사에 쓰인다 — 실제 파일시스템을 읽지 않고
// 테스트가 지정하는 slug만 "파일이 이미 있다"고 답하도록 목으로 고정한다.
let mockFileSlugs: string[] = [];
jest.mock('./projects', () => ({
  getFundingProject: (slug: string) => (mockFileSlugs.includes(slug) ? ({ slug } as never) : null),
}));

// eslint-disable-next-line import/first
import { CREATOR_LIMITS, type RewardInput } from './creatorValidation';
// eslint-disable-next-line import/first
import {
  createDraftProject,
  deleteReward,
  loadProjectForCreator,
  saveBasicSection,
  saveCreatorSection,
  saveStorySection,
  upsertReward,
} from './creatorProjectWrite';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeEach(async () => {
  mockFileSlugs = [];
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

const seedCreator = async (email: string): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name: '가나' }).returning();
  return creator.id;
};

const rewardInput = (overrides: Partial<RewardInput> = {}): RewardInput => ({
  rewardId: 'basic',
  title: '기본 리워드',
  description: '설명',
  amount: 30_000,
  totalQuantity: null,
  requiresShipping: false,
  estimatedDelivery: '2026-11-01',
  imageUrl: null,
  ...overrides,
});

const basicSection = (overrides: Partial<Parameters<typeof saveBasicSection>[2]> = {}) => ({
  title: '제목',
  summary: '요약',
  slug: 'my-project',
  goalAmount: 1_000_000,
  startAt: new Date('2026-10-01T00:00:00Z'),
  endAt: new Date('2026-10-31T00:00:00Z'),
  coverUrl: '/cover.webp',
  ...overrides,
});

describe('createDraftProject / loadProjectForCreator', () => {
  it('초안을 만들고 본인 계정으로 불러올 수 있다', async () => {
    const creator = await seedCreator('me@example.com');
    const { id } = await createDraftProject(creator);
    const detail = await loadProjectForCreator(creator, id);
    expect(detail).not.toBeNull();
    expect(detail?.reviewStatus).toBe('draft');
    expect(detail?.rewards).toEqual([]);
  });
});

describe('소유권', () => {
  it('남의 프로젝트는 없는 것으로 보인다', async () => {
    const mine = await seedCreator('mine@example.com');
    const other = await seedCreator('other@example.com');
    const { id } = await createDraftProject(other);
    expect(await loadProjectForCreator(mine, id)).toBeNull();
    const r = await saveStorySection(mine, id, { content: '남의 글' });
    expect(r).toMatchObject({ ok: false, code: 'not_found' });
    // 실제로 안 바뀌었는지 확인한다 — 거부 응답만 보고 넘어가면 조용한 쓰기를 놓친다.
    const row = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, id));
    expect(row[0].content).not.toContain('남의 글');
  });

  it('남의 프로젝트에 기본 정보·리워드도 못 쓴다', async () => {
    const mine = await seedCreator('mine2@example.com');
    const other = await seedCreator('other2@example.com');
    const { id } = await createDraftProject(other);

    const basicResult = await saveBasicSection(mine, id, basicSection());
    expect(basicResult).toMatchObject({ ok: false, code: 'not_found' });

    const rewardResult = await upsertReward(mine, id, rewardInput());
    expect(rewardResult).toMatchObject({ ok: false, code: 'not_found' });

    const rewards = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, id));
    expect(rewards).toHaveLength(0);
  });
});

describe('리워드 잠금', () => {
  const lockIt = async (projectId: string, rewardId: string) =>
    mockDb.update(schema.fundingRewards).set({ lockedAt: new Date() })
      .where(and(eq(schema.fundingRewards.projectId, projectId), eq(schema.fundingRewards.rewardId, rewardId)));

  it('잠긴 리워드의 금액을 바꿀 수 없다', async () => {
    const creator = await seedCreator('a@example.com');
    const { id } = await createDraftProject(creator);
    await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 30000 }));
    await lockIt(id, 'cd');
    const r = await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 35000 }));
    expect(r).toMatchObject({ ok: false, code: 'locked' });
    const [row] = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.rewardId, 'cd'));
    expect(row.amount).toBe(30000);
  });

  it('잠긴 리워드의 한정 수량 유무를 바꿀 수 없다', async () => {
    const creator = await seedCreator('b@example.com');
    const { id } = await createDraftProject(creator);

    // null → 100 거부
    await upsertReward(creator, id, rewardInput({ rewardId: 'unlimited', totalQuantity: null }));
    await lockIt(id, 'unlimited');
    const toLimited = await upsertReward(creator, id, rewardInput({ rewardId: 'unlimited', totalQuantity: 100 }));
    expect(toLimited).toMatchObject({ ok: false, code: 'locked' });
    const [unlimitedRow] = await mockDb.select().from(schema.fundingRewards)
      .where(eq(schema.fundingRewards.rewardId, 'unlimited'));
    expect(unlimitedRow.totalQuantity).toBeNull();

    // 100 → null 거부
    await upsertReward(creator, id, rewardInput({ rewardId: 'limited', totalQuantity: 100 }));
    await lockIt(id, 'limited');
    const toUnlimited = await upsertReward(creator, id, rewardInput({ rewardId: 'limited', totalQuantity: null }));
    expect(toUnlimited).toMatchObject({ ok: false, code: 'locked' });
    const [limitedRow] = await mockDb.select().from(schema.fundingRewards)
      .where(eq(schema.fundingRewards.rewardId, 'limited'));
    expect(limitedRow.totalQuantity).toBe(100);

    // 수량 자체를 늘리는 것은 허용한다(재고 추가).
    const increase = await upsertReward(creator, id, rewardInput({ rewardId: 'limited', totalQuantity: 150 }));
    expect(increase).toMatchObject({ ok: true });
    const [increased] = await mockDb.select().from(schema.fundingRewards)
      .where(eq(schema.fundingRewards.rewardId, 'limited'));
    expect(increased.totalQuantity).toBe(150);
  });

  it('잠긴 리워드를 지울 수 없다', async () => {
    const creator = await seedCreator('c@example.com');
    const { id } = await createDraftProject(creator);
    await upsertReward(creator, id, rewardInput({ rewardId: 'cd' }));
    await lockIt(id, 'cd');

    const r = await deleteReward(creator, id, 'cd');
    expect(r).toMatchObject({ ok: false, code: 'locked' });

    const [row] = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.rewardId, 'cd'));
    expect(row).toBeDefined();
  });

  it('잠긴 리워드의 제목·설명·이미지·예상 전달 시기는 고칠 수 있다', async () => {
    const creator = await seedCreator('d@example.com');
    const { id } = await createDraftProject(creator);
    await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 30000, totalQuantity: 100 }));
    await lockIt(id, 'cd');

    const r = await upsertReward(creator, id, rewardInput({
      rewardId: 'cd',
      amount: 30000,
      totalQuantity: 100,
      title: '새 제목',
      description: '새 설명',
      imageUrl: '/new.webp',
      estimatedDelivery: '2027-01-01',
    }));
    expect(r).toMatchObject({ ok: true });

    const [row] = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.rewardId, 'cd'));
    expect(row.title).toBe('새 제목');
    expect(row.description).toBe('새 설명');
    expect(row.imageUrl).toBe('/new.webp');
    expect(row.estimatedDelivery).toBe('2027-01-01');
    // 바뀌면 안 되는 것들은 그대로다.
    expect(row.amount).toBe(30000);
    expect(row.totalQuantity).toBe(100);
  });

  it('잠긴 리워드가 있어도 새 리워드는 추가할 수 있다', async () => {
    const creator = await seedCreator('e@example.com');
    const { id } = await createDraftProject(creator);
    await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 30000 }));
    await lockIt(id, 'cd');

    const r = await upsertReward(creator, id, rewardInput({ rewardId: 'cd-v2', amount: 35000 }));
    expect(r).toMatchObject({ ok: true });

    const rows = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, id));
    expect(rows.map((row) => row.rewardId).sort()).toEqual(['cd', 'cd-v2']);
  });
});

describe('편집 가능 상태', () => {
  it('심사 중에는 저장이 거부된다', async () => {
    const creator = await seedCreator('f@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'submitted' })
      .where(eq(schema.fundingProjects.id, id));

    const r = await saveBasicSection(creator, id, basicSection());
    expect(r).toMatchObject({ ok: false, code: 'not_editable' });

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, id));
    expect(row.title).not.toBe('제목');
  });

  it('심사 중에는 스토리·개설자 정보·리워드 저장도 거부된다', async () => {
    const creator = await seedCreator('f2@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'submitted' })
      .where(eq(schema.fundingProjects.id, id));

    expect(await saveStorySection(creator, id, { content: '본문' })).toMatchObject({ ok: false, code: 'not_editable' });
    expect(await saveCreatorSection(creator, id, {
      name: '이름', contactName: null, phone: null, bio: null, links: null,
    })).toMatchObject({ ok: false, code: 'not_editable' });
    expect(await upsertReward(creator, id, rewardInput())).toMatchObject({ ok: false, code: 'not_editable' });
    expect(await deleteReward(creator, id, 'basic')).toMatchObject({ ok: false, code: 'not_editable' });
  });
});

describe('slug 중복', () => {
  it('다른 프로젝트가 쓰는 slug는 거부한다', async () => {
    const creator = await seedCreator('g@example.com');
    const { id: first } = await createDraftProject(creator);
    await saveBasicSection(creator, first, basicSection({ slug: 'taken-slug' }));

    // 같은 개설자의 다른 프로젝트
    const { id: second } = await createDraftProject(creator);
    const sameOwnerResult = await saveBasicSection(creator, second, basicSection({ slug: 'taken-slug' }));
    expect(sameOwnerResult).toMatchObject({ ok: false, code: 'duplicate_slug' });

    // 남의 프로젝트
    const other = await seedCreator('h@example.com');
    const { id: third } = await createDraftProject(other);
    const otherOwnerResult = await saveBasicSection(other, third, basicSection({ slug: 'taken-slug' }));
    expect(otherOwnerResult).toMatchObject({ ok: false, code: 'duplicate_slug' });

    const rows = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.slug, 'taken-slug'));
    expect(rows).toHaveLength(1);
  });

  it('content/funding/*.md의 slug와 겹쳐도 거부한다', async () => {
    mockFileSlugs = ['file-project'];
    const creator = await seedCreator('i@example.com');
    const { id } = await createDraftProject(creator);

    const r = await saveBasicSection(creator, id, basicSection({ slug: 'file-project' }));
    expect(r).toMatchObject({ ok: false, code: 'duplicate_slug' });

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, id));
    expect(row.slug).not.toBe('file-project');
  });
});

describe('리워드 개수', () => {
  it('상한을 넘으면 거부한다', async () => {
    const creator = await seedCreator('j@example.com');
    const { id } = await createDraftProject(creator);

    for (let i = 0; i < CREATOR_LIMITS.rewardsMax; i += 1) {
      const r = await upsertReward(creator, id, rewardInput({ rewardId: `reward-${i}` }));
      expect(r).toMatchObject({ ok: true });
    }

    const overflow = await upsertReward(creator, id, rewardInput({ rewardId: 'reward-overflow' }));
    expect(overflow).toMatchObject({ ok: false, code: 'too_many' });

    const rows = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, id));
    expect(rows).toHaveLength(CREATOR_LIMITS.rewardsMax);
  });
});

describe('개설자 정보 저장', () => {
  it('name·contactName·phone·bio·links를 저장하고 다시 읽을 수 있다', async () => {
    const creator = await seedCreator('k@example.com');
    const { id } = await createDraftProject(creator);

    const r = await saveCreatorSection(creator, id, {
      name: '스튜디오 놀',
      contactName: '황경하',
      phone: '010-0000-0000',
      bio: '소개 문구',
      links: ['https://example.com'],
    });
    expect(r).toMatchObject({ ok: true });

    const detail = await loadProjectForCreator(creator, id);
    expect(detail?.creator).toMatchObject({
      name: '스튜디오 놀',
      contactName: '황경하',
      phone: '010-0000-0000',
      bio: '소개 문구',
      links: ['https://example.com'],
    });
  });
});
