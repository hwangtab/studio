/**
 * 섹션 배경색 일관성 유지를 위한 상수
 * 모든 페이지에서 동일한 섹션 스타일을 사용하도록 합니다.
 */

export const SECTION_BG = {
  // 히어로 섹션 - 주로 그래디언트 배경
  hero: 'bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent',

  // 기본 섹션 배경 - 흰색/밝은 배경
  light: 'bg-white dark:bg-gray-800',

  // 교대 섹션 배경 - 약간 어두운 배경
  alternate: 'bg-gray-50 dark:bg-gray-900/50',

  // 강조 섹션 - 그래디언트 배경
  highlight: 'bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10',

  // CTA 섹션 - 진한 배경
  cta: 'bg-gray-50 dark:bg-gray-950',

  // 투명 배경
  transparent: 'bg-transparent',
};

/**
 * 섹션 여백 일관성
 */
export const SECTION_PADDING = {
  standard: 'py-16',
  large: 'py-20',
  small: 'py-12',
};

/**
 * 섹션 배경과 여백을 함께 사용하는 헬퍼
 */
export const getSectionClass = (bgType = 'light', paddingType = 'standard') => {
  return `${SECTION_BG[bgType]} ${SECTION_PADDING[paddingType]}`;
};

export default SECTION_BG;
