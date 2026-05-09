/**
 * Phase 2 자동 fallback 매핑·inject 로직.
 *
 * categoryKey 단순 매핑은 의미가 명확한 카테고리(recording/mixing/instrument)만 유지.
 * vocal/production/lesson은 글 단위 frontmatter `inlineFallback`로 정밀 매칭한다.
 */

export const PRICING_BY_CATEGORY: Readonly<Record<string, string>> = {
  recording: 'recording-pro',
  mixing: 'mixing-level1',
  instrument: 'recording-hourly',
};

export const REVIEW_BY_CATEGORY: Readonly<Record<string, string>> = {
  mixing: 'review-3',
  practice: 'review-4',
};

export const matchPricingForCategory = (categoryKey: string): string | null =>
  PRICING_BY_CATEGORY[categoryKey] ?? null;

export const matchReviewForCategory = (categoryKey: string): string | null =>
  REVIEW_BY_CATEGORY[categoryKey] ?? null;

/**
 * 본문 마지막 H2 직전에 short-code marker inject.
 * 매칭 H2 없으면 본문 끝에 append.
 */
export const injectAutoFallbackMarker = (content: string, marker: string): string => {
  const lines = content.split('\n');
  let lastH2 = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^## /.test(lines[i])) {
      lastH2 = i;
      break;
    }
  }
  if (lastH2 === -1) {
    return `${content}\n\n${marker}\n`;
  }
  return [
    ...lines.slice(0, lastH2),
    '',
    marker,
    '',
    ...lines.slice(lastH2),
  ].join('\n');
};
