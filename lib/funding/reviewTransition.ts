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

/**
 * 개설자 편집 화면의 프로젝트 구획. 개설자 계정 프로필은 프로젝트가 아니라 계정 소속이라 빠진다.
 *
 * `payout`(정산 정보)은 예외적으로 계정 소속인데도 이 표에 들어 있다 — 값이 계정에 붙어
 * 있을 뿐, **언제 받아도 되는지**는 심사 상태가 정하기 때문이다(승인 전에는 안 받는다).
 */
export type CreatorSectionName = 'basic' | 'story' | 'rewards' | 'payout';

/**
 * 상태별로 개설자가 고칠 수 있는 구획.
 *
 * 승인 뒤 본문을 여는 이유: 3차까지는 승인되면 오탈자 하나도 못 고쳤고, 개설자 화면은
 * "운영자에게 문의해 주세요"라고 안내하는데 운영자에게도 경로가 없었다. 재심사 대기열을
 * 만들지 않는다 — 오탈자 하나에 심사를 기다리게 하는 것이 더 나쁘다. 대신 고칠 때마다
 * `creatorEditedAt`을 찍고 운영자에게 알린다.
 *
 * 리워드는 승인 뒤 통째로 잠긴다. **설명글까지** 잠그는 이유는 그것이 후원자가 보고
 * 결제한 약속이기 때문이다 — "CD 1장 + 포스터"가 후원 뒤에 "CD 1장"이 되면 후원자 약관
 * 제8조의 "표시·광고와 다르게 이행"에 걸리고, 판매자인 스튜디오가 3개월짜리 청약철회를
 * 받는다.
 *
 * `basic`이 승인 뒤에도 열려 있는 것은 구획 단위 판정일 뿐이다 — 그 안에서 slug·목표금액·
 * 모금 기간은 `basicLockedViolation`이 따로 잠근다.
 *
 * `payout`(정산 정보)만 **승인 뒤에 비로소 열린다.** 반려될 신청서에 계좌·주민번호 성격의
 * 정보를 미리 받지 않는다(설계 스펙 §6.2) — 받아 두면 반려된 계정의 계좌를 우리가 이유
 * 없이 보관하게 된다. 승인 뒤에는 계속 열려 있다: 계좌는 바뀌고, 바꿀 길이 없으면 정산이
 * 막힌다.
 */
const EDITABLE_SECTIONS: Record<FundingReviewStatus, readonly CreatorSectionName[]> = {
  draft: ['basic', 'story', 'rewards'],
  changes_requested: ['basic', 'story', 'rewards'],
  approved: ['basic', 'story', 'payout'],
  submitted: [],
  rejected: [],
};

export const canCreatorEditSection = (status: FundingReviewStatus, section: CreatorSectionName): boolean =>
  EDITABLE_SECTIONS[status]?.includes(section) ?? false;

/**
 * 구획이 하나라도 열려 있는가. 업로드 라우트처럼 "지금 이 프로젝트를 편집 중인가"만
 * 알면 되는 자리가 쓴다. 구획별 판정이 필요하면 `canCreatorEditSection`을 쓸 것.
 */
export const canCreatorEdit = (status: FundingReviewStatus): boolean =>
  (EDITABLE_SECTIONS[status]?.length ?? 0) > 0;
