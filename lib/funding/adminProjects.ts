import { desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects, fundingRewards } from '../../db/schema';
import type { FundingReviewStatus } from './reviewTransition';

/**
 * 관리자 시점 조회.
 *
 * 개설자 쪽(`creatorProjectWrite.ts`)은 모든 함수가 `creatorId`를 요구하고 남의 것은
 * `not_found`로 답한다 — 그 파일에 소유 조건 없는 함수를 두면 언젠가 조건 없이 호출되기
 * 때문이다. 관리자는 정반대로 전부 볼 수 있어야 하므로 **파일을 나눈다.** 여기 있는 함수는
 * 반드시 `authenticateAdminApi`/`authenticateAdminRequest` 뒤에서만 부른다.
 */
export interface AdminProjectSummary {
  id: string;
  slug: string;
  title: string;
  reviewStatus: FundingReviewStatus;
  status: string;
  hidden: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  creatorName: string;
  creatorEmail: string;
  goalAmount: number;
  startAt: string;
  endAt: string;
}

/**
 * 심사 화면이 보는 리워드. `fundingRewards`를 통째로(`FundingRewardRow`) 넘기지 않는다 —
 * `downloads`는 R2 객체 키라 심사 화면이 볼 이유가 없고, 앞으로 컬럼이 늘어도 이 조회가
 * 그것을 화면 props로 실어 나르는 유일한 경로가 되지 않게 여기서도 필드를 하나씩 고른다.
 */
export interface AdminRewardSummary {
  rewardId: string;
  title: string;
  description: string;
  amount: number;
  totalQuantity: number | null;
  requiresShipping: boolean;
  estimatedDelivery: string;
  imageUrl: string | null;
  sortOrder: number;
  lockedAt: Date | null;
}

export interface AdminProjectDetail extends AdminProjectSummary {
  summary: string;
  content: string;
  coverUrl: string;
  reviewNote: string | null;
  /** 운영자 전용. 개설자에게 보이지 않는다 — `reviewNote`와 헷갈리지 말 것. */
  internalNote: string | null;
  /**
   * 개설자가 심사 신청 시 동의한 약관 판본(`submit.ts`가 기록). 승인 판정
   * (`reviewDecision.ts`)이 이 값을 재확인한다 — 이 컬럼이 나오기 전(3차 배포 이전)에
   * `submitted`로 남아 있던 프로젝트는 동의 기록 없이 제출됐을 수 있어 null일 수 있다.
   */
  creatorTermsVersion: string | null;
  creator: {
    contactName: string | null;
    phone: string | null;
    bio: string | null;
    links: string[] | null;
  };
  rewards: AdminRewardSummary[];
}

const toSummary = (
  row: typeof fundingProjects.$inferSelect,
  creator: typeof fundingCreators.$inferSelect,
): AdminProjectSummary => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  reviewStatus: row.reviewStatus,
  status: row.status,
  hidden: row.hidden,
  submittedAt: row.submittedAt?.toISOString() ?? null,
  approvedAt: row.approvedAt?.toISOString() ?? null,
  creatorName: creator.name,
  creatorEmail: creator.email,
  goalAmount: row.goalAmount,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt.toISOString(),
});

/**
 * 심사 대기함. 상태·소유 조건이 없다 — 운영자가 전부 봐야 하는 목록이라 개설자 쪽 조회와는
 * 목적이 반대다. submittedAt 내림차순(SQLite 정렬 규칙상 NULL은 자동으로 뒤로 간다).
 */
export const listProjectsForAdmin = async (
  filter?: { reviewStatus?: FundingReviewStatus },
): Promise<AdminProjectSummary[]> => {
  const query = getDb()
    .select({ project: fundingProjects, creator: fundingCreators })
    .from(fundingProjects)
    .innerJoin(fundingCreators, eq(fundingProjects.creatorId, fundingCreators.id))
    .orderBy(desc(fundingProjects.submittedAt));

  const rows = filter?.reviewStatus
    ? await query.where(eq(fundingProjects.reviewStatus, filter.reviewStatus))
    : await query;

  return rows.map(({ project, creator }) => toSummary(project, creator));
};

/** id로 단건 조회. 상태 무관 — 심사 화면은 draft·submitted 어느 쪽이든 열어 봐야 한다. */
export const loadProjectForAdmin = async (projectId: string): Promise<AdminProjectDetail | null> => {
  const [row] = await getDb()
    .select({ project: fundingProjects, creator: fundingCreators })
    .from(fundingProjects)
    .innerJoin(fundingCreators, eq(fundingProjects.creatorId, fundingCreators.id))
    .where(eq(fundingProjects.id, projectId))
    .limit(1);
  if (!row) return null;

  const rewardRows = await getDb().select().from(fundingRewards)
    .where(eq(fundingRewards.projectId, projectId))
    .orderBy(fundingRewards.sortOrder);

  const rewards: AdminRewardSummary[] = rewardRows.map((r) => ({
    rewardId: r.rewardId,
    title: r.title,
    description: r.description,
    amount: r.amount,
    totalQuantity: r.totalQuantity,
    requiresShipping: r.requiresShipping,
    estimatedDelivery: r.estimatedDelivery,
    imageUrl: r.imageUrl,
    sortOrder: r.sortOrder,
    lockedAt: r.lockedAt,
  }));

  return {
    ...toSummary(row.project, row.creator),
    summary: row.project.summary,
    content: row.project.content,
    coverUrl: row.project.coverUrl,
    reviewNote: row.project.reviewNote,
    internalNote: row.project.internalNote,
    creatorTermsVersion: row.project.creatorTermsVersion,
    creator: {
      contactName: row.creator.contactName,
      phone: row.creator.phone,
      bio: row.creator.bio,
      links: row.creator.links ? (JSON.parse(row.creator.links) as string[]) : null,
    },
    rewards,
  };
};
