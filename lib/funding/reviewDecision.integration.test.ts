/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// getFundingProject(마크다운 파일 프로젝트)는 slug 충돌 검사에 쓰인다 — 실제 파일시스템을
// 읽지 않고 테스트가 지정하는 slug만 "파일이 이미 있다"고 답하도록 목으로 고정한다
// (creatorProjectWrite.integration.test.ts와 같은 패턴).
let mockFileSlugs: string[] = [];
jest.mock('./projects', () => ({
  getFundingProject: (slug: string) => (mockFileSlugs.includes(slug) ? ({ slug } as never) : null),
}));

// '읽은 뒤 상태가 바뀌면 409다' 테스트 전용 — 평소엔 실제 adminProjects 구현을 그대로 쓰고,
// loadProjectForAdmin만 그 테스트 안에서 낡은 값을 돌려주도록 덮어쓴다.
//
// mockLoadProjectForAdmin의 기본 동작은 `jest.requireActual`로 얻은 **진짜** 구현을 부르는
// 것이다 — 이 모듈에서 `import { loadProjectForAdmin }`을 쓰면 그 이름은 바로 아래 jest.mock이
// 대체한 값(= mockLoadProjectForAdmin을 부르는 래퍼)으로 해석되어, "기본 동작 = 진짜 구현
// 호출"을 그 래퍼로 구현하는 순간 자기 자신을 무한히 부르게 된다. requireActual은 모의
// 레지스트리를 건너뛰므로 이 함정을 피한다.
const realAdminProjects = jest.requireActual('./adminProjects') as typeof import('./adminProjects');
const mockLoadProjectForAdmin = jest.fn(realAdminProjects.loadProjectForAdmin);
jest.mock('./adminProjects', () => ({
  ...jest.requireActual('./adminProjects'),
  loadProjectForAdmin: (...args: Parameters<typeof realAdminProjects.loadProjectForAdmin>) => mockLoadProjectForAdmin(...args),
}));

// eslint-disable-next-line import/first
import { decideProject } from './reviewDecision';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeEach(async () => {
  mockFileSlugs = [];
  mockLoadProjectForAdmin.mockImplementation(realAdminProjects.loadProjectForAdmin);
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
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name: '개설자' }).returning();
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
    submittedAt: new Date('2026-09-10T00:00:00Z'),
    // 기본값은 "정상적으로 제출된" 프로젝트 — submit.ts가 항상 이 값을 함께 찍는다.
    // 동의 기록 부재를 보는 테스트만 명시적으로 null을 override한다.
    creatorTermsVersion: 'funding-creator-terms-2026-09-18',
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

const readRewards = async (projectId: string) =>
  mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.projectId, projectId));

