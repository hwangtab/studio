import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  fundingProjects, fundingRewards,
  type FundingProjectRow, type FundingRewardRow,
} from '../../db/schema';

import { validateFundingProjectShape, type FundingProject } from './shape';

/**
 * DB 행을 frontmatter 모양으로 편다.
 *
 * 곧바로 FundingProject를 조립하지 않는 이유: 그러면 DB 경로만 검증을 건너뛴다.
 * 같은 입구(validateFundingProjectShape)를 지나야 status 오타·잘못된 downloads 키 같은
 * 것이 md와 똑같이 걸린다.
 */
export const rowToShapeInput = (row: FundingProjectRow, rewards: FundingRewardRow[]): Record<string, unknown> => ({
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  cover: row.coverUrl,
  ogImage: row.ogImageUrl ?? undefined,
  heroImage: row.heroImageUrl ?? undefined,
  goalAmount: row.goalAmount,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt.toISOString(),
  status: row.status,
  hidden: row.hidden,
  lastmod: row.lastmod ?? undefined,
  rewards: [...rewards]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.rewardId.localeCompare(b.rewardId))
    .map((r) => ({
      id: r.rewardId,
      title: r.title,
      description: r.description,
      amount: r.amount,
      totalQuantity: r.totalQuantity,
      requiresShipping: r.requiresShipping,
      estimatedDelivery: r.estimatedDelivery,
      image: r.imageUrl ?? undefined,
      downloads: r.downloads ? JSON.parse(r.downloads) : undefined,
    })),
});

export const rowsToFundingProject = (row: FundingProjectRow, rewards: FundingRewardRow[]): FundingProject =>
  validateFundingProjectShape(rowToShapeInput(row, rewards), row.slug, row.content);

/** 공개 경로가 보는 조건 — 심사를 통과한 것만. */
const APPROVED = eq(fundingProjects.reviewStatus, 'approved');

export const getDbFundingProject = async (slug: string): Promise<FundingProject | null> => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.slug, slug), APPROVED)).limit(1);
  if (!row) return null;
  const rewards = await getDb().select().from(fundingRewards)
    .where(eq(fundingRewards.projectId, row.id)).orderBy(asc(fundingRewards.sortOrder));
  try {
    return rowsToFundingProject(row, rewards);
  } catch (error: unknown) {
    // 검증에 걸린 행을 공개하지 않는다. 500으로 터뜨리는 대신 없는 것으로 보고 기록만 남긴다.
    console.error(`[funding] DB 프로젝트 검증 실패 — slug=${slug}:`, error);
    return null;
  }
};

export const listDbFundingProjects = async (): Promise<FundingProject[]> => {
  const rows = await getDb().select().from(fundingProjects).where(APPROVED);
  if (rows.length === 0) return [];
  const allRewards = await getDb().select().from(fundingRewards).orderBy(asc(fundingRewards.sortOrder));
  const byProject = new Map<string, FundingRewardRow[]>();
  for (const r of allRewards) {
    const list = byProject.get(r.projectId) ?? [];
    list.push(r);
    byProject.set(r.projectId, list);
  }
  const out: FundingProject[] = [];
  for (const row of rows) {
    try {
      out.push(rowsToFundingProject(row, byProject.get(row.id) ?? []));
    } catch (error: unknown) {
      // 행 하나가 목록 전체를 터뜨리면 진행 중인 다른 프로젝트까지 사라진다.
      console.error(`[funding] DB 프로젝트 검증 실패 — slug=${row.slug}:`, error);
    }
  }
  return out;
};
