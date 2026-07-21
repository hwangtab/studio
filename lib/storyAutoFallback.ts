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
 * "이 글이 실제 상권의 연습실 지역 LP인가?"
 *
 * region 카테고리 라이브 스토리 48편은 성격이 셋으로 갈린다:
 *   - practice-room-{동네} 26편 — 연신내·불광·응암·삼송·덕양 등 실제 통근권. 순수 연습실 의도.
 *   - 광역 허브 18편 (isRegionHub) — seoul1·busan1·jeju1 등. 부산 검색자에게 서울 연습실은 무의미하나
 *     원격 믹싱·데이록 녹음은 유효하므로 녹음 오퍼를 유지한다.
 *   - 교통 가이드 4편 — ktx-*-guide1·seoul-metro-guide1·dongjak1. 스튜디오로 "찾아오는" 사람이므로
 *     녹음 의도다.
 *
 * data/practiceRoomRegionLPs.ts는 hub-and-spoke 섹션용 큐레이션 부분집합(21개)이라
 * 5편(합정·망원·월드컵·대화·화정)을 놓친다. 슬러그 접두사가 실제 분류 기준이다.
 */
export const isPracticeRoomRegionStory = (categoryKey: string, slug: string): boolean =>
  categoryKey === 'region' && slug.startsWith('practice-room-');

/**
 * 슬러그를 함께 보는 가격 매칭.
 * 실상권 연습실 LP는 가격표를 받지 않는다 — decideAutoFallback이 price를 service보다 먼저
 * 반환하고 하나만 주입하므로(lib/inlineDirectives.ts:92,100), 가격을 비워야 연습실 브릿지가 들어간다.
 */
export const matchPricingForStory = (categoryKey: string, slug: string): string | null => {
  if (isPracticeRoomRegionStory(categoryKey, slug)) return null;
  return matchPricingForCategory(categoryKey);
};

/** 슬러그를 함께 보는 서비스 매칭. 실상권 연습실 LP는 연습실 브릿지를 받는다. */
export const matchServiceForStory = (categoryKey: string, slug: string): string | null => {
  if (isPracticeRoomRegionStory(categoryKey, slug)) return 'practice';
  return matchServiceForCategory(categoryKey);
};

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
