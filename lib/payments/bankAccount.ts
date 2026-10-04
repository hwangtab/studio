/**
 * **계좌 입금**(무통장)의 받는 계좌·안내 기한·입력 상한 — 결제 공용 정본.
 *
 * 펀딩이 먼저 쓰고(2026-10-04), 다음 단계에서 공연 티켓·연습실/녹음 예약·믹싱 주문도 계좌 입금을
 * 붙인다. 그래서 결제 종류와 무관한 것(계좌·기한·안내 시각 표기·환불 계좌 입력 상한·남용 상한용
 * 이메일 정규화)만 여기 두고, 펀딩 고유 규칙(한정 리워드 불가 등)은 lib/funding/bankAccount.ts에 둔다.
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

/**
 * 계좌 입금 신청의 **남용 상한에 쓰는** 이메일 정규화 — 저장값은 바꾸지 않는다.
 *
 * 소문자로 맞추고, `+태그`를 떼고, gmail·googlemail은 로컬 부분의 점을 지우고 도메인을 gmail.com으로
 * 모은다. 같은 수신함으로 가는 별칭(`a+1@`, `a.b@gmail`)을 바꿔 가며 상한을 우회하지 못하게 한다.
 */
export const normalizeEmailForLimit = (email: string): string => {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at <= 0) return lower;
  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
};
