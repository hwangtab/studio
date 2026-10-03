/** 공연 예매 화면 공통 문구. 서버·클라이언트 모두 쓰는 순수 값. */

/** 현장 판매 안내 — 안내문구로만 쓴다(온라인 결제 금액과 무관하고 현장 잔여석이 있을 때만). */
export const ON_SITE_PRICE_NOTE = '현장 판매 30,000원 (현장 잔여석이 있는 경우)';

export const SHOW_CONTACT_PHONE = '010-4255-7893';

export const formatWon = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

export const SALE_STATE_LABELS = {
  open: '예매 중',
  sold_out: '매진',
  closed: '예매 마감',
  ended: '종료',
  cancelled: '취소됨',
} as const;