describe('승인', () => {
  it('리워드 전부에 lockedAt을 찍는다', async () => {
    const creator = await seedCreator('a@example.com');
    const projectId = await seedProject(creator);
    await seedReward(projectId, { rewardId: 'basic' });
    await seedReward(projectId, { rewardId: 'plus', amount: 50_000 });

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result.ok).toBe(true);

    const rewards = await readRewards(projectId);
    expect(rewards).toHaveLength(2);
    for (const reward of rewards) {
      expect(reward.lockedAt).not.toBeNull();
    }
  });

  it('status를 auto로 연다', async () => {
    const creator = await seedCreator('b@example.com');
    const projectId = await seedProject(creator, { status: 'draft' });
    await seedReward(projectId);

    const before = await readProject(projectId);
    expect(before.status).toBe('draft');

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result.ok).toBe(true);

    const after = await readProject(projectId);
    expect(after.status).toBe('auto');
  });

  it('approvedAt과 reviewStatus를 함께 기록한다', async () => {
    const creator = await seedCreator('c@example.com');
    const projectId = await seedProject(creator);
    await seedReward(projectId);
    const now = new Date('2026-09-18T03:00:00Z');

    const result = await decideProject(projectId, 'approve', {}, now);
    expect(result.ok).toBe(true);

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe('approved');
    expect(after.approvedAt?.getTime()).toBe(now.getTime());
  });

  it('이미 잠긴 리워드의 lockedAt을 덮어쓰지 않는다', async () => {
    const creator = await seedCreator('d@example.com');
    // approved에서 시작 — 재승인 같은 경로가 생겨도 최초 잠금 시각이 남아야 한다는 것을
    // 보려면 이미 승인된 프로젝트가 필요하다. reviewTransition 표엔 approved에서 나가는
    // 액션이 없으므로, 이 테스트는 "이미 잠긴 리워드가 있는 프로젝트를 다시 approve로
    // 판정하려 하면 nextReviewStatus가 막아 conflict가 난다"가 아니라, 잠금 자체의 성질
    // (한 번 찍히면 안 바뀐다)을 직접 UPDATE로 확인한다.
    const projectId = await seedProject(creator, { reviewStatus: 'submitted' });
    const originalLockedAt = new Date('2026-09-01T00:00:00Z');
    await seedReward(projectId, { rewardId: 'already-locked', lockedAt: originalLockedAt });
    await seedReward(projectId, { rewardId: 'fresh' });

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result.ok).toBe(true);

    const rewards = await readRewards(projectId);
    const already = rewards.find((r) => r.rewardId === 'already-locked')!;
    const fresh = rewards.find((r) => r.rewardId === 'fresh')!;
    expect(already.lockedAt?.getTime()).toBe(originalLockedAt.getTime());
    expect(fresh.lockedAt).not.toBeNull();
    expect(fresh.lockedAt?.getTime()).not.toBe(originalLockedAt.getTime());
  });

  it('slug를 바꿔 승인할 수 있다', async () => {
    const creator = await seedCreator('e@example.com');
    const projectId = await seedProject(creator, { slug: 'original-slug' });
    await seedReward(projectId);

    const result = await decideProject(projectId, 'approve', { slug: 'curated-slug' }, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: true, slug: 'curated-slug' });

    const after = await readProject(projectId);
    expect(after.slug).toBe('curated-slug');
  });

  it('예약 slug로는 승인되지 않는다', async () => {
    const creator = await seedCreator('f@example.com');
    const projectId = await seedProject(creator);
    await seedReward(projectId);
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'approve', { slug: 'apply' }, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'invalid_slug', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.slug).toBe(before.slug);
    expect(after.status).toBe(before.status);
  });

  it('마크다운 파일과 겹치는 slug로는 승인되지 않는다', async () => {
    mockFileSlugs = ['taken-by-file'];
    const creator = await seedCreator('g@example.com');
    const projectId = await seedProject(creator, { slug: 'taken-by-file' });
    await seedReward(projectId);
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'duplicate_slug', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.status).toBe(before.status);
  });

  it('다른 DB 프로젝트와 겹치는 slug로는 승인되지 않는다', async () => {
    const creator = await seedCreator('h@example.com');
    await seedProject(creator, { slug: 'already-approved', reviewStatus: 'approved', status: 'auto' });
    const projectId = await seedProject(creator, { slug: 'still-mine' });
    await seedReward(projectId);
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'approve', { slug: 'already-approved' }, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'duplicate_slug', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.slug).toBe('still-mine');
  });

  it('필수값이 빈 프로젝트는 승인되지 않는다', async () => {
    const creator = await seedCreator('i@example.com');
    const projectId = await seedProject(creator, { content: '너무 짧은 본문' });
    // 리워드를 하나도 만들지 않는다 — '리워드 최소 1개' 요건까지 함께 걸린다.
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'incomplete', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.status).toBe(before.status);
    expect(after.approvedAt).toBeNull();
  });

  it('종료일이 이미 지난 프로젝트는 승인되지 않는다', async () => {
    const creator = await seedCreator('q@example.com');
    // leadDays(3일)보다 심사가 오래 걸려 startAt·endAt이 모두 과거가 된 경우를 흉내낸다.
    const projectId = await seedProject(creator, {
      startAt: new Date('2026-09-01T00:00:00Z'),
      endAt: new Date('2026-09-10T00:00:00Z'),
    });
    await seedReward(projectId);
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'expired', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.status).toBe(before.status);
    expect(after.approvedAt).toBeNull();
    const rewards = await readRewards(projectId);
    for (const reward of rewards) expect(reward.lockedAt).toBeNull();
  });

  it('동의 기록(creatorTermsVersion)이 없는 프로젝트는 승인되지 않는다', async () => {
    const creator = await seedCreator('s@example.com');
    // 이 게이트가 생기기 전(3차 배포 이전)에 이미 submitted로 남아 있던 프로젝트를 흉내낸다.
    const projectId = await seedProject(creator, { creatorTermsVersion: null });
    await seedReward(projectId);
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'terms_not_agreed', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.approvedAt).toBeNull();
    const rewards = await readRewards(projectId);
    for (const reward of rewards) expect(reward.lockedAt).toBeNull();
  });

  it('동의 기록이 있으면 승인된다', async () => {
    const creator = await seedCreator('t@example.com');
    const projectId = await seedProject(creator, { creatorTermsVersion: 'funding-creator-terms-2026-09-18' });
    await seedReward(projectId);

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result.ok).toBe(true);
  });

  it('시작일만 지난 프로젝트는 승인되지만 경고를 함께 돌려준다', async () => {
    const creator = await seedCreator('r@example.com');
    // 시작일은 지났지만 종료일은 아직 남아 있다 — 거부할 이유가 없다.
    const projectId = await seedProject(creator, {
      startAt: new Date('2026-09-10T00:00:00Z'),
      endAt: new Date('2026-10-31T00:00:00Z'),
    });
    await seedReward(projectId);

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: true, slug: expect.any(String), warnings: ['시작일이 이미 지나 승인 즉시 모금이 시작됩니다.'] });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe('approved');
    expect(after.status).toBe('auto');
  });
});

