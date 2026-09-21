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

const seedCreator = async (email: string, name = '가나'): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name }).returning();
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

let seedCounter = 0;

/** 개설자 계정 + 초안 프로젝트 하나를 만들고, 필요하면 심사 상태를 바로 옮긴다. */
const seedProject = async (overrides: { reviewStatus?: string } = {}) => {
  seedCounter += 1;
  const creatorId = await seedCreator(`seed-${seedCounter}@example.com`);
  const { id: projectId } = await createDraftProject(creatorId);
  if (overrides.reviewStatus) {
    await mockDb.update(schema.fundingProjects)
      .set({ reviewStatus: overrides.reviewStatus as (typeof schema.fundingReviewStatusEnum)[number] })
      .where(eq(schema.fundingProjects.id, projectId));
  }
  return { creatorId, projectId };
};

/** 승인 전에 기본정보를 실제로 저장해 둔 뒤 승인시킨다 — basicLockedViolation이 비교할 "기존 값"이 필요하다. */
const seedApprovedWithBasic = async () => {
  const { creatorId, projectId } = await seedProject();
  const basic = basicSection();
  await saveBasicSection(creatorId, projectId, basic);
  await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved' })
    .where(eq(schema.fundingProjects.id, projectId));
  return { creatorId, projectId, basic };
};

/** 승인 전에 리워드를 실제로 저장해 둔 뒤 승인시킨다. */
const seedApprovedWithReward = async () => {
  const { creatorId, projectId } = await seedProject();
  const reward = rewardInput();
  await upsertReward(creatorId, projectId, reward);
  await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved' })
    .where(eq(schema.fundingProjects.id, projectId));
  return { creatorId, projectId, reward };
};

