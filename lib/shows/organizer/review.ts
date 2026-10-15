import { and, eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { showSubmissions, showTicketTypes, showtimes, shows, showZones } from '../../../db/schema';
import { nextReviewStatus } from '../../funding/reviewTransition';
import { seedShow } from '../seed';
import { isPublishable, sqlUpdateStatus } from '../revalidate';
import { validateShowSlug } from '../reservedSlugs';
import { buildShowDefinition, findSubmitProblems, parseDraft } from './draft';
import { sendShowReviewResultEmail, type ShowReviewResult } from './email';

export type ShowDecisionAction = 'approve' | 'request_changes' | 'reject';
export type ShowDecisionCode =
  | 'not_found'
  | 'conflict'
  | 'invalid_slug'
  | 'duplicate_slug'
  | 'incomplete'
  | 'terms_not_agreed'
  | 'seed_failed';
export type ShowDecisionResult =
  | { ok: true; slug?: string; warnings?: string[] }
  | { ok: false; code: ShowDecisionCode; message: string };

const STALE_VERSION_MESSAGE = '그 사이 주최자가 수정해 다시 제출했어요. 새로고침해 새 판본을 확인해 주세요.';
const deny = (code: ShowDecisionCode, message: string): ShowDecisionResult => ({ ok: false, code, message });

async function notify(id: string, result: ShowReviewResult): Promise<string[]> {
  try {
    await sendShowReviewResultEmail(id, result);
    return [];
  } catch (error) {
    console.error(`[shows/organizer] 심사 결과 메일 실패 (id=${id}, result=${result})`, error);
    return ['판정은 반영됐지만 주최자에게 보내는 안내 메일이 실패했어요. 직접 알려 주세요.'];
  }
}

export async function decideShowSubmission(
  id: string,
  action: ShowDecisionAction,
  input: { note?: string; slug?: string; expectedSubmittedAt?: string },
  now: Date = new Date(),
): Promise<ShowDecisionResult> {
  const db = getDb();
  const [sub] = await db.select().from(showSubmissions).where(eq(showSubmissions.id, id)).limit(1);
  if (!sub) return deny('not_found', '제출물을 찾을 수 없어요.');

  const next = nextReviewStatus(sub.reviewStatus, action);
  if (!next) return deny('conflict', '지금 상태에서는 그 판정을 할 수 없어요.');

  // 운영자가 본 판본이 지금 판본인지 — 재제출마다 submittedAt이 바뀐다(lib/funding/reviewDecision.ts와 같은 규칙).
  if (input.expectedSubmittedAt !== undefined) {
    const expectedMs = new Date(input.expectedSubmittedAt).getTime();
    const currentMs = sub.submittedAt ? sub.submittedAt.getTime() : null;
    if (Number.isNaN(expectedMs) || currentMs !== expectedMs) return deny('conflict', STALE_VERSION_MESSAGE);
  }
  const sameVersion = and(
    eq(showSubmissions.id, id),
    eq(showSubmissions.reviewStatus, sub.reviewStatus),
    sub.submittedAt ? eq(showSubmissions.submittedAt, sub.submittedAt) : undefined,
  );

  if (action !== 'approve') {
    const note = input.note?.trim() || null;
    if (!note) {
      return deny('incomplete', action === 'reject' ? '반려에는 사유 메모가 필요해요.' : '보완 요청에는 안내 메모가 필요해요.');
    }
    const res = await db
      .update(showSubmissions)
      .set({ reviewStatus: next, reviewNote: note, ...(action === 'reject' ? { rejectedAt: now } : {}), updatedAt: now })
      .where(sameVersion);
    if (Number(res.rowsAffected) === 0) return deny('conflict', STALE_VERSION_MESSAGE);
    const warnings = await notify(id, action === 'reject' ? 'rejected' : 'changes_requested');
    return warnings.length > 0 ? { ok: true, warnings } : { ok: true };
  }

  if (!sub.organizerTermsVersion) return deny('terms_not_agreed', '주최자 약관 동의 기록이 없어요.');

  const draft = parseDraft(sub.draftJson);
  const problems = findSubmitProblems(draft, now);
  if (problems.length > 0) return deny('incomplete', `승인할 수 없어요: ${problems.join(' / ')}`);

  const slug = input.slug?.trim() ?? '';
  const slugProblem = validateShowSlug(slug);
  if (slugProblem) return deny('invalid_slug', slugProblem);

  // 같은 slug의 공연이 하나라도 있으면 중복이다 — 운영자가 data/shows/<slug>.ts로 만든 초안을 가로채거나
  // 남은 회차·티켓타입에 섞어 쓰지 않도록 이어받기는 하지 않는다.
  const [existing] = await db.select({ id: shows.id }).from(shows).where(eq(shows.slug, slug)).limit(1);
  if (existing) return deny('duplicate_slug', `slug "${slug}"는 이미 쓰이고 있어요.`);

  const warnings: string[] = [];
  let showId: string;
  try {
    const report = await seedShow(db, buildShowDefinition(draft, slug), { apply: true, now });
    warnings.push(...report.warnings);
    const [created] = await db.select({ id: shows.id }).from(shows).where(eq(shows.slug, slug)).limit(1);
    if (!report.created || !created) return deny('duplicate_slug', `slug "${slug}"는 이미 쓰이고 있어요.`);
    showId = created.id;
  } catch (error) {
    console.error(`[shows/organizer] 공연 생성 실패 (id=${id}, slug=${slug})`, error);
    return deny('seed_failed', `공연을 만들지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 방금 만든 초안만 지운다 — 새 초안이라 주문이 참조할 수 없다.
  const deleteFreshDraft = async () => {
    try {
      await db.batch([
        db.delete(showTicketTypes).where(eq(showTicketTypes.showId, showId)),
        db.delete(showtimes).where(eq(showtimes.showId, showId)),
        db.delete(showZones).where(eq(showZones.showId, showId)),
        db.delete(shows).where(eq(shows.id, showId)),
      ]);
    } catch (error) {
      console.error(`[shows/organizer] 만들다 만 초안 공연을 지우지 못했어요 (slug=${slug})`, error);
    }
  };

  try {
    const res = await db
      .update(showSubmissions)
      .set({
        reviewStatus: next,
        showId,
        approvedDraftJson: sub.draftJson,
        approvedAt: now,
        reviewNote: null,
        updatedAt: now,
      })
      .where(sameVersion);
    if (Number(res.rowsAffected) === 0) {
      await deleteFreshDraft();
      return deny('conflict', '그 사이 상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.');
    }
  } catch (error) {
    console.error(`[shows/organizer] 승인 기록 실패 — 만든 초안을 지웁니다 (id=${id}, slug=${slug})`, error);
    await deleteFreshDraft();
    return deny('seed_failed', `승인을 기록하지 못했어요. 다시 승인해 주세요: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 승인은 이미 기록됐다 — 공개 실패는 승인을 되돌리지 않고 알린다.
  const publishFailed = '승인됐지만 공개하지 못했어요. /admin/shows에서 공개해 주세요.';
  let published = false;
  try {
    const [zones, ticketTypes, showtimeRows] = await Promise.all([
      db.select().from(showZones).where(eq(showZones.showId, showId)),
      db.select().from(showTicketTypes).where(eq(showTicketTypes.showId, showId)),
      db.select().from(showtimes).where(eq(showtimes.showId, showId)),
    ]);
    if (isPublishable({ zones, ticketTypes, showtimes: showtimeRows }, now)) {
      await db.run(sqlUpdateStatus(showId, 'published', now));
      published = true;
    } else {
      warnings.push(publishFailed);
    }
  } catch (error) {
    console.error(`[shows/organizer] 공개 실패 (id=${id}, slug=${slug})`, error);
    warnings.push(publishFailed);
  }

  // 공개하지 못했으면 "지금 공개됐어요"라고 알리지 않는다 — 승인 사실만 알리고 공개 주소는 싣지 않는다.
  warnings.push(...(await notify(id, published ? 'approved' : 'approved_pending')));
  return warnings.length > 0 ? { ok: true, slug, warnings } : { ok: true, slug };
}
