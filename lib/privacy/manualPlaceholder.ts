/**
 * 수기 등록(관리자가 대신 적는 후원·예약)에서 연락처 칸이 비었을 때 채워 넣는 플레이스홀더.
 * 실제 수신함도 번호도 아니다 — 이 주소로 보내면 반송돼 발신 도메인 평판을 깎는다. 메일을 보내는 모든 경로는
 * `isManualPlaceholderRecipient`로 먼저 걸러야 한다. 펀딩·예약이 **한 곳만 보도록** 여기 모은다
 * (예전엔 lib/funding/service.ts에 있었고 거기서 다시 내보낸다).
 */
export const MANUAL_PLACEHOLDER_EMAIL = 'manual@studionol.co.kr';
export const MANUAL_PLACEHOLDER_PHONE = '-';

/** 이 주문의 고객 메일 주소가 배달될 수 없는 플레이스홀더인가. 주소만 본다 — 등록 경로를 함께 보면 구멍이 생긴다. */
export const isManualPlaceholderRecipient = (order: { customerEmail: string }): boolean =>
  order.customerEmail === MANUAL_PLACEHOLDER_EMAIL;
