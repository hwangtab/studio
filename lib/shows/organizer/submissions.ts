import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { showSubmissions, shows } from '../../../db/schema';
import { canCreatorEdit, nextReviewStatus, type FundingReviewStatus } from '../../funding/reviewTransition';
import { performerNames, serializeNotices, serializePerformers } from '../structured';
import {
  buildShowDefinition,
  findSubmitProblems,
  mergeApprovedEdit,
  normalizeDraftInput,
  parseDraft,
  type ShowSubmissionDraft,
} from './draft';
import { notifyOperatorShowEdited, notifyOperatorShowSubmitted } from './email';
import { SHOW_ORGANIZER_TERMS_VERSION } from './policy';

export type WriteResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; status: 400 | 404 | 409; message: string; problems?: string[] };

export interface SubmissionView {
  id: string;
  reviewStatus: FundingReviewStatus;
  reviewNote: string | null;
  draft: ShowSubmissionDraft;
  showSlug: string | null;
  submittedAt: Date | null;
}

const NOT_FOUND: WriteResult = { ok: false, status: 404, message: '찾을 수 없어요.' };
const conflict = (message: string): WriteResult => ({ ok: false, status: 409, message });

export async function createSubmission(creatorId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(showSubmissions)
    .values({ creatorId, draftJson: JSON.stringify(parseDraft(null)) })
    .returning({ id: showSubmissions.id });
  return row.id;
}

export async function listSubmissionsForCreator(creatorId: string) {
  const db = getDb();
  const rows = await db
    .select({ sub: showSubmissions, slug: shows.slug, showStatus: shows.status })
    .from(showSubmissions)
    .leftJoin(shows, eq(shows.id, showSubmissions.showId))
    .where(eq(showSubmissions.creatorId, creatorId))
    .orderBy(desc(showSubmissions.createdAt));
  return rows.map(({ sub, slug, showStatus }) => {
    const draft = parseDraft(sub.draftJson);
    return {
      id: sub.id,
      title: draft.title,
      reviewStatus: sub.reviewStatus,
      showSlug: slug ?? null,
      showStatus: showStatus ?? null,
      // 'YYYY-MM-DDTHH:mm' 형식이라 문자열 정렬이 시간순이다.
      firstShowtime: [...draft.showtimes].sort()[0] ?? null,
    };
  });
}

async function loadOwned(creatorId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ sub: showSubmissions, slug: shows.slug })
    .from(showSubmissions)
    .leftJoin(shows, eq(shows.id, showSubmissions.showId))
    .where(and(eq(showSubmissions.id, id), eq(showSubmissions.creatorId, creatorId)))
    .limit(1);
  return row ?? null;
}

export async function loadSubmissionForCreator(creatorId: string, id: string): Promise<SubmissionView | null> {
  const row = await loadOwned(creatorId, id);
  if (!row) return null;
  return {
    id: row.sub.id,
    reviewStatus: row.sub.reviewStatus,
    reviewNote: row.sub.reviewNote,
    draft: parseDraft(row.sub.draftJson),
    showSlug: row.slug ?? null,
    submittedAt: row.sub.submittedAt,
  };
}

async function tryNotify(fn: () => Promise<void>): Promise<string[] | undefined> {
  try {
    await fn();
    return undefined;
  } catch (err) {
    console.error('[shows/organizer] 운영자 알림 메일 실패', err);
    return ['저장은 됐지만 운영자 알림 메일을 보내지 못했어요. 운영자가 직접 확인해야 해요.'];
  }
}

