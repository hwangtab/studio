import { desc, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { fundingCreators, showSubmissions, shows } from '../../../db/schema';
import { parseDraft, type ShowSubmissionDraft } from './draft';

/**
 * 운영자 시점 조회 — 소유 조건이 없으므로 반드시 authenticateAdminRequest/authenticateAdminApi 뒤에서만 부른다.
 * 주최자 쪽(submissions.ts)은 creatorId를 요구하는 함수만 둔다(lib/funding/adminProjects.ts와 같은 분리).
 * 날짜는 getServerSideProps 직렬화를 위해 ISO 문자열로 준다.
 */
export interface AdminSubmissionSummary {
  id: string;
  title: string;
  reviewStatus: string;
  submittedAt: string | null;
  creatorEmail: string;
  firstShowtime: string | null;
}

export interface AdminSubmissionDetail {
  id: string;
  reviewStatus: string;
  reviewNote: string | null;
  internalNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  organizerEditedAt: string | null;
  organizerTermsVersion: string | null;
  /** 관리자 사업자 정보 패널(`CreatorTaxProfilePanel`)이 조회 주소에 쓴다. */
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  draft: ShowSubmissionDraft;
  show: { id: string; slug: string; status: string } | null;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** 작성중(draft)은 아직 제출 전이라 목록에 두지 않는다. */
export async function listSubmissionsForAdmin(): Promise<AdminSubmissionSummary[]> {
  const rows = await getDb()
    .select({ sub: showSubmissions, creatorEmail: fundingCreators.email })
    .from(showSubmissions)
    .innerJoin(fundingCreators, eq(fundingCreators.id, showSubmissions.creatorId))
    .where(ne(showSubmissions.reviewStatus, 'draft'))
    .orderBy(desc(showSubmissions.submittedAt));
  return rows.map(({ sub, creatorEmail }) => {
    const draft = parseDraft(sub.draftJson);
    return {
      id: sub.id,
      title: draft.title,
      reviewStatus: sub.reviewStatus,
      submittedAt: iso(sub.submittedAt),
      creatorEmail,
      // 'YYYY-MM-DDTHH:mm' 형식이라 문자열 정렬이 시간순이다.
      firstShowtime: [...draft.showtimes].sort()[0] ?? null,
    };
  });
}

export async function countPendingSubmissions(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(showSubmissions)
    .where(eq(showSubmissions.reviewStatus, 'submitted'));
  return Number(row?.n ?? 0);
}

export async function loadSubmissionForAdmin(id: string): Promise<AdminSubmissionDetail | null> {
  const [row] = await getDb()
    .select({
      sub: showSubmissions,
      creatorName: fundingCreators.name,
      creatorEmail: fundingCreators.email,
      showId: shows.id,
      showSlug: shows.slug,
      showStatus: shows.status,
    })
    .from(showSubmissions)
    .innerJoin(fundingCreators, eq(fundingCreators.id, showSubmissions.creatorId))
    .leftJoin(shows, eq(shows.id, showSubmissions.showId))
    .where(eq(showSubmissions.id, id))
    .limit(1);
  if (!row) return null;
  const { sub } = row;
  return {
    id: sub.id,
    reviewStatus: sub.reviewStatus,
    reviewNote: sub.reviewNote,
    internalNote: sub.internalNote,
    submittedAt: iso(sub.submittedAt),
    approvedAt: iso(sub.approvedAt),
    organizerEditedAt: iso(sub.organizerEditedAt),
    organizerTermsVersion: sub.organizerTermsVersion,
    creatorId: sub.creatorId,
    creatorName: row.creatorName,
    creatorEmail: row.creatorEmail,
    draft: parseDraft(sub.draftJson),
    show: row.showId && row.showSlug ? { id: row.showId, slug: row.showSlug, status: row.showStatus ?? '' } : null,
  };
}
