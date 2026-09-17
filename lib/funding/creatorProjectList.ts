import { desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';

export interface CreatorProjectSummary {
  id: string;
  slug: string;
  title: string;
  reviewStatus: string;
  status: string;
  reviewNote: string | null;
  updatedAt: string;
}

/**
 * 개설자 본인의 프로젝트 목록.
 *
 * **creatorId를 인자로 요구하는 것이 이 함수의 전부다.** "전체를 가져와 화면에서 거른다"는
 * 모양의 함수를 이 파일에 두지 않는다 — 한 번이라도 그런 함수가 있으면 언젠가 소유 조건
 * 없이 호출된다.
 */
export const listProjectsForCreator = async (creatorId: string): Promise<CreatorProjectSummary[]> => {
  const rows = await getDb().select().from(fundingProjects)
    .where(eq(fundingProjects.creatorId, creatorId))
    .orderBy(desc(fundingProjects.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    reviewStatus: r.reviewStatus,
    status: r.status,
    reviewNote: r.reviewNote,
    updatedAt: r.updatedAt.toISOString(),
  }));
};
