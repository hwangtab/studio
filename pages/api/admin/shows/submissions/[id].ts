import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { showSubmissions } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { decideShowSubmission, type ShowDecisionAction, type ShowDecisionCode } from '../../../../../lib/shows/organizer/review';
import { revalidateShow } from '../../../../../lib/shows/revalidate';

/**
 * 주최자 공연 제출물 심사 — pages/api/admin/funding/projects/[id].ts와 같은 형태.
 * 승인하면 공연이 만들어져 바로 공개된다(lib/shows/organizer/review.ts).
 */
const DECISION_STATUS: Record<ShowDecisionCode, number> = {
  not_found: 404,
  conflict: 409,
  invalid_slug: 400,
  duplicate_slug: 400,
  incomplete: 400,
  terms_not_agreed: 400,
  seed_failed: 500,
};

const REVIEW_ACTIONS: readonly ShowDecisionAction[] = ['approve', 'request_changes', 'reject'];
const isReviewAction = (value: unknown): value is ShowDecisionAction =>
  typeof value === 'string' && (REVIEW_ACTIONS as readonly string[]).includes(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });

  const id = String(req.query.id ?? '');
  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();

  // 운영자 전용 메모 — 주최자에게 보이지 않아 비워도 된다.
  if (b.action === 'set_internal_note') {
    const note = typeof b.note === 'string' ? b.note.trim() || null : null;
    const result = await getDb()
      .update(showSubmissions)
      .set({ internalNote: note, updatedAt: now })
      .where(eq(showSubmissions.id, id));
    if (Number(result.rowsAffected) === 0) return res.status(404).json({ ok: false, message: '제출물을 찾을 수 없습니다.' });
    return res.status(200).json({ ok: true });
  }

  if (!isReviewAction(b.action)) return res.status(400).json({ ok: false, message: '알 수 없는 요청입니다.' });
  const action = b.action;
  const expectedSubmittedAt = typeof b.expectedSubmittedAt === 'string' ? b.expectedSubmittedAt : undefined;
  if (!expectedSubmittedAt) {
    return res.status(400).json({ ok: false, message: '화면을 새로고침한 뒤 다시 시도해 주세요. (판본 정보 없음)' });
  }

  let result;
  try {
    result = await decideShowSubmission(
      id,
      action,
      {
        note: typeof b.note === 'string' ? b.note : undefined,
        slug: typeof b.slug === 'string' ? b.slug : undefined,
        expectedSubmittedAt,
      },
      now,
    );
  } catch (error) {
    console.error(`[shows/organizer] decideShowSubmission 예외 (id=${id}, action=${action})`, error);
    return res.status(500).json({ ok: false, message: '처리에 실패했습니다. 서버 로그를 확인해 주세요.' });
  }

  if (!result.ok) return res.status(DECISION_STATUS[result.code]).json({ ok: false, code: result.code, message: result.message });
  if (action === 'approve' && result.slug) await revalidateShow(res, result.slug);
  return res.status(200).json({ ok: true, slug: result.slug, warnings: result.warnings });
}
