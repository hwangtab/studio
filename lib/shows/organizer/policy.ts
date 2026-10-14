/** 주최자 약관 판본. 내용을 바꾸면 먼저 올리고 기준선을 다시 쓴다(content/showOrganizerTerms.baseline.test.ts). */
export const SHOW_ORGANIZER_TERMS_VERSION: string = 'show-organizer-terms-2026-10-14-r3';

/**
 * 공개 공연 페이지(/ko/shows/<slug>)가 열려 있는 공연 상태. 승인됐어도 공개에 실패한 공연은 draft라 페이지가 404다 —
 * 콘솔의 "공개된 페이지 보기"는 이 판정으로만 띄운다. 취소된 공연도 안내 페이지가 남는다.
 */
export const isShowPagePublic = (status: string | null | undefined): boolean =>
  status === 'published' || status === 'cancelled';
