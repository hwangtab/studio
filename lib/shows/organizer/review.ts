import { and, eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { showSubmissions, showTicketTypes, showtimes, shows, showZones } from '../../../db/schema';
import { nextReviewStatus } from '../../funding/reviewTransition';
import { seedShow } from '../seed';
import { isPublishable, sqlUpdateStatus } from '../revalidate';
import { validateShowSlug } from '../reservedSlugs';
import { buildShowDefinition, findSubmitProblems, parseDraft } from './draft';
import { sendShowReviewResultEmail } from './email';

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

async function notify(id: string, result: 'approved' | 'changes_requested' | 'rejected'): Promise<string[]> {
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
    if (Number(res.rowsAffected) === 0) return deny('conflict', '그 사이 상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.');
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

  // 이미 있는 slug는 중복이다. 단 직전 승인이 중간에 실패해 남은 고아 draft 공연(제출물이 가리키지 않고
  // status='draft')은 이어받는다 — seedShow가 멱등이라 같은 slug로 다시 승인하면 그 공연을 마저 채운다.
  const [existing] = await db.select().from(shows).where(eq(shows.slug, slug)).limit(1);
  if (existing) {
    const [owner] = await db
      .select({ id: showSubmissions.id })
      .from(showSubmissions)
      .where(eq(showSubmissions.showId, existing.id))
      .limit(1);
    if (owner || existing.status !== 'draft') return deny('duplicate_slug', `slug "${slug}"는 이미 쓰이고 있어요.`);
  }

  try {
    await seedShow(db, buildShowDefinition(draft, slug), { apply: true, now });
  } catch (error) {
    console.error(`[shows/organizer] 공연 생성 실패 (id=${id}, slug=${slug})`, error);
    return deny('seed_failed', `공연을 만들지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }

  const [show] = await db.select().from(shows).where(eq(shows.slug, slug)).limit(1);
  const unpublish = async () => {
    try {
      await db.run(sqlUpdateStatus(show.id, 'draft', now));
    } catch (error) {
      console.error(`[shows/organizer] 공연을 초안으로 되돌리지 못했어요 (slug=${slug})`, error);
    }
  };

  try {
    const [zones, ticketTypes, showtimeRows] = await Promise.all([
      db.select().from(showZones).where(eq(showZones.showId, show.id)),
      db.select().from(showTicketTypes).where(eq(showTicketTypes.showId, show.id)),
      db.select().from(showtimes).where(eq(showtimes.showId, show.id)),
    ]);
    if (!isPublishable({ zones, ticketTypes, showtimes: showtimeRows }, now)) {
      return deny('seed_failed', '공개하려면 예정된 회차·구역·티켓타입이 모두 필요해요.');
    }
    await db.run(sqlUpdateStatus(show.id, 'published', now));

    const res = await db
      .update(showSubmissions)
      .set({
        reviewStatus: next,
        showId: show.id,
        approvedDraftJson: sub.draftJson,
        approvedAt: now,
        reviewNote: null,
        updatedAt: now,
      })
      .where(sameVersion);
    if (Number(res.rowsAffected) === 0) {
      await unpublish();
      return deny('conflict', '그 사이 상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.');
    }
  } catch (error) {
    console.error(`[shows/organizer] 승인 기록 실패 — 공연을 비공개로 되돌립니다 (id=${id}, slug=${slug})`, error);
    await unpublish();
    return deny('seed_failed', `승인을 기록하지 못해 공연을 공개하지 않았어요. 같은 slug로 다시 승인해 주세요: ${error instanceof Error ? error.message : String(error)}`);
  }

  const warnings = await notify(id, 'approved');
  return warnings.length > 0 ? { ok: true, slug, warnings } : { ok: true, slug };
}
