import { fundingReviewStatusEnum } from '../../db/schema';

export type FundingReviewStatus = (typeof fundingReviewStatusEnum)[number];
export type ReviewAction = 'submit' | 'request_changes' | 'approve' | 'reject' | 'withdraw' | 'archive';

/**
 * 심사 상태 전이표.
 *
 * **표 하나가 정본이다.** 개설자 API와 (3차의) 관리자 API가 각자 조건문을 쓰면 두 쪽이
 * 갈라지고, 그 틈으로 승인된 프로젝트가 초안으로 돌아가는 경로가 생긴다. 표에 없는
 * 조합은 전부 null이고 호출부는 409로 답한다.
 *
 * `archive`(Task 11)는 별도 상태를 새로 만들지 않고 `rejected`로 보낸다 — 마이그레이션
 * 없이 미심사 상한(`CREATOR_LIMITS.draftsMax`)을 푸는 수단이 필요했기 때문이다.
 * **보관과 반려는 DB에서 정확히 같은 값이고, 구분은 `reviewNote` 텍스트뿐이다** — 나중에
 * 반려율 통계를 뽑으려는 사람이 이 사실을 모르면 방치된 초안 정리가 "반려"에 섞여 든다.
 * `draft`·`submitted`·`changes_requested`(미심사 상태 전부)에서 보관할 수 있고, `approved`
 * 에서는 불가능하다 — 공개된 프로젝트를 닫는 것은 `status: closed`이지 심사 상태를 되감는
 * 것이 아니다.
 */
const TABLE: Record<FundingReviewStatus, Partial<Record<ReviewAction, FundingReviewStatus>>> = {
  draft: { submit: 'submitted', archive: 'rejected' },
  changes_requested: { submit: 'submitted', archive: 'rejected' },
  submitted: {
    approve: 'approved',
    request_changes: 'changes_requested',
    reject: 'rejected',
    withdraw: 'draft',
    archive: 'rejected',
  },
  // 승인은 끝이다. 되돌리려면 공개 상태(status)를 closed로 바꾸지 상태를 되감지 않는다 —
  // 이미 후원이 들어와 있을 수 있고, 그 행들은 slug로 이 프로젝트를 참조한다. archive도
  // 여기서 막힌다 — approved는 이미 사람이 심사를 끝낸 종결 상태다.
  approved: {},
  rejected: {},
};

export const nextReviewStatus = (from: FundingReviewStatus, action: ReviewAction): FundingReviewStatus | null =>
  TABLE[from]?.[action] ?? null;

/** 개설자가 내용을 고칠 수 있는 상태. 심사 중에 바뀌면 운영자가 본 것과 다른 것이 승인된다. */
export const canCreatorEdit = (status: FundingReviewStatus): boolean =>
  status === 'draft' || status === 'changes_requested';
