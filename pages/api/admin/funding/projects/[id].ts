import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { fundingProjects } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { loadProjectForAdmin } from '../../../../../lib/funding/adminProjects';
import { decideProject, type AdminReviewAction, type DecisionResult } from '../../../../../lib/funding/reviewDecision';
import { decidePublicStatus, type PublicStatusAction, type PublicStatusResult } from '../../../../../lib/funding/publicStatusDecision';
import { revalidateFundingPaths } from '../../../../../lib/funding/revalidate';
import {
  sendReviewDecisionEmail,
  sendReviewDecisionOperatorFallback,
  sendPublicStatusEmail,
  sendPublicStatusOperatorFallback,
} from '../../../../../lib/funding/reviewEmail';

/** DecisionResult의 실패 code → HTTP 상태. Step 1 규약 그대로. */
const DECISION_STATUS: Record<Exclude<DecisionResult, { ok: true }>['code'], number> = {
  not_found: 404,
  conflict: 409,
  invalid_slug: 400,
  duplicate_slug: 400,
  incomplete: 400,
  expired: 400,
  terms_not_agreed: 400,
};

const REVIEW_ACTIONS: readonly AdminReviewAction[] = ['approve', 'request_changes', 'reject', 'archive'];
const isReviewAction = (value: unknown): value is AdminReviewAction =>
  typeof value === 'string' && (REVIEW_ACTIONS as readonly string[]).includes(value);

/** `publicStatusDecision.ts`의 실패 code → HTTP 상태. */
const PUBLIC_STATUS_HTTP: Record<Exclude<PublicStatusResult, { ok: true }>['code'], number> = {
  not_found: 404,
  conflict: 409,
  incomplete: 400,
};

