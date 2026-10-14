import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { showSubmissions, shows } from '../../../db/schema';
import { canCreatorEdit, nextReviewStatus, type FundingReviewStatus } from '../../funding/reviewTransition';
import { seedShow, ShowSeedError } from '../seed';
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

  // 승인 뒤: 잠긴 칸은 승인본 값으로 되돌려 합치고, 공연을 먼저 갱신한 뒤에만 초안 행을 바꾼다.
  if (!sub.approvedDraftJson || !row.slug) return conflict('승인된 공연 정보를 찾을 수 없어요. 운영자에게 문의해 주세요.');
  const merged = mergeApprovedEdit(parseDraft(sub.approvedDraftJson), normalized.draft);
  // 첫 회차 7일 규칙은 제출·승인 때의 약속이다. 공연이 가까워진 뒤의 오탈자 수정은 막지 않는다.
  const problems = findSubmitProblems(merged, new Date(0));
  if (problems.length > 0) return { ok: false, status: 400, message: '빠진 칸이 있어요.', problems };
  try {
    await seedShow(db, buildShowDefinition(merged, row.slug), { apply: true, now });
  } catch (err) {
    if (err instanceof ShowSeedError) return { ok: false, status: 400, message: err.message };
    throw err;
  }
  await db
    .update(showSubmissions)
    .set({ draftJson: JSON.stringify(merged), organizerEditedAt: now, updatedAt: now })
    .where(eq(showSubmissions.id, id));
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
