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

/**
 * 공연 히어로의 배경(포스터)을 흐리게 하는 클래스 — ImageHero는 공용이라 건드리지 않고 배경 래퍼(`.hero-zoom`)를
 * 호출하는 쪽에서 덮는다. 포스터는 글자가 든 이미지라 그대로 깔면 큰 글씨가 제목 뒤에 비쳐 어수선하다(2026-10-04).
 * 흐림 필터가 가장자리를 투명하게 만들므로 래퍼를 사방으로 키우고(-inset-12), 확대 애니메이션은 끈다 — 필터가 걸린
 * 큰 레이어를 5초간 변형시키지 않으려는 것이다(정적 scale(1.1)은 남는다).
 */
export const SHOW_HERO_BLUR_CLASS = '[&_.hero-zoom]:-inset-12 [&_.hero-zoom]:blur-2xl [&_.hero-zoom]:animate-none';