describe('보완 요청·반려', () => {
  it('메모 없이는 보완 요청을 할 수 없다', async () => {
    const creator = await seedCreator('j@example.com');
    const projectId = await seedProject(creator);
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'request_changes', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'incomplete', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
  });

  it('보완 요청은 changes_requested로 보내고 메모를 남긴다', async () => {
    const creator = await seedCreator('k@example.com');
    const projectId = await seedProject(creator);

    const result = await decideProject(projectId, 'request_changes', { note: '표지 이미지를 다시 올려 주세요.' }, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: true, slug: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe('changes_requested');
    expect(after.reviewNote).toBe('표지 이미지를 다시 올려 주세요.');
  });

  it('메모 없이는 반려할 수 없다', async () => {
    const creator = await seedCreator('j2@example.com');
    const projectId = await seedProject(creator);
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'reject', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'incomplete', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.rejectedAt).toBeNull();
  });

  it('반려는 rejected로 보내고 rejectedAt을 남긴다', async () => {
    const creator = await seedCreator('l@example.com');
    const projectId = await seedProject(creator);
    const now = new Date('2026-09-18T05:00:00Z');

    const result = await decideProject(projectId, 'reject', { note: '서비스 범위와 맞지 않습니다.' }, now);
    expect(result.ok).toBe(true);

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe('rejected');
    expect(after.rejectedAt?.getTime()).toBe(now.getTime());
    expect(after.reviewNote).toBe('서비스 범위와 맞지 않습니다.');
  });

  it('반려된 프로젝트는 status가 draft로 남는다', async () => {
    const creator = await seedCreator('m@example.com');
    const projectId = await seedProject(creator, { status: 'draft' });

    const result = await decideProject(projectId, 'reject', { note: '반려 사유' }, new Date('2026-09-18T00:00:00Z'));
    expect(result.ok).toBe(true);

    const after = await readProject(projectId);
    expect(after.status).toBe('draft');
  });
});

describe('보관(archive)', () => {
  it('메모 없이는 보관할 수 없다', async () => {
    const creator = await seedCreator('u@example.com');
    const projectId = await seedProject(creator, { reviewStatus: 'draft', submittedAt: null });
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'archive', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'incomplete', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.rejectedAt).toBeNull();
  });

  it.each(['draft', 'submitted', 'changes_requested'] as const)(
    '%s 프로젝트를 보관하면 rejected로 옮기고 rejectedAt·reviewNote를 남긴다',
    async (reviewStatus) => {
      const creator = await seedCreator(`v-${reviewStatus}@example.com`);
      const projectId = await seedProject(creator, {
        reviewStatus,
        submittedAt: reviewStatus === 'draft' ? null : new Date('2026-09-10T00:00:00Z'),
      });
      const now = new Date('2026-09-18T06:00:00Z');

      const result = await decideProject(projectId, 'archive', { note: '오래 방치되어 정리합니다.' }, now);
      expect(result).toEqual({ ok: true, slug: expect.any(String) });

      const after = await readProject(projectId);
      expect(after.reviewStatus).toBe('rejected');
      expect(after.rejectedAt?.getTime()).toBe(now.getTime());
      expect(after.reviewNote).toBe('오래 방치되어 정리합니다.');
      // status는 건드리지 않는다 — 반려와 같은 불변식.
      expect(after.status).toBe('draft');
    },
  );

  it('승인된 프로젝트는 보관할 수 없다', async () => {
    const creator = await seedCreator('w@example.com');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'auto',
      approvedAt: new Date('2026-09-01T00:00:00Z'),
    });
    const before = await readProject(projectId);

    const result = await decideProject(projectId, 'archive', { note: '정리 사유' }, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'conflict', message: expect.any(String) });

    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe(before.reviewStatus);
    expect(after.status).toBe(before.status);
  });
});

