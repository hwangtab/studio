// 스무스 스크롤 공용 헬퍼 (SSOT).
//
// 배경: JS의 `Element.scrollTo/scrollBy/scrollIntoView({ behavior: 'smooth' })`는
// CSS `scroll-behavior`가 아니라 스크립트 API라서, globals.css의
// `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }`
// 블랭킷 규칙이 적용되지 않는다 → OS "동작 줄이기" 설정을 무시하고 항상 부드럽게 스크롤.
//
// 해결: 각 호출부가 매체 질의를 직접 확인해 reduce 시 'auto'로 폴백한다. 이는 이미
// reduce를 존중하는 SectionAnchorNav·TableOfContents·ContactFormCard와 동일한 패턴이며,
// 스크롤 6개 호출부(ScrollToTop·MediaGallery×2·stories 목록·카테고리)를 이 헬퍼로 통일한다.
//
// 주의: 스크롤은 OS `prefers-reduced-motion`만 존중한다(터치기기 여부는 보지 않음).
// 터치기기 억제는 장식 애니메이션(LP 회전·이퀄라이저) 정책이며 스크롤과 무관하다.

/** OS `prefers-reduced-motion: reduce` 여부. SSR·미지원 환경에서는 false. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * prefers-reduced-motion을 존중하는 ScrollBehavior 반환.
 * reduce 설정 시 'auto'(즉시 이동), 그 외 'smooth'.
 *
 * 사용: `el.scrollTo({ top: y, behavior: getScrollBehavior() })`
 */
export const getScrollBehavior = (): ScrollBehavior =>
  prefersReducedMotion() ? 'auto' : 'smooth';
