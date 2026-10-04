/** 공연 예매 화면 공통 문구. 서버·클라이언트 모두 쓰는 순수 값. */

export const SHOW_CONTACT_PHONE = '010-4255-7893';

export const formatWon = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

export const SALE_STATE_LABELS = {
  open: '예매 중',
  sold_out: '매진',
  closed: '예매 마감',
  ended: '종료',
  cancelled: '취소됨',
} as const;

/** 히어로 배경 폴백 — 포스터가 없는 공연(또는 공연이 하나도 없는 목록)에서만 쓴다. 평소 배경은 포스터다. */
export const SHOW_HERO_IMAGE = '/images/bulgwang-mixing-club.webp';
