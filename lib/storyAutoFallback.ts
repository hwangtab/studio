/**
 * Phase 2 자동 fallback 매핑·inject 로직.
 *
 * categoryKey 단순 매핑은 의뢰 의도가 분명한 카테고리에 가격 카드(price)를 본문
 * 중간에 자동 삽입한다. frontmatter `inlineFallback`이 있으면 글 단위 정밀 매칭이
 * 우선하므로(빈 {}는 비활성), 이 매핑은 inlineFallback 없는 글에만 발화한다.
 *
 * 2026-05-31 확장: GSC/GA4 분석상 region(426)·vocal(141)·production(71)·
 * business(88) 카테고리는 본문 중간 전환 장치가 0개였다. 검색 의도와 매칭해
 * region/vocal/production → 보컬녹음(recording-pro), business(발매·유통) →
 * 믹싱·마스터링(mixing-level1) 가격 카드를 연결한다.
 */

export const PRICING_BY_CATEGORY: Readonly<Record<string, string>> = {
  recording: 'recording-pro',
  mixing: 'mixing-level1',
  region: 'recording-pro',
  vocal: 'recording-pro',
  production: 'recording-pro',
  business: 'mixing-level1',
};

export const SERVICE_BY_CATEGORY: Readonly<Record<string, string>> = {
  instrument: 'practice',
};

export const REVIEW_BY_CATEGORY: Readonly<Record<string, string>> = {
  mixing: 'review-3',
  practice: 'review-4',
};

export const matchPricingForCategory = (categoryKey: string): string | null =>
  PRICING_BY_CATEGORY[categoryKey] ?? null;

export const matchReviewForCategory = (categoryKey: string): string | null =>
  REVIEW_BY_CATEGORY[categoryKey] ?? null;

export const matchServiceForCategory = (categoryKey: string): string | null =>
  SERVICE_BY_CATEGORY[categoryKey] ?? null;

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
