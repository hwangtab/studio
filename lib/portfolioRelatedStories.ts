import { getAllStories, isListableStory } from './stories';
import { defaultLocale, type Locale } from './i18n-config';
import type { StoryCardData } from '../types/story';

/**
 * 포트폴리오 detail 페이지에 surface할 관련 스토리를 반환한다.
 *
 * 의도: portfolio 페이지 방문자는 "이 작업이 어떻게 만들어졌는지"가 궁금한 단계.
 * recording/mixing/production 카테고리의 가이드를 보여주면 작업물 → 가이드 →
 * 다른 가이드 → 예약 흐름이 만들어진다. portfolio item id를 seed로 결정성 있게
 * 셔플해 같은 작업은 항상 같은 가이드 묶음을 받는다 (build 캐시 안정).
 */
const PORTFOLIO_RELATED_CATEGORIES = new Set([
  'recording',
  'mixing',
  'production',
]);

const hashId = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export const getPortfolioRelatedStories = (
  portfolioId: string,
  locale: string = defaultLocale,
  limit = 6
): StoryCardData[] => {
  const targetLocale = (locale as Locale) || defaultLocale;
  const all = getAllStories(targetLocale);

  const pool = all.filter(
    (s) => PORTFOLIO_RELATED_CATEGORIES.has(s.categoryKey) && isListableStory(s)
  );
  if (pool.length === 0) return [];

  const seed = hashId(portfolioId);
  const offset = seed % pool.length;
  const picks: typeof pool = [];
  for (let i = 0; i < limit && i < pool.length; i++) {
    picks.push(pool[(offset + i) % pool.length]);
  }

  return picks.map((s) => ({
    slug: s.slug,
    title: s.title,
    date: s.date,
    categoryKey: s.categoryKey,
    thumbnail: s.thumbnail,
    summary: s.summary,
  }));
};