describe('createDraftProject / loadProjectForCreator', () => {
  it('초안을 만들고 본인 계정으로 불러올 수 있다', async () => {
    const creator = await seedCreator('me@example.com');
    const { id } = await createDraftProject(creator);
    const detail = await loadProjectForCreator(creator, id);
    expect(detail).not.toBeNull();
    expect(detail?.reviewStatus).toBe('draft');
    expect(detail?.rewards).toEqual([]);
  });

  // 개설자 편집 화면(pages/[locale]/funding/creator/[id].tsx)의 실제 방어선은 여기다 —
  // 화면 쪽 테스트의 목 creator는 손으로 채운 값이라 "실제로 이 컬럼들이 select()에
  // 잡혀도 여기서 걸러지는가"를 증명하지 못한다(2026-09-17 리뷰 지적). 정산·세금 컬럼을
  // 실제로 seed한 뒤 loadProjectForCreator의 반환값에 없는지 직접 본다.
  it('정산·세금 컬럼(taxType 등)을 seed해도 결과의 creator에는 실리지 않는다', async () => {
    const creator = await seedCreator('me@example.com');
    await mockDb.update(schema.fundingCreators).set({
      taxType: 'withholding',
      payoutBankName: '국민은행',
      payoutAccount: '123-456-789012',
      payoutHolder: '개설자',
    }).where(eq(schema.fundingCreators.id, creator));

    const { id } = await createDraftProject(creator);
    const detail = await loadProjectForCreator(creator, id);
    expect(detail).not.toBeNull();
    // email은 이 태스크에서 의도적으로 추가됐다 — submit.ts의 isDefaultCreatorName 판정이
    // 서버 안에서만 쓰려고 필요하다. 화면 props로는 안 나간다는 것은 여기가 아니라
    // toEditorProject를 보는 tests/pages/funding/creator/edit.test.ts가 고정한다.
    expect(Object.keys(detail!.creator).sort()).toEqual(['bio', 'contactName', 'email', 'links', 'name', 'phone'].sort());
    const serialized = JSON.stringify(detail!.creator);
    expect(serialized).not.toContain('taxType');
    expect(serialized).not.toContain('payoutBankName');
    expect(serialized).not.toContain('payoutAccount');
    expect(serialized).not.toContain('payoutHolder');
  });

  it('내부 메모는 개설자 조회에 실리지 않는다', async () => {
    // 운영자가 내부 기록이라 믿고 적은 문장이다. 개설자 화면 props로 나가면
    // __NEXT_DATA__에 그대로 실린다.
    const creator = await seedCreator('me@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects)
      .set({ internalNote: '이 개설자는 지난번에 연락이 끊겼음' })
      .where(eq(schema.fundingProjects.id, id));

    const detail = await loadProjectForCreator(creator, id);

    expect(JSON.stringify(detail)).not.toContain('연락이 끊겼음');
  });
});

describe('saveStorySection — 저장 시점 stripTrustedDirectives 배선', () => {
  it('신뢰 숏코드가 든 줄은 저장 전에 지워진다', async () => {
    // 이 태스크가 stripTrustedDirectives의 첫 호출처다. 렌더 시점이 아니라 저장 시점에
    // 지운다는 것을 확인하려면 응답이 아니라 DB에 실제로 저장된 값을 다시 읽어야 한다 —
    // set({ content: value.content })로 되돌려도 saveStorySection 자체의 반환값은
    // { ok: true }로 똑같기 때문이다.
    const creator = await seedCreator('story-strip@example.com');
    const { id } = await createDraftProject(creator);

    const r = await saveStorySection(creator, id, {
      content: '안녕하세요\n%%price:mixing-level1%%\n계속되는 본문',
    });
    expect(r).toMatchObject({ ok: true });

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, id));
    expect(row.content).not.toContain('%%price:mixing-level1%%');
    expect(row.content).toContain('안녕하세요');
    expect(row.content).toContain('계속되는 본문');
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

  it('잠긴 리워드의 배송 필요 여부를 바꿀 수 없다', async () => {
    const creator = await seedCreator('e2@example.com');
    const { id } = await createDraftProject(creator);
    await upsertReward(creator, id, rewardInput({ rewardId: 'cd', requiresShipping: false }));
    await lockIt(id, 'cd');

    const r = await upsertReward(creator, id, rewardInput({ rewardId: 'cd', requiresShipping: true }));
    expect(r).toMatchObject({ ok: false, code: 'locked' });

    const [row] = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.rewardId, 'cd'));
    expect(row.requiresShipping).toBe(false);
  });

  it('previousRewardId 없이 다른 rewardId로 제출하면 개명이 아니라 별개의 신규 리워드로 취급된다', async () => {
    // 이것이 발견 1의 원인이었다 — previousRewardId를 명시하지 않는 한 id가 다른 입력은
    // "없는 리워드"로 보여 lockedViolation을 타지 않고 새 행이 insert된다. 옛 잠긴 행은
    // 그대로 남는다. 개명을 하려면 반드시 previousRewardId를 함께 넘겨야 한다(아래
    // '리워드 개명' 블록).
    const creator = await seedCreator('e3@example.com');
    const { id } = await createDraftProject(creator);
    await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 30000 }));
    await lockIt(id, 'cd');

    const r = await upsertReward(creator, id, rewardInput({ rewardId: 'cd-renamed-without-flag', amount: 30000 }));
    expect(r).toMatchObject({ ok: true });

    const rows = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, id));
    expect(rows.map((row) => row.rewardId).sort()).toEqual(['cd', 'cd-renamed-without-flag']);
  });

  describe('리워드 개명(previousRewardId)', () => {
    it('잠기지 않은 리워드는 rewardId를 포함해 전부 바뀐다', async () => {
      const creator = await seedCreator('rename1@example.com');
      const { id } = await createDraftProject(creator);
      await upsertReward(creator, id, rewardInput({ rewardId: 'oldd-id', amount: 30000, title: '원래 제목' }));

      const r = await upsertReward(
        creator, id,
        rewardInput({ rewardId: 'fixed-id', amount: 30000, title: '고친 제목' }),
        'oldd-id',
      );
      expect(r).toMatchObject({ ok: true });

      const rows = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, id));
      expect(rows).toHaveLength(1);
      expect(rows[0].rewardId).toBe('fixed-id');
      expect(rows[0].title).toBe('고친 제목');
    });

    it('잠긴 리워드는 개명이 거부되고 행이 그대로 남는다', async () => {
      const creator = await seedCreator('rename2@example.com');
      const { id } = await createDraftProject(creator);
      await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 30000 }));
      await lockIt(id, 'cd');

      const r = await upsertReward(creator, id, rewardInput({ rewardId: 'cd2', amount: 30000 }), 'cd');
      expect(r).toMatchObject({ ok: false, code: 'locked' });

      const rows = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, id));
      expect(rows.map((row) => row.rewardId)).toEqual(['cd']);
    });

    it('새 rewardId가 이미 다른 행이 쓰고 있으면 duplicate_reward', async () => {
      const creator = await seedCreator('rename3@example.com');
      const { id } = await createDraftProject(creator);
      await upsertReward(creator, id, rewardInput({ rewardId: 'a-id', amount: 10000 }));
      await upsertReward(creator, id, rewardInput({ rewardId: 'b-id', amount: 20000 }));

      const r = await upsertReward(creator, id, rewardInput({ rewardId: 'b-id', amount: 10000 }), 'a-id');
      expect(r).toMatchObject({ ok: false, code: 'duplicate_reward' });

      const rows = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, id));
      expect(rows.map((row) => row.rewardId).sort()).toEqual(['a-id', 'b-id']);
      const [aRow] = rows.filter((row) => row.rewardId === 'a-id');
      expect(aRow.amount).toBe(10000);
    });

    it('previousRewardId가 존재하지 않는 리워드를 가리키면 not_found', async () => {
      const creator = await seedCreator('rename4@example.com');
      const { id } = await createDraftProject(creator);

      const r = await upsertReward(creator, id, rewardInput({ rewardId: 'new-id' }), 'never-existed');
      expect(r).toMatchObject({ ok: false, code: 'not_found' });
    });
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

  it('심사 중에는 스토리·리워드 저장도 거부된다', async () => {
    const creator = await seedCreator('f2@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'submitted' })
      .where(eq(schema.fundingProjects.id, id));

    expect(await saveStorySection(creator, id, { content: '본문' })).toMatchObject({ ok: false, code: 'not_editable' });
    expect(await upsertReward(creator, id, rewardInput())).toMatchObject({ ok: false, code: 'not_editable' });
    expect(await deleteReward(creator, id, 'basic')).toMatchObject({ ok: false, code: 'not_editable' });
  });

  it('개설자 프로필은 프로젝트 편집 가능 여부와 무관하게 저장된다', async () => {
    // saveCreatorSection은 계정(fundingCreators) 소속이라 어떤 프로젝트의 심사 상태로도
    // 막히지 않는다 — projectId 자체를 받지 않는다.
    const creator = await seedCreator('f3@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'submitted' })
      .where(eq(schema.fundingProjects.id, id));

    const r = await saveCreatorSection(creator, {
      name: '이름', contactName: null, phone: null, bio: null, links: null,
    });
    expect(r).toMatchObject({ ok: true });

    const [row] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, creator));
    expect(row.name).toBe('이름');
  });

  it('개설자 계정 자체가 없으면 not_found', async () => {
    const r = await saveCreatorSection('없는-id', {
      name: '이름', contactName: null, phone: null, bio: null, links: null,
    });
    expect(r).toMatchObject({ ok: false, code: 'not_found' });
  });
});