describe('경합과 전이', () => {
  it.each(['draft', 'approved', 'rejected'] as const)('%s 프로젝트는 판정할 수 없다', async (reviewStatus) => {
    const creator = await seedCreator(`n-${reviewStatus}@example.com`);
    const projectId = await seedProject(creator, { reviewStatus, submittedAt: reviewStatus === 'draft' ? null : new Date('2026-09-10T00:00:00Z') });

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'conflict', message: expect.any(String) });
  });

  it('읽은 뒤 상태가 바뀌면 409다', async () => {
    const creator = await seedCreator('o@example.com');
    // 실제 행: 이미 다른 관리자(또는 중복 클릭)가 승인까지 마쳤다. 리워드는 **일부러
    // 안 잠근 채로** 둔다 — 잠가 두면 아래 lockedAt 단언이 "이미 잠겨 있어서 그런지,
    // 이 호출이 안 건드려서 그런지" 구분이 안 된다. 여기서 확인하려는 것은 후자다:
    // review_status='approved'만으로는 이 호출이 쓴 것인지 남이 이미 써 놓은 것인지
    // EXISTS가 구분 못 하면, 0행짜리(=conflict) 이 호출이 그래도 리워드를 잠가 버린다.
    const approvedAt = new Date('2026-09-15T00:00:00Z');
    const projectId = await seedProject(creator, {
      reviewStatus: 'approved',
      status: 'auto',
      approvedAt,
      slug: 'already-approved-elsewhere',
    });
    await seedReward(projectId, { lockedAt: null });

    // 이 호출이 읽은 시점의 스냅샷은 낡았다 — 아직 submitted로 보인다.
    const stale = await realAdminProjects.loadProjectForAdmin(projectId);
    mockLoadProjectForAdmin.mockResolvedValueOnce({ ...stale!, reviewStatus: 'submitted' });

    const result = await decideProject(projectId, 'approve', {}, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'conflict', message: expect.any(String) });

    // 실제 행은 그대로다 — 이 호출의 승인 시도가 approvedAt·slug를 덮어쓰지 않았다.
    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe('approved');
    expect(after.approvedAt?.getTime()).toBe(approvedAt.getTime());
    expect(after.slug).toBe('already-approved-elsewhere');

    // 가장 위험한 단언 — review_status가 이미 'approved'라는 사실만으로 이 호출의
    // 리워드 UPDATE가 통과해 버리면 안 된다. EXISTS가 "이 호출이 방금 그 값을 썼다"까지
    // 확인해야 이 값이 null로 남는다.
    const [reward] = await readRewards(projectId);
    expect(reward.lockedAt).toBeNull();
  });

  it('승인 실패 시 lockedAt이 하나도 안 찍힌다', async () => {
    mockFileSlugs = [];
    const creator = await seedCreator('p@example.com');
    await seedProject(creator, { slug: 'taken-slug', reviewStatus: 'approved', status: 'auto' });
    const projectId = await seedProject(creator, { slug: 'my-own-slug' });
    await seedReward(projectId, { rewardId: 'one' });
    await seedReward(projectId, { rewardId: 'two', amount: 50_000 });

    // slug 충돌로 실패한다 — 다른 DB 프로젝트가 이미 'taken-slug'를 쓰고 있다.
    const result = await decideProject(projectId, 'approve', { slug: 'taken-slug' }, new Date('2026-09-18T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'duplicate_slug', message: expect.any(String) });

    const rewards = await readRewards(projectId);
    expect(rewards).toHaveLength(2);
    for (const reward of rewards) {
      expect(reward.lockedAt).toBeNull();
    }
    const after = await readProject(projectId);
    expect(after.reviewStatus).toBe('submitted');
    expect(after.status).toBe('draft');
  });
});
