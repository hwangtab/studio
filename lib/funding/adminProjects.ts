import { desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects, fundingRewards, type FundingRewardRow } from '../../db/schema';
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

export interface AdminProjectDetail extends AdminProjectSummary {
  summary: string;
  content: string;
  coverUrl: string;
  reviewNote: string | null;
  creator: {
    contactName: string | null;
    phone: string | null;
    bio: string | null;
    links: string[] | null;
  };
  rewards: FundingRewardRow[];
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

  const rewards = await getDb().select().from(fundingRewards)
    .where(eq(fundingRewards.projectId, projectId))
    .orderBy(fundingRewards.sortOrder);

  return {
    ...toSummary(row.project, row.creator),
    summary: row.project.summary,
    content: row.project.content,
    coverUrl: row.project.coverUrl,
    reviewNote: row.project.reviewNote,
    creator: {
      contactName: row.creator.contactName,
      phone: row.creator.phone,
      bio: row.creator.bio,
      links: row.creator.links ? (JSON.parse(row.creator.links) as string[]) : null,
    },
    rewards,
  };
};
