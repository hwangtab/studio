/**
 * 포커스 링 한 벌 (docs/design-system.md §5).
 *
 * 알파 `/70`, 다크는 밝은 짝(`primary-lighter`), 오프셋은 실제 표면색. 중간 계층
 * 프리미티브(Choice·Checkbox·Disclosure·Modal…)가 전부 이 문자열을 쓴다 — 컴포넌트마다
 * 다시 적으면 `/40`·오프셋 누락 같은 회귀가 한 곳씩 되살아난다(§5의 75곳 사고).
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900';

/**
 * 안쪽 입력이 포커스를 받으면 **바깥 카드**에 링을 그린다(`:has()`). 입력을 `sr-only`로
 * 숨긴 알약과 눈에 보이는 라디오 카드 양쪽에서, 키보드 사용자가 보는 것은 카드 전체의
 * 테두리여야 한다 — 티어 카드처럼 입력만 숨기고 링을 안 주면 포커스 위치가 사라진다.
 */
export const FOCUS_RING_WITHIN =
  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-primary/70 dark:has-[:focus-visible]:ring-primary-lighter/70 ring-offset-white dark:ring-offset-gray-900';
