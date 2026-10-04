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

/**
 * 공연 히어로의 배경 사진 — 모든 공연이 같은 고정 이미지를 쓴다. 포스터는 글자가 든 이미지라 배경으로 깔면
 * 잘리고 흐려져 어수선하고, 포스터가 밝거나 가로형인 공연이 오면 히어로가 공연마다 달라진다. 포스터는 히어로가
 * 아니라 **본문(ShowPoster)** 에서 읽을 수 있는 크기로 보여 준다(2026-10-04 운영자 지적).
 */
export const SHOW_HERO_IMAGE = '/images/bulgwang-mixing-club.webp';