describe('승인된 프로젝트가 있으면 개설자 이름이 잠긴다', () => {
  it('approved 프로젝트가 하나라도 있으면 이름 변경이 거부된다', async () => {
    const creator = await seedCreator('locked-name@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved' })
      .where(eq(schema.fundingProjects.id, id));

    const r = await saveCreatorSection(creator, {
      name: '바뀐 이름', contactName: null, phone: null, bio: null, links: null,
    });
    expect(r).toMatchObject({ ok: false, code: 'locked' });

    const [row] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, creator));
    expect(row.name).toBe('가나'); // seedCreator의 기본값 그대로
  });

  it('같은 이름으로 "바꾸려는" 저장(변화 없음)은 approved가 있어도 통과한다', async () => {
    const creator = await seedCreator('locked-name-same@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved' })
      .where(eq(schema.fundingProjects.id, id));

    const r = await saveCreatorSection(creator, {
      name: '가나', contactName: '담당자', phone: null, bio: '소개', links: null,
    });
    expect(r).toMatchObject({ ok: true });

    const [row] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, creator));
    expect(row.bio).toBe('소개');
  });

  it('approved 프로젝트가 없으면(submitted뿐이면) 이름을 바꿀 수 있다', async () => {
    const creator = await seedCreator('unlocked-name@example.com');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'submitted' })
      .where(eq(schema.fundingProjects.id, id));

    const r = await saveCreatorSection(creator, {
      name: '새 이름', contactName: null, phone: null, bio: null, links: null,
    });
    expect(r).toMatchObject({ ok: true });

    const [row] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, creator));
    expect(row.name).toBe('새 이름');
  });

  it('이름이 가입 기본값이면 승인된 프로젝트가 있어도 바꿀 수 있다', async () => {
    // 설정한 적 없는 값을 잠그는 것은 잠금이 아니라 사고다. 기존 행(로컬파트 이름)도
    // 이 예외로 스스로 풀린다 — DB를 손댈 필요가 없다.
    const creator = await seedCreator('hwangtab@gmail.com', 'hwangtab');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved' })
      .where(eq(schema.fundingProjects.id, id));

    const r = await saveCreatorSection(creator, {
      name: '황경하', contactName: null, phone: null, bio: null, links: null,
    });
    expect(r).toMatchObject({ ok: true });

    const [row] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, creator));
    expect(row.name).toBe('황경하');
  });

  it('이름을 이미 골랐으면 승인된 프로젝트가 있을 때 잠긴다', async () => {
    const creator = await seedCreator('hwangtab2@gmail.com', '황경하');
    const { id } = await createDraftProject(creator);
    await mockDb.update(schema.fundingProjects).set({ reviewStatus: 'approved' })
      .where(eq(schema.fundingProjects.id, id));

    const r = await saveCreatorSection(creator, {
      name: '다른 이름', contactName: null, phone: null, bio: null, links: null,
    });
    expect(r).toMatchObject({ ok: false, code: 'locked' });
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

    const r = await saveCreatorSection(creator, {
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

    // 계정 소속이므로 같은 개설자의 다른 프로젝트에서도 같은 값이 보인다.
    const { id: secondProject } = await createDraftProject(creator);
    const secondDetail = await loadProjectForCreator(creator, secondProject);
    expect(secondDetail?.creator.name).toBe('스튜디오 놀');
  });
});

