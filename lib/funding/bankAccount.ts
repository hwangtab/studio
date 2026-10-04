/**
 * 펀딩 **계좌 입금**(무통장)의 받는 계좌와 판정 — 이 파일 하나가 정본이다.
 *
 * 화면(후원 폼·펀딩 확인 페이지의 입금 안내)과 메일이 모두 여기서 계좌를 읽는다. 약관·처리방침
 * 본문에는 계좌번호를 쓰지 않는다("안내 화면·메일에 표시된 계좌") — 계좌를 바꿀 때 동의 문서
 * 판본까지 올리지 않아도 되게.
 *
 * **이 모듈은 아무것도 import하지 않는다.** 후원 폼(클라이언트 번들)과 서버 검증이 같은 판정
 * 함수를 써야 하는데, `lib/funding/projects.ts`는 `node:fs`를 물고 있어 클라이언트가 값을
 * 가져가면 빌드가 깨진다(lib/funding/CLAUDE.md). 리워드는 모양(`totalQuantity`)만 받는다.
 *
 * 2026-09-11에 한 번 걷어냈다가(PR #77, 입금 대조 수작업 부담) 2026-10-04 운영자 결정으로
 * 되살렸다 — 은행·ATM에서 직접 보내는 노년층 후원자를 위해서다. 그때와 다른 점은 둘이다:
 * **자동 취소가 없다**(아래 `BANK_DEPOSIT_GUIDE_DAYS`), **환불 계좌를 화면에서 받는다**
 * (`funding_refund_accounts`, 마이그레이션 0048).
 */

export const BANK_ACCOUNT = {
  bankName: '카카오뱅크',
  accountNumber: '3333-12-5480849',
  accountHolder: '황경하 / 스튜디오 놀',
} as const;

/**
 * 입금 안내에 적는 기한(일). **안내용일 뿐이다 — 지나도 신청을 자동으로 취소하지 않는다.**
 *
 * SAF2026에서 실제로 난 사고: 같은 사람이 중복 신청한 것 중 버려진 쪽이 자동 만료되면서,
 * 이미 입금한 사람에게 "취소됨" 메일이 갔다. 그래서 계좌 입금 대기는 홀드 만료
 * (`expireStalePledges`) 대상에서 빠지고, 만료 메일도 없다. 기한이 지나도 안내 화면은
 * 계좌를 그대로 보여 준다 — 늦게 보낸 돈도 운영자가 확인하면 확정된다.
 *
 * `funding_pledges.hold_expires_at`에 신청 시각 + 이 기간을 적고, 화면·메일은 그 값을 기한으로
 * 읽는다(저장된 값이 정본 — 이 상수를 바꿔도 이미 안내한 기한은 움직이지 않는다).
 */
export const BANK_DEPOSIT_GUIDE_DAYS = 3;

/** 신청 시각에서 안내 기한을 계산한다. */
export const bankDepositGuideDeadline = (createdAt: Date): Date =>
  new Date(createdAt.getTime() + BANK_DEPOSIT_GUIDE_DAYS * 24 * 60 * 60 * 1000);

/**
 * 기한을 "10월 7일 오후 3시"처럼 **한국시간으로** 적는다. timeZone을 비우면 보는 사람의 기기
 * 시간대로 그려져 해외에서 연 사람에게 다른 시각이 보인다. "(한국시간)"은 부르는 쪽이 붙인다.
 */
export const formatKstDeadline = (deadline: Date): string =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(deadline);

export type BankTransferBlockCode = 'limited_reward';

/**
 * 이 리워드들로 계좌 입금을 받을 수 있는가 — 막히면 그 이유, 되면 null.
 *
 * **한정 수량 리워드는 계좌 입금을 받지 않는다.** 계좌 입금은 확인까지 며칠이 걸리는데
 * 그동안 재고를 붙들면 다른 후원자가 품절을 보고, 붙들지 않으면 입금을 확인하는 순간 이미
 * 다 팔렸을 수 있다. 무제한 리워드만 받으면 둘 다 생기지 않는다(입금 확인에 재고 재검증이
 * 필요 없다).
 *
 * 후원 폼(`components/funding/PledgeWizard.tsx`)과 서버 검증(`lib/funding/validation.ts`)이
 * **이 함수 하나를 같은 인자로** 부른다. 인자는 필수다 — 한쪽이 빼먹고 컴파일되면 화면은
 * 계좌를 고르게 두는데 서버가 거절하는 죽은 선택지가 생긴다(PR #77의 교훈).
 */
export const bankTransferBlockReason = (
  rewards: ReadonlyArray<{ totalQuantity: number | null }>,
): BankTransferBlockCode | null => (rewards.some((r) => r.totalQuantity !== null) ? 'limited_reward' : null);

export const BANK_TRANSFER_BLOCK_MESSAGES: Record<BankTransferBlockCode, string> = {
  limited_reward: '수량이 정해진 리워드는 카드·간편결제로만 받습니다. 입금을 확인하는 사이 다 팔릴 수 있어서입니다.',
};

/**
 * 온라인 **계좌 입금** 후원인가 — 후원자가 폼에서 "계좌로 직접 입금"을 고른 건.
 *
 * 관리자 수기 등록도 `payment_method = 'bank_transfer'`다(운영자가 현장·계좌로 받은 돈을 적는
 * 기능). 그 둘은 결제수단이 같아도 다루는 법이 다르다 — 수기 건은 등록 순간 이미 `paid`이고
 * 후원자가 화면에서 취소를 요청하는 경로가 없다. 그래서 결제수단만 보지 말고 **등록 경로까지**
 * 본다. 인자는 둘 다 필수다.
 */
export const isOnlineBankTransfer = (pledge: { paymentMethod: string; entrySource: string }): boolean =>
  pledge.paymentMethod === 'bank_transfer' && pledge.entrySource === 'online';

/**
 * 환불 계좌 입력 칸의 글자수 상한 — 펀딩 확인 페이지의 입력 칸(maxLength)과 서버 검증
 * (lib/funding/refundAccount.ts)이 같은 값을 본다. 화면이 import하므로 여기(클라이언트 안전)에 둔다.
 */
export const REFUND_ACCOUNT_LIMITS = { bankName: 30, accountNumber: 30, accountHolder: 30 } as const;
