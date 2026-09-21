/**
 * 개설자 편집 화면(4구획)이 공유하는 타입.
 *
 * `EditorProject`는 `lib/funding/creatorProjectWrite.ts`의 `CreatorProjectDetail`을
 * 화면이 실제로 쓰는 모양으로 좁힌 것이다 — 날짜는 `Date`가 아니라 ISO 문자열(직렬화
 * 가능해야 `__NEXT_DATA__`에 실린다), 리워드는 `lockedAt` 대신 `locked` 불리언 하나만
 * 갖는다(승인 시각 자체는 화면이 쓸 일이 없다).
 */
export interface EditorReward {
  rewardId: string;
  title: string;
  description: string;
  amount: number;
  totalQuantity: number | null;
  requiresShipping: boolean;
  estimatedDelivery: string;
  imageUrl: string | null;
  /** true면 승인된(공개된) 리워드 — 주소·금액·수량 제한 여부·배송 여부를 못 바꾼다. */
  locked: boolean;
}

export interface EditorCreatorProfile {
  name: string;
  contactName: string | null;
  phone: string | null;
  bio: string | null;
  links: string[] | null;
}

export interface EditorProject {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  coverUrl: string;
  goalAmount: number;
  /**
   * KST(UTC+9) 달력 날짜 `YYYY-MM-DD` — 전체 ISO 타임스탬프가 아니다.
   * `<input type="date">`가 그대로 받는 값이라 변환이 없다. 서버로 보낼 때만
   * `lib/funding/creatorDateInput.ts`의 `kstStartOfDayIso`/`kstEndOfDayIso`로 시각을
   * 붙인다 — 예전엔 로컬 자정으로 보내고 UTC 문자열을 잘라 읽어(왕복 방향이 서로 달라)
   * 저장할 때마다 날짜가 하루씩 밀렸다(2026-09-17 리뷰 지적).
   */
  startAt: string;
  endAt: string;
  reviewStatus: string;
  reviewNote: string | null;
  creator: EditorCreatorProfile;
  rewards: EditorReward[];
}

/**
 * 개설자가 지금 고칠 수 있는 상태. `lib/funding/reviewTransition.ts`의 `canCreatorEdit`과
 * 같은 규칙이지만, 그 파일은 `db/schema`를 값으로 import해 클라이언트 번들에 DB 스키마
 * 코드를 끌어들이므로 여기서는 리터럴로 다시 적는다 — 두 자리가 갈리지 않도록
 * `lib/funding/reviewTransition.test.ts`가 이미 그 파일 쪽 진리표를 고정하고 있고,
 * 여기 값은 그 표에서 "구획이 하나라도 열린" 상태(`canCreatorEdit`)를 그대로 옮긴 것이다.
 *
 * `approved`가 들어 있는 것은 4차(Task 5)에서 서버가 승인 뒤 본문·기본정보 구획을 열어서다.
 * 이 화면은 아직 상태 하나로 네 구획을 통째로 열고 닫으므로, 지금은 승인된 프로젝트를 열면
 * 네 구획이 다 편집 가능해 **보인다** — 실제로는 서버의 `canCreatorEditSection`이 구획별로
 * 막으므로(예: 리워드 저장은 여전히 거부된다) 구멍은 아니지만, 화면 안내는 부정확하다.
 * Task 6이 이 Set을 상태×구획 표로 교체해 화면도 서버와 같은 단위로 판정하게 만든다.
 */
export const EDITABLE_REVIEW_STATUSES: ReadonlySet<string> = new Set(['draft', 'changes_requested', 'approved']);

export const canEditInBrowser = (reviewStatus: string): boolean => EDITABLE_REVIEW_STATUSES.has(reviewStatus);

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '심사 중',
  changes_requested: '보완 요청',
  approved: '공개',
  // 보관(archive)도 DB에서는 같은 rejected다 — 둘을 가르는 것은 reviewNote뿐이라
  // 배지 한 단어로는 구분할 수 없다. 어느 쪽인지는 아래 운영자 메모가 말한다.
  rejected: '반려·보관',
};

/** 읽기 전용 상태에서 상단에 띄우는 안내. draft·changes_requested는 여기 없다(편집 가능이라 안내가 필요 없다). */
export const REVIEW_STATUS_NOTICE: Record<string, string> = {
  submitted: '심사 중입니다. 심사가 끝날 때까지는 내용을 고칠 수 없습니다.',
  approved: '이미 공개된 프로젝트입니다. 내용을 고치려면 운영자에게 문의해 주세요.',
  rejected: '이 프로젝트는 종결되어 더 이상 고칠 수 없습니다. 사유는 아래 운영자 메모를 확인해 주세요. 다시 진행하시려면 새 프로젝트를 만들어 주세요.',
};

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export interface SaveState {
  status: SaveStatus;
  message?: string;
}

export const IDLE_SAVE_STATE: SaveState = { status: 'idle' };