const PUBLIC_STATUS_ACTIONS: readonly PublicStatusAction[] = ['close', 'reopen', 'hide', 'unhide'];
const isPublicStatusAction = (value: unknown): value is PublicStatusAction =>
  typeof value === 'string' && (PUBLIC_STATUS_ACTIONS as readonly string[]).includes(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });

  const id = String(req.query.id ?? '');
  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();

  /**
   * 판정 없이 `reviewNote`만 고쳐 쓴다(상태 전이·메일 없음).
   *
   * 이름을 `set_note`가 아니라 `set_review_note`로 둔 이유: 이 컬럼은 "운영자 내부 메모"가
   * **아니다.** `reviewNote`는 개설자 화면 두 곳에 "운영자 메모: {내용}"으로 그대로
   * 렌더된다(`pages/[locale]/funding/creator/[id].tsx`, 같은 목록 페이지). 설계 문서도
   * 이 컬럼을 "운영자 → 개설자 메시지"로 정의한다 — 운영자가 내부 기록이라 믿고 적은
   * 문장이 개설자에게 즉시 노출된다.
   *
   * 그리고 이 액션은 `request_changes`가 쓴 보완 요청 사유를 **덮어쓸 수 있다**(같은
   * 컬럼이다). 운영자가 보완 요청 직후 이 액션으로 메모를 다듬는 것은 정당한 사용이지만,
   * 개설자가 아직 못 본 사유를 실수로 지우면 개설자는 무엇을 고쳐야 하는지 알 길이
   * 없어진다 — 그래서 여기서 막지는 않되(다듬기는 정당하다) 이름과 주석을 사실에 맞춘다.
   *
   * 단, `reviewStatus === 'rejected'`일 때는 빈 값을 거부한다. 보관(archive)과 반려(reject)는
   * DB에서 정확히 같은 값이고 `reviewNote`만이 그 둘을 가르는 유일한 증거다
   * (`lib/funding/reviewTransition.ts`) — 여기서 메모를 비우면 그 구분이 영영 사라지고,
   * 개설자 화면의 "사유는 아래 운영자 메모를 확인해 주세요" 안내도 없는 곳을 가리키게 된다.
   *
   * 판정과 무관한 "진짜" 운영자 전용 메모는 별도 컬럼(`internal_note`)에 담는다 —
   * 아래 `set_internal_note` 액션이 그 칸을 쓴다.
   */
  if (b.action === 'set_review_note') {
    const project = await loadProjectForAdmin(id);
    if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });
    const note = typeof b.note === 'string' ? b.note.trim() || null : null;
    if (project.reviewStatus === 'rejected' && !note) {
      return res.status(400).json({
        ok: false,
        message: '반려·보관 사유는 비울 수 없습니다. reviewNote가 둘을 가르는 유일한 근거입니다.',
      });
    }
    await getDb().update(fundingProjects).set({ reviewNote: note, updatedAt: now }).where(eq(fundingProjects.id, id));
    return res.status(200).json({ ok: true });
  }

  /**
   * 운영자 전용 메모. `set_review_note`와 달리 개설자에게 보이지 않으므로 빈 값을 막지
   * 않는다 — 여기 적힌 것은 증거가 아니라 운영 메모다.
   */
  if (b.action === 'set_internal_note') {
    const project = await loadProjectForAdmin(id);
    if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });
    const note = typeof b.note === 'string' ? b.note.trim() || null : null;
    await getDb().update(fundingProjects).set({ internalNote: note, updatedAt: now }).where(eq(fundingProjects.id, id));
    return res.status(200).json({ ok: true });
  }

  if (isReviewAction(b.action)) {
    const action = b.action;
    const note = typeof b.note === 'string' ? b.note : undefined;
    const slug = typeof b.slug === 'string' ? b.slug : undefined;

    // libSQL/SQLite가 실제로 던지는 문구("UNIQUE constraint failed: <table>.<column>")를
    // 좁혀 잡는다 — 이 저장소의 다른 곳(lib/booking/confirm.test.ts 등)도 같은 문구를 쓴다.
    const isSlugConflictError = (error: unknown): boolean =>
      error instanceof Error && /UNIQUE constraint failed: funding_projects\.slug/i.test(error.message);

    let result: DecisionResult;
    try {
      result = await decideProject(id, action, { note, slug }, now);
    } catch (error: unknown) {
      if (!isSlugConflictError(error)) {
        // 이전 버전은 이 catch가 decideProject 전체(DB select 여러 번·파일 조회·db.batch)를
        // 감싸고 있어 **어떤 이유로 던지든** "주소 중복" 메시지가 나갔다 — Turso 연결 실패도,
        // JSON 파싱 실패도, boundary와 무관한 request_changes·reject 경로의 예외도 전부 같은
        // 문구를 받았다. 원인은 서버 로그에만 남고 운영자는 새로고침만 반복하게 된다.
        // 진짜 원인 불명 오류는 500으로 올리고 로그에 스택을 남긴다.
        console.error(`[funding] decideProject 예외 (id=${id}, action=${action}):`, error);
        return res.status(500).json({ ok: false, message: '판정 처리 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.' });
      }
      /**
       * slug 중복 검사(`decideProject` 내부)와 실제 쓰기 사이에 다른 승인이 끼면
       * `funding_projects.slug`의 unique 제약이 예외를 던진다. 데이터는 안전하다
       * (`db.batch`가 전부 롤백한다) — 하지만 그대로 두면 500이 나간다.
       *
       * 409(conflict)를 골랐다: 이건 "그 사이 상태가 바뀌었다"는 낙관적 잠금 실패와 같은
       * 성격이다(다른 승인이 먼저 끝났다는 뜻) — 입력 자체가 처음부터 잘못된 400과는 다르다.
       * 새로고침하면 `decideProject`의 사전 중복 검사가 이번엔 그 슬러그를 잡아내
       * `duplicate_slug`(400)로 더 친절한 메시지를 준다.
       */
      console.error(`[funding] decideProject slug 경합 (id=${id}, action=${action}):`, error);
      return res.status(409).json({
        ok: false,
        message: '그 사이 다른 프로젝트가 같은 주소를 먼저 사용했습니다. 새로고침 후 다시 확인해 주세요.',
      });
    }

    if (!result.ok) {
      return res.status(DECISION_STATUS[result.code]).json({ ok: false, message: result.message });
    }

    // 판정(DB 쓰기) 자체는 여기서 끝났다. 아래 후속 작업(재검증·메일)은 실패해도 200을
    // 유지하고 경고만 싣는다 — 판정을 실패시키면 운영자가 같은 버튼을 다시 눌러야 하는데
    // 상태는 이미 바뀌어 있어 두 번째 시도는 409를 받는다. try로 통째로 감싸는 이유도
    // 같다: 재조회·메일이 예기치 않게 던져도(예: DB 순간 장애) 500이 아니라 200 + 경고로
    // 나가야 이 원칙과 일관된다.
    const warnings: string[] = [...(result.warnings ?? [])];

    try {
      if (action === 'approve') {
        const revalidateError = await revalidateFundingPaths(res, result.slug);
        if (revalidateError) warnings.push(revalidateError);
      }

      // 메일 본문에 필요한 프로젝트 정보(개설자 메일·제목·시작일)는 decideProject가 돌려주지
      // 않으므로 성공 뒤 다시 읽는다.
      const project = await loadProjectForAdmin(id);
      if (project) {
        const mailError = await sendReviewDecisionEmail(project, action, note?.trim() || null, result.slug);
        if (mailError) {
          warnings.push(mailError);
          // 개설자 메일이 실패하면 운영자에게 폴백 알림을 보낸다 — 그렇지 않으면 이 실패는
          // 이 HTTP 응답의 warnings에만 남고, 운영자가 탭을 닫거나 새로고침하면 사실 자체가
          // 사라진다. 판정은 프로젝트당 사실상 한 번이라(재승인 시도는 conflict) 개설자가
          // 승인 사실을 영영 모르는 상태가 될 수 있다. 영속 기록·재발송 UI는 컬럼 추가가
          // 필요해(마이그레이션, 이 계획 범위 밖) 4차로 넘긴다 — 지금은 운영자 메일함으로
          // 직접 알리는 것까지만 한다.
          const fallbackError = await sendReviewDecisionOperatorFallback(project, action, result.slug, mailError);
          if (fallbackError) {
            console.error(`[funding] 운영자 폴백 알림도 실패 (id=${id}, action=${action}):`, fallbackError);
            warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
          }
        }
      } else {
        // 판정은 성공했는데 프로젝트를 다시 읽지 못해 메일 발송 자체를 시도하지 못했다.
        // 조용히 넘어가면 이 태스크가 막으려던 바로 그 상태(운영자는 통보됐다고 착각)가
        // 재현된다 — 반드시 경고를 남긴다.
        warnings.push('개설자 정보를 다시 읽지 못해 알림 메일을 보내지 못했습니다.');
      }
    } catch (error: unknown) {
      console.error(`[funding] 판정 후속 처리(재검증·메일) 실패 (id=${id}, action=${action}):`, error);
      warnings.push('판정 후 재검증·메일 처리 중 오류가 발생했습니다. 상태를 직접 확인해 주세요.');
    }

    return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
  }

  /**
   * 승인된 프로젝트의 공개 상태(status: closed/auto)·목록 노출(hidden)을 바꾼다.
   * `decideProject`와 다른 함수(`decidePublicStatus`)를 쓴다 — 심사 상태(reviewStatus)
   * 전이표와는 다른 축이고, approved는 그 표에서 되감을 수 없는 종결 상태이기 때문이다.
   * 후속 처리(재검증·메일) 구조는 위 판정 블록과 동일하게 맞춘다 — 실패해도 200 + warnings.
   */
  if (isPublicStatusAction(b.action)) {
    const action = b.action;
    const note = typeof b.note === 'string' ? b.note : undefined;

    let result: PublicStatusResult;
    try {
      result = await decidePublicStatus(id, action, { note }, now);
    } catch (error: unknown) {
      console.error(`[funding] decidePublicStatus 예외 (id=${id}, action=${action}):`, error);
      return res.status(500).json({ ok: false, message: '처리 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.' });
    }

    if (!result.ok) {
      return res.status(PUBLIC_STATUS_HTTP[result.code]).json({ ok: false, message: result.message });
    }

    const warnings: string[] = [];
    try {
      // 넷 다 목록(hidden)·상세(status 배지) 어느 한쪽은 반드시 바꾸므로 매번 둘 다 재검증한다.
      const revalidateError = await revalidateFundingPaths(res, result.slug);
      if (revalidateError) warnings.push(revalidateError);

      const project = await loadProjectForAdmin(id);
      if (project) {
        const mailError = await sendPublicStatusEmail(project, action, note?.trim() || null, result.slug, now);
        if (mailError) {
          warnings.push(mailError);
          const fallbackError = await sendPublicStatusOperatorFallback(project, action, result.slug, mailError);
          if (fallbackError) {
            console.error(`[funding] 운영자 폴백 알림도 실패 (id=${id}, action=${action}):`, fallbackError);
            warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
          }
        }
      } else {
        warnings.push('개설자 정보를 다시 읽지 못해 알림 메일을 보내지 못했습니다.');
      }
    } catch (error: unknown) {
      console.error(`[funding] 공개 상태 변경 후속 처리(재검증·메일) 실패 (id=${id}, action=${action}):`, error);
      warnings.push('공개 상태 변경 후 재검증·메일 처리 중 오류가 발생했습니다. 상태를 직접 확인해 주세요.');
    }

    return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
  }

  return res.status(400).json({ ok: false, message: 'action이 올바르지 않습니다.' });
}
