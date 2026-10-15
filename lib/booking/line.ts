/**
 * 예약·믹싱 화면을 나누는 **사업 라인** — 관리자 메뉴가 연습실 / 녹음실 / 플랫폼으로 갈리면서 한 화면에 섞여 있던
 * 주문을 라인별로 볼 수 있게 했다. 이 모듈은 아무것도 import하지 않는다(메뉴 껍데기와 목록 화면, 서버가 같은 판정을 쓴다).
 *
 * - practice: 연습실 시간제 예약(`serviceType = practice-room`)
 * - studio: 녹음·성우·축가·커버영상 같은 스튜디오 세션 예약
 * - mixing: 믹싱·마스터링 주문
 * 예약금 결제 링크 주문(`deposit`)은 어느 라인도 아니다 — 결제 링크 화면과 '전체'에서만 보인다.
 */
export const BOOKING_LINES = ['practice', 'studio', 'mixing'] as const;
export type BookingLine = (typeof BOOKING_LINES)[number];

export const BOOKING_LINE_LABELS: Record<BookingLine, string> = {
  practice: '연습실 예약',
  studio: '녹음실 예약',
  mixing: '믹싱·마스터링',
};

export const parseBookingLine = (value: unknown): BookingLine | null => {
  const v = Array.isArray(value) ? value[0] : value;
  return (BOOKING_LINES as readonly unknown[]).includes(v) ? (v as BookingLine) : null;
};

export const bookingLineOf = (order: { orderType: string; serviceType: string }): BookingLine | null => {
  if (order.orderType === 'mixing') return 'mixing';
  if (order.orderType !== 'session') return null;
  return order.serviceType === 'practice-room' ? 'practice' : 'studio';
};
