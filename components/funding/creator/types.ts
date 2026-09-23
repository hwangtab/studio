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

/** 개설자가 고를 수 있는 세금 처리. `db/schema.ts`의 `fundingCreatorTaxTypeEnum`을 리터럴로 옮긴 것이다. */
export type EditorTaxType = 'withholding' | 'invoice';

/**
 * 정산 정보 구획이 화면에 내려받는 **전부**.
 *
 * 은행명·예금주·계좌번호 전체는 여기 없다. Pages Router는 `getServerSideProps`가 돌려준
 * props를 `__NEXT_DATA__` JSON으로 페이지 HTML에 그대로 싣는다 — 담는 순간 계좌번호가
 * 페이지 소스에 평문으로 박히고, 그 HTML은 어깨너머로도 브라우저 캐시로도 화면 공유로도
 * 새어 나간다. **본인 화면이라는 것은 예외 사유가 아니다.** 같은 이유로
 * `lib/funding/dbProjects.ts`·`lib/funding/adminProjects.ts`도 이 네 필드를 일부러 빼고
 * 있고 각자의 integration 테스트가 그것을 고정한다.
 *
 * 그래서 개설자는 계좌를 "고치는" 것이 아니라 **다시 입력해 덮어쓴다.** 등록됐는지와 뒤
 * 4자리만 보여 주는 것으로 "내가 넣은 그 계좌가 맞나"는 확인된다.
 */
export interface EditorPayoutSummary {
  /** 은행명·계좌번호·예금주가 모두 채워져 있는가. 값 자체는 내려보내지 않는다. */
  registered: boolean;
  /** 계좌번호 뒤 4자리. 미등록이면 null. */
  accountLast4: string | null;
  /**
   * 세금 처리 구분. **여기만 값을 그대로 싣는다** — 관리자 화면(`pages/admin/funding/projects/[id].tsx`)은
   * 같은 정보를 `hasTaxType` 불리언으로만 내려보낸다. 두 판단이 다른 이유:
   *
   * - 은행명·계좌번호·예금주와 달리 `taxType`은 값이 둘뿐인 분류라 새어 나가도 잃을 것이
   *   없다. 그리고 이 화면은 개설자 본인이 매직링크로 인증하고 들어온 자기 정보다.
   * - 여기서 불리언으로 좁히면 폼이 열릴 때마다 선택이 '미선택'으로 되돌아가 개설자가 자기
   *   설정을 볼 수 없다. 관리자 화면에는 이 문제가 없다 — 그쪽은 폼이 아니라 "등록됐는지"만
   *   보고 정산을 막는 게이트라서 불리언으로 충분하다.
   */
  taxType: EditorTaxType | null;
  /**
   * 주민등록번호가 등록돼 있는가. **나가는 것은 이 불리언뿐이다** — 계좌와 달리 뒤 4자리
   * 같은 조각도 내려보내지 않는다. 암호문을 실으면 키가 유일한 방어가 되고, 평문은 물론
   * `__NEXT_DATA__`로 페이지 소스에 박힌다(`lib/funding/creatorProjectWrite.ts`의
   * `CreatorPayoutSummary` 주석).
   */
  residentNumberRegistered: boolean;
  /**
   * 이 개설자에게 원천징수하고 기록한 정산이 있는가. 참이면 세금 구분을 사업자로 바꿔
   * 저장해도 주민등록번호가 지워지지 않는다 — 이미 떼어 간 세액의 지급명세서 제출 의무가
   * 남아 있기 때문이다(`lib/funding/creatorProjectWrite.ts`의 `hasWithheldPayout`).
   * 화면은 이 값으로 "지워집니다"와 "보관됩니다"를 가른다. 여기서도 불리언뿐이다.
   */
  withheldPayoutRecorded: boolean;
}

/** 개설자 편집 화면의 프로젝트 구획. `lib/funding/reviewTransition.ts`의 `CreatorSectionName`과 같다. */
export type CreatorSectionName = 'basic' | 'story' | 'rewards' | 'payout';

/**
 * 상태별로 개설자가 고칠 수 있는 구획. `lib/funding/reviewTransition.ts`의
 * `EDITABLE_SECTIONS`를 리터럴로 옮긴 것이다.
 *
 * 그 파일은 `db/schema`를 값으로 import해 클라이언트 번들에 DB 스키마 코드를 끌어들이므로
 * 여기서 다시 적는다. 두 자리가 갈리지 않도록 `types.test.ts`가 상태 × 구획 전수 조합을
 * 대조한다.
 */
const EDITABLE_SECTIONS: Record<string, readonly CreatorSectionName[]> = {
  draft: ['basic', 'story', 'rewards'],
  changes_requested: ['basic', 'story', 'rewards'],
  approved: ['basic', 'story', 'payout'],
  submitted: [],
  rejected: [],
};

export const canEditSectionInBrowser = (reviewStatus: string, section: CreatorSectionName): boolean =>
  EDITABLE_SECTIONS[reviewStatus]?.includes(section) ?? false;

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '심사 중',
  changes_requested: '보완 요청',
  approved: '공개',
  // 보관(archive)도 DB에서는 같은 rejected다 — 둘을 가르는 것은 reviewNote뿐이라
  // 배지 한 단어로는 구분할 수 없다. 어느 쪽인지는 아래 운영자 메모가 말한다.
  rejected: '반려·보관',
};

/**
 * 상단에 띄우는 상태 안내. draft·changes_requested는 여기 없다(구획이 전부 열려 있어
 * 안내가 필요 없다). `approved`는 구획별로는 일부(basic·story) 편집 가능하지만 — 완전한
 * 읽기 전용은 아니다 — 무엇이 열리고 무엇이 막히는지를 안내가 직접 설명한다.
 */
export const REVIEW_STATUS_NOTICE: Record<string, string> = {
  submitted: '심사 중입니다. 심사가 끝날 때까지는 내용을 고칠 수 없습니다. 오타를 발견했거나 내용을 더 손보고 싶다면 아래에서 심사 신청을 철회하고 다시 작성할 수 있습니다.',
  approved: '공개된 프로젝트입니다. 본문과 제목·요약·표지는 지금도 고칠 수 있고, 고치면 운영자에게 알림이 갑니다. 주소·목표 금액·모금 기간과 리워드는 후원자와의 약속이라 바꿀 수 없습니다. 정산 정보 구획이 열렸으니 모금이 끝나기 전에 채워 주세요.',
  rejected: '이 프로젝트는 종결되어 더 이상 고칠 수 없습니다. 사유는 아래 운영자 메모를 확인해 주세요. 다시 진행하시려면 새 프로젝트를 만들어 주세요.',
};

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export interface SaveState {
  status: SaveStatus;
  message?: string;
}

export const IDLE_SAVE_STATE: SaveState = { status: 'idle' };