export async function saveSubmission(creatorId: string, id: string, input: unknown, now: Date): Promise<WriteResult> {
  const row = await loadOwned(creatorId, id);
  if (!row) return NOT_FOUND;
  const { sub } = row;
  if (sub.reviewStatus === 'submitted') return conflict('심사 중에는 고칠 수 없어요. 철회하면 고칠 수 있어요.');
  if (!canCreatorEdit(sub.reviewStatus)) return conflict('이 신청서는 더 고칠 수 없어요.');

  const normalized = normalizeDraftInput(input, creatorId);
  if (!normalized.ok) return { ok: false, status: 400, message: normalized.message };
  const db = getDb();

  if (sub.reviewStatus !== 'approved') {
    const res = await db
      .update(showSubmissions)
      .set({ draftJson: JSON.stringify(normalized.draft), updatedAt: now })
      .where(and(eq(showSubmissions.id, id), eq(showSubmissions.reviewStatus, sub.reviewStatus)));
    if (res.rowsAffected === 0) return conflict('상태가 바뀌었어요. 새로 고침해 주세요.');
    return { ok: true };
  }

  // 승인 뒤: 잠긴 칸은 승인본 값으로 되돌려 합친다. 공연 정의 전체를 seedShow로 다시 맞추지 않는다 —
  // 운영자가 손으로 바꾼 정원·가격·회차(change_showtime)를 승인본 값으로 덮어쓰기 때문이다.
  // 그래서 shows 행의 편집 가능한 메타 칸만 갱신하고 구역·회차·티켓 종류는 건드리지 않는다.
  if (!sub.approvedDraftJson || !row.slug || !sub.showId) return conflict('승인된 공연 정보를 찾을 수 없어요. 운영자에게 문의해 주세요.');
  const merged = mergeApprovedEdit(parseDraft(sub.approvedDraftJson), normalized.draft);
  // 첫 회차 7일 규칙은 제출·승인 때의 약속이다. 공연이 가까워진 뒤의 오탈자 수정은 막지 않는다.
  const problems = findSubmitProblems(merged, new Date(0));
  if (problems.length > 0) return { ok: false, status: 400, message: '빠진 칸이 있어요.', problems };
  // 값 매핑은 buildShowDefinition 한 곳에 둔다.
  const def = buildShowDefinition(merged, row.slug);
  const approvedGuard = sql`exists (select 1 from show_submissions where id = ${id} and review_status = 'approved')`;
  const [, subRes] = await db.batch([
    db
      .update(shows)
      .set({
        title: def.title,
        subtitle: def.subtitle ?? null,
        presenterName: def.presenterName,
        performers: performerNames(def.performers),
        performersJson: serializePerformers(def.performers),
        description: def.description,
        coverImage: def.coverImage,
        scheduleNote: def.scheduleNote ?? null,
        noticesJson: def.notices && def.notices.length > 0 ? serializeNotices(def.notices) : null,
        updatedAt: Math.floor(now.getTime() / 1000),
      })
      .where(and(eq(shows.id, sub.showId), approvedGuard)),
    db
      .update(showSubmissions)
      .set({ draftJson: JSON.stringify(merged), organizerEditedAt: now, updatedAt: now })
      .where(and(eq(showSubmissions.id, id), eq(showSubmissions.reviewStatus, 'approved'))),
  ]);
  if (subRes.rowsAffected === 0) return conflict('상태가 바뀌었어요. 새로 고침해 주세요.');
  const warnings = await tryNotify(() => notifyOperatorShowEdited(id));
  return warnings ? { ok: true, warnings } : { ok: true };
}

export async function submitSubmission(
  creatorId: string,
  id: string,
  input: { agreedTerms: boolean },
  now: Date,
): Promise<WriteResult> {
  const row = await loadOwned(creatorId, id);
  if (!row) return NOT_FOUND;
  const next = nextReviewStatus(row.sub.reviewStatus, 'submit');
  if (!next) return conflict('지금은 제출할 수 없는 상태예요.');
  if (input?.agreedTerms !== true) return { ok: false, status: 400, message: '주최자 약관에 동의해 주세요.' };
  const problems = findSubmitProblems(parseDraft(row.sub.draftJson), now);
  if (problems.length > 0) return { ok: false, status: 400, message: '빠진 칸이 있어요.', problems };

  const db = getDb();
  const res = await db
    .update(showSubmissions)
    .set({
      reviewStatus: next,
      organizerTermsVersion: SHOW_ORGANIZER_TERMS_VERSION,
      organizerTermsAgreedAt: now,
      submittedAt: now,
      updatedAt: now,
    })
    .where(and(eq(showSubmissions.id, id), eq(showSubmissions.reviewStatus, row.sub.reviewStatus)));
  if (res.rowsAffected === 0) return conflict('상태가 바뀌었어요. 새로 고침해 주세요.');
  const warnings = await tryNotify(() => notifyOperatorShowSubmitted(id));
  return warnings ? { ok: true, warnings } : { ok: true };
}

export async function withdrawSubmission(creatorId: string, id: string, now: Date): Promise<WriteResult> {
  const row = await loadOwned(creatorId, id);
  if (!row) return NOT_FOUND;
  const next = nextReviewStatus(row.sub.reviewStatus, 'withdraw');
  if (!next) return conflict('심사 중인 신청서만 철회할 수 있어요.');
  const db = getDb();
  const res = await db
    .update(showSubmissions)
    .set({ reviewStatus: next, updatedAt: now })
    .where(and(eq(showSubmissions.id, id), eq(showSubmissions.reviewStatus, row.sub.reviewStatus)));
  if (res.rowsAffected === 0) return conflict('상태가 바뀌었어요. 새로 고침해 주세요.');
  return { ok: true };
}

/** 아직 심사를 안 거쳤거나 다시 손봐야 하는 제출물 수 — 새로 만들 때의 상한(펀딩 projects.ts와 같은 기준). */
export async function countOpenSubmissions(creatorId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(showSubmissions)
    .where(and(
      eq(showSubmissions.creatorId, creatorId),
      inArray(showSubmissions.reviewStatus, ['draft', 'submitted', 'changes_requested']),
    ));
  return row?.value ?? 0;
}
