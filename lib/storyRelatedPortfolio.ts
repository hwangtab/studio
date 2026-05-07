import { getPortfolioItems } from '../data/portfolio';
import { defaultLocale, type Locale } from './i18n-config';
import type { PortfolioItem } from '../types/data';

/**
 * 스토리 카테고리에 따라 인라인으로 노출할 포트폴리오 아이템을 매칭한다.
 *
 * 동선 의도: recording/mixing/production/vocal 카테고리 스토리는 가이드를
 * 읽고 "실제 결과물이 궁금"한 단계로 넘어갈 가능성이 높다. 이 단계에서
 * portfolio 인라인 카드를 보여주면 가이드 → 작업물 → 예약 흐름이 이어진다.
 *
 * 다음 카테고리는 의도 차이로 매칭하지 않는다:
 *   - lesson: 학습 의도 (StoryCTA가 lesson으로 안내)
 *   - event/region/business/feedback: portfolio와 의미 연결 약함
 */
const PORTFOLIO_BEARING_CATEGORIES = new Set([
  'recording',
  'mixing',
  'production',
  'vocal',
  'instrument',
]);

/**
 * slug 문자열을 32-bit 해시로 변환 — build-time 결정성을 보장하기 위한 시드.
 * 같은 slug는 항상 같은 portfolio 후보를 받는다.
 */
const hashSlug = (slug: string): number => {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/**
 * 스토리 본문 끝 / StoryCTA 위에 노출할 portfolio 아이템 N개를 반환한다.
 * - featured=true 항목을 우선 후보군으로 잡는다.
 * - slug 해시를 시드로 결정성 있게 N개 선택해 build 캐시 안정.
 * - 카테고리가 비대상이면 빈 배열 반환 (호출 측에서 섹션 자체를 숨김).
 */
export const getStoryRelatedPortfolio = (
  storyCategoryKey: string,
  storySlug: string,
  locale: string = defaultLocale,
  limit = 3
): PortfolioItem[] => {
  if (!PORTFOLIO_BEARING_CATEGORIES.has(storyCategoryKey)) return [];

  const targetLocale = (locale as Locale) || defaultLocale;
  const all = getPortfolioItems(targetLocale);
  if (all.length === 0) return [];

  const featured = all.filter((item) => item.featured);
  const fallback = all.filter((item) => !item.featured);
  const pool = featured.length >= limit ? featured : [...featured, ...fallback];

  const seed = hashSlug(storySlug);
  const offset = seed % pool.length;

  const picks: PortfolioItem[] = [];
  for (let i = 0; i < limit && i < pool.length; i++) {
    picks.push(pool[(offset + i) % pool.length]);
  }
  return picks;
};