describe('승인 뒤 편집 (Task 5)', () => {
  it('승인된 프로젝트의 본문은 고칠 수 있고 creatorEditedAt이 찍힌다', async () => {
    const { creatorId, projectId } = await seedProject({ reviewStatus: 'approved' });

    const result = await saveStorySection(creatorId, projectId, { content: '고친 본문' });

    expect(result).toMatchObject({ ok: true });
    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, projectId));
    expect(row.content).toBe('고친 본문');
    expect(row.creatorEditedAt).not.toBeNull();
  });

  it('초안 저장은 creatorEditedAt을 찍지 않는다', async () => {
    const { creatorId, projectId } = await seedProject({ reviewStatus: 'draft' });
    await saveStorySection(creatorId, projectId, { content: '초안 본문' });
    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, projectId));
    expect(row.creatorEditedAt).toBeNull();
  });

  it('승인된 프로젝트의 본문 저장은 lastmod를 갱신한다', async () => {
    const { creatorId, projectId } = await seedProject({ reviewStatus: 'approved' });
    await mockDb.update(schema.fundingProjects).set({ lastmod: '2026-01-01' })
      .where(eq(schema.fundingProjects.id, projectId));

    await saveStorySection(creatorId, projectId, { content: '고친 본문' });

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, projectId));
    expect(row.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.lastmod).not.toBe('2026-01-01');
  });

  it('초안 저장은 lastmod를 찍지 않는다', async () => {
    const { creatorId, projectId } = await seedProject({ reviewStatus: 'draft' });
    await saveStorySection(creatorId, projectId, { content: '초안 본문' });
    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, projectId));
    expect(row.lastmod).toBeNull();
  });

  it('승인된 프로젝트의 제목·표지는 고칠 수 있다', async () => {
    const { creatorId, projectId, basic } = await seedApprovedWithBasic();
    const result = await saveBasicSection(creatorId, projectId, { ...basic, title: '고친 제목' });
    expect(result).toMatchObject({ ok: true });

    const [row] = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, projectId));
    expect(row.title).toBe('고친 제목');
    expect(row.creatorEditedAt).not.toBeNull();
  });

  it.each([
    ['slug', { slug: 'other-slug' }, '주소는 바꿀 수 없습니다'],
    ['goalAmount', { goalAmount: 9_999_999 }, '목표 금액은 바꿀 수 없습니다'],
    ['endAt', { endAt: new Date('2027-01-01T00:00:00+09:00') }, '모금 기간은 바꿀 수 없습니다'],
  ])('승인된 프로젝트의 %s는 잠긴다', async (_label, patch, expected) => {
    const { creatorId, projectId, basic } = await seedApprovedWithBasic();
    const result = await saveBasicSection(creatorId, projectId, { ...basic, ...patch });
    expect(result).toMatchObject({ ok: false, code: 'locked' });
    expect((result as { message: string }).message).toContain(expected);
  });

  it('승인된 프로젝트의 리워드는 설명글도 잠긴다', async () => {
    const { creatorId, projectId, reward } = await seedApprovedWithReward();
    const result = await upsertReward(creatorId, projectId, { ...reward, description: '바뀐 설명' });
    expect(result).toMatchObject({ ok: false, code: 'not_editable' });
  });

  it('제출·반려 상태에서는 여전히 아무 구획도 못 고친다', async () => {
    for (const reviewStatus of ['submitted', 'rejected']) {
      const { creatorId, projectId } = await seedProject({ reviewStatus });
      expect(await saveBasicSection(creatorId, projectId, basicSection())).toMatchObject({ ok: false, code: 'not_editable' });
      expect(await saveStorySection(creatorId, projectId, { content: '본문' })).toMatchObject({ ok: false, code: 'not_editable' });
      expect(await upsertReward(creatorId, projectId, rewardInput())).toMatchObject({ ok: false, code: 'not_editable' });
    }
  });
});
