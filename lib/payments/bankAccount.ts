/**
 * **계좌 입금**(무통장)의 받는 계좌·안내 기한·입력 상한 — 결제 공용 정본.
 *
 * 펀딩·공연 티켓·연습실/녹음 예약·믹싱 주문이 함께 쓴다. 결제 종류와 무관한 것(계좌·기한·안내 시각
 * 표기·환불 계좌 입력 상한)만 여기 두고, 펀딩 고유 규칙(한정 리워드 불가 등)은 lib/funding/bankAccount.ts,
 * 공연·예약·믹싱 규칙은 lib/payments/bankDeposit.ts에 둔다.
 *
 * 화면과 메일이 모두 여기서 계좌를 읽는다. 약관·처리방침 본문에는 계좌번호를 쓰지 않는다("안내 화면·
 * 메일에 표시된 계좌") — 계좌를 바꿀 때 동의 문서 판본까지 올리지 않아도 되게.
 *
 * **이 모듈은 아무것도 import하지 않는다** — 클라이언트 번들(후원 폼·확인 페이지)이 값을 가져간다.
 */

export const BANK_ACCOUNT = {
  bankName: '카카오뱅크',
  accountNumber: '3333-12-5480849',
  accountHolder: '황경하 / 스튜디오 놀',
} as const;

/** 영어 화면용 은행·예금주 표기(공연 /en). 계좌번호는 위 값 하나다. 예금주 실명은 은행 앱이 한글로 보여 주므로 함께 적는다. */
export const BANK_ACCOUNT_EN = {
  bankName: 'KakaoBank',
  accountHolder: '황경하 (Hwang Kyungha) / Studio NOL',
} as const;

/**
 * 입금 안내에 적는 기한(일). **안내용일 뿐이다 — 지나도 신청을 자동으로 취소하지 않는다.**
 *
 * SAF2026에서 실제로 난 사고: 같은 사람이 중복 신청한 것 중 버려진 쪽이 자동 만료되면서,
 * 이미 입금한 사람에게 "취소됨" 메일이 갔다. 그래서 계좌 입금 대기는 홀드 만료
 * (`expireStalePledges`) 대상에서 빠지고, 만료 메일도 없다. 기한이 지나도 안내 화면은
 * 계좌를 그대로 보여 준다 — 늦게 보낸 돈도 운영자가 확인하면 확정된다.
 *
 * 펀딩은 `funding_pledges.hold_expires_at`에 신청 시각 + 이 기간을 적고, 화면·메일은 그 값을 기한으로
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


/**
 * 환불 계좌 입력 칸의 글자수 상한 — 펀딩 확인 페이지의 입력 칸(maxLength)과 서버 검증
 * (lib/payments/refundAccount.ts)이 같은 값을 본다. 화면이 import하므로 여기(클라이언트 안전)에 둔다.
 */
export const REFUND_ACCOUNT_LIMITS = { bankName: 30, accountNumber: 30, accountHolder: 30 } as const;
