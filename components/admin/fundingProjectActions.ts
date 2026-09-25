/**
 * 심사 화면(`/admin/funding/projects/[id]`)이 쓰는 조작 헬퍼. `fundingActions.ts`와 같은
 * 얕은 fetch 래퍼 패턴이지만, 판정 API는 성공해도 `warnings`를 실어 보낼 수 있어
 * `FundingActionResult`를 그대로 재사용하지 않고 별도 타입을 둔다 — warnings를 묵살하면
 * 운영자가 "개설자에게 통보됐다"고 착각하게 된다(메일 실패가 조용히 성공으로 보이는 것과
 * 같은 사고).
 */

export interface FundingProjectActionResult {
  ok: boolean;
  message?: string;
  warnings?: string[];
}

/**
 * `pages/api/admin/funding/projects/[id].ts`가 실제로 받는 액션 집합 — 그 라우트를 읽고
 * 맞췄다. 예전엔 `body: Record<string, unknown>`이라 `set_internal_note`를
 * `set_internal_not`처럼 오타 내도 컴파일이 통과하고 런타임 400으로만 드러났다.
 *
 * - `approve`는 슬러그를 새로 넣을 수 있고(운영자가 개설자 입력을 고쳐 승인), 메모는
 *   선택이다(안 보내면 기존 reviewNote를 보존한다 — `reviewDecision.ts`의
 *   `approveReviewNote` 참고).
 * - `request_changes`·`reject`·`archive`는 서버가 빈 메모를 거부한다(`NOTE_REQUIRED_MESSAGE`)
 *   — 타입에서는 문자열이라는 것만 강제하고, 빈 문자열 거부는 여전히 서버 몫이다.
 * - `set_review_note`·`set_internal_note`는 메모만 갈아 끼운다. 둘 다 빈 값을 보낼 수
 *   있다(메모를 지우는 경로).
 * - `close`·`reopen`·`hide`·`unhide`는 승인된 프로젝트의 공개 상태(status)·목록 노출
 *   (hidden)을 바꾼다. 심사 판정과 다른 축이라 별도 액션이다(`lib/funding/publicStatusDecision.ts`).
 *   `close`만 서버가 빈 메모를 거부한다 — 개설자가 "왜 멈췄는지" 알아야 하기 때문이다.
 */
export type FundingProjectPatchBody =
  | { action: 'approve'; slug?: string; note?: string }
  | { action: 'request_changes' | 'reject' | 'archive'; note: string }
  | { action: 'set_review_note' | 'set_internal_note'; note?: string }
  /** 스튜디오 서비스(운영자 전용, 마이그레이션 0036). lib/funding/projectServices.ts. */
  | { action: 'set_studio_service'; kind: 'none' | 'design' | 'release' }
  | { action: 'set_design_fee_paid'; paid: boolean }
  | { action: 'close'; note: string }
  | { action: 'reopen' | 'hide' | 'unhide'; note?: string }
  /**
   * 개설자 계정(이름·로그인 이메일) 수정. 다른 액션과 달리 `note`가 아니라 `value`·`reason`을
   * 보낸다 — 프로젝트의 `reviewNote`에 남기는 메모가 아니라 계정 변경의 사유이고, 서버는
   * 그것을 어느 컬럼에도 저장하지 않고 개설자 메일과 서버 로그로만 남긴다
   * (`lib/funding/creatorAccountDecision.ts`). 둘 다 서버가 빈 값을 거부한다.
   */
  | { action: 'set_creator_name' | 'set_creator_email'; value: string; reason: string }
  /**
   * 정산. `record_payout`은 미리보기 숫자를 그 시점에 고정하고(프로젝트당 한 번),
   * `mark_payout_paid`는 pending → paid 한 방향이다. 정산 id를 보내지 않는다 —
   * 프로젝트당 하나뿐이라 서버가 찾는다.
   *
   * `expectedNetAmount`는 확인창에 적어 운영자가 승인한 실이체액이다. 서버는 이 값을
   * 기록하지 않고 다시 계산한 값과 대조만 한다 — 페이지를 띄운 뒤 환불이 들어오면 확인창과
   * 기록이 갈라지므로, 다르면 409로 거부된다(`lib/funding/payout.ts`).
   */
  | { action: 'record_payout'; expectedNetAmount: number }
  | { action: 'mark_payout_paid'; memo?: string };

const readJson = async (r: Response): Promise<{ message?: string; warnings?: string[] }> => {
  try {
    return await r.json();
  } catch {
    return {};
  }
};

export const patchFundingProject = async (
  id: string,
  body: FundingProjectPatchBody,
): Promise<FundingProjectActionResult> => {
  try {
    const r = await fetch(`/api/admin/funding/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const result = await readJson(r);
    if (!r.ok) return { ok: false, message: result.message || '처리에 실패했습니다.' };
    return { ok: true, ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}) };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};
