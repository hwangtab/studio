import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { fundingProjects } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { loadProjectForAdmin } from '../../../../../lib/funding/adminProjects';
import { decideProject, type AdminReviewAction, type DecisionResult } from '../../../../../lib/funding/reviewDecision';
import { revalidateFundingPaths } from '../../../../../lib/funding/revalidate';
import { sendReviewDecisionEmail } from '../../../../../lib/funding/reviewEmail';

/** DecisionResult의 실패 code → HTTP 상태. Step 1 규약 그대로. */
const DECISION_STATUS: Record<Exclude<DecisionResult, { ok: true }>['code'], number> = {
  not_found: 404,
  conflict: 409,
  invalid_slug: 400,
  duplicate_slug: 400,
  incomplete: 400,
  expired: 400,
};

const REVIEW_ACTIONS: readonly AdminReviewAction[] = ['approve', 'request_changes', 'reject'];
const isReviewAction = (value: unknown): value is AdminReviewAction =>
  typeof value === 'string' && (REVIEW_ACTIONS as readonly string[]).includes(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });

  const id = String(req.query.id ?? '');
  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();

  /**
   * '심사 중 메모' — 판정 없이 메모만 저장한다. 승인·보완요청·반려처럼 개설자에게 메일이
   * 나가거나 상태가 바뀌지 않는다. 순수 내부 기록이라 `reviewNote`를 직접 덮어쓴다
   * (판정 액션의 메모는 `decideProject`가 같은 컬럼에 쓰지만 상태 전이와 한 묶음이다).
   */
  if (b.action === 'set_note') {
    const project = await loadProjectForAdmin(id);
    if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });
    const note = typeof b.note === 'string' ? b.note.trim() || null : null;
    await getDb().update(fundingProjects).set({ reviewNote: note, updatedAt: now }).where(eq(fundingProjects.id, id));
    return res.status(200).json({ ok: true });
  }

  if (isReviewAction(b.action)) {
    const action = b.action;
    const note = typeof b.note === 'string' ? b.note : undefined;
    const slug = typeof b.slug === 'string' ? b.slug : undefined;

    let result: DecisionResult;
    try {
      result = await decideProject(id, action, { note, slug }, now);
    } catch (error: unknown) {
      /**
       * 앞 리뷰 지적: slug 중복 검사(`decideProject` 내부)와 실제 쓰기 사이에 다른 승인이
       * 끼면 `funding_projects.slug`의 unique 제약이 예외를 던진다. 데이터는 안전하다
       * (`db.batch`가 전부 롤백한다) — 하지만 그대로 두면 500이 나간다.
       *
       * 409(conflict)를 골랐다: 이건 "그 사이 상태가 바뀌었다"는 낙관적 잠금 실패와 같은
       * 성격이다(다른 승인이 먼저 끝났다는 뜻) — 입력 자체가 처음부터 잘못된 400과는 다르다.
       * 새로고침하면 `decideProject`의 사전 중복 검사가 이번엔 그 슬러그를 잡아내
       * `duplicate_slug`(400)로 더 친절한 메시지를 준다.
       */
      console.error(`[funding] decideProject 예외 (id=${id}, action=${action}):`, error);
      return res.status(409).json({
        ok: false,
        message: '그 사이 다른 프로젝트가 같은 주소를 먼저 사용했습니다. 새로고침 후 다시 확인해 주세요.',
      });
    }

    if (!result.ok) {
      return res.status(DECISION_STATUS[result.code]).json({ ok: false, message: result.message });
    }

    // 판정 자체는 끝났다 — 아래 두 후속 작업은 실패해도 200을 유지하고 경고만 싣는다.
    // 조용히 성공으로 보이면 운영자가 개설자에게 이미 연락이 갔다고 착각한다.
    const warnings: string[] = [...(result.warnings ?? [])];

    if (action === 'approve') {
      const revalidateError = await revalidateFundingPaths(res, result.slug);
      if (revalidateError) warnings.push(revalidateError);
    }

    // 메일 본문에 필요한 프로젝트 정보(개설자 메일·제목·시작일)는 decideProject가 돌려주지
    // 않으므로 성공 뒤 다시 읽는다. null일 수 없지만(방금 그 id로 판정에 성공했다) 타입
    // 안정을 위해 가드한다.
    const project = await loadProjectForAdmin(id);
    if (project) {
      const mailError = await sendReviewDecisionEmail(project, action, note?.trim() || null, result.slug);
      if (mailError) warnings.push(mailError);
    }

    return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
  }

  return res.status(400).json({ ok: false, message: 'action이 올바르지 않습니다.' });
}
