import type { PortfolioCategory, PortfolioItem, AudioTrack } from '../types/data';
import type { Locale } from '../lib/i18n';
import { buildCategories } from './portfolio/categories';
import { buildPortfolioItems } from './portfolio/items';
import { buildAudioTracks } from './portfolio/tracks';

// portfolio 데이터는 카테고리/아이템/오디오 트랙 단위로 data/portfolio/* 디렉터리에
// 분할되어 있다. 이 파일은 외부 import 호환을 위한 얇은 facade로, 빌드 캐시
// 레이어와 공개 API(getCategories/getPortfolioItems/getAudioTracks)만 유지한다.
// 콘텐츠 변경은 해당 분할 파일에서, t() helper는 ./portfolio/i18n에서 관리.

const enableCache = process.env.NODE_ENV === 'production';
const categoriesCache: Partial<Record<Locale, PortfolioCategory[]>> = {};
const portfolioItemsCache: Partial<Record<Locale, PortfolioItem[]>> = {};
const audioTracksCache: Partial<Record<Locale, AudioTrack[]>> = {};

export const getCategories = (locale: Locale): PortfolioCategory[] => {
    if (enableCache) {
        const cached = categoriesCache[locale];
        if (cached) return cached;
    }

    const categories = buildCategories(locale);
    if (enableCache) {
        categoriesCache[locale] = categories;
    }
    return categories;
};

export const getPortfolioItems = (locale: Locale): PortfolioItem[] => {
    if (enableCache) {
        const cached = portfolioItemsCache[locale];
        if (cached) return cached;
    }

    const items = buildPortfolioItems(locale);
    if (enableCache) {
        portfolioItemsCache[locale] = items;
    }
    return items;
};

/** 발매 프로젝트 티어 페이지가 디스코그래피에 실을 항목 형태. */
export type TierPortfolioItem = Pick<
  PortfolioItem,
  'id' | 'title' | 'description' | 'image' | 'artist' | 'featured' | 'category'
>;

export type ReleaseTier = 'single' | 'ep' | 'album';

/**
 * 티어별 디스코그래피에 어떤 카테고리를 증빙으로 쓸지.
 *
 * 예전엔 세 티어 페이지가 모두 featured 전체(싱글 섞임)를 그대로 보여줬다 — 정규앨범
 * 문의자가 싱글 위주 목록을 보는 상태였다. 티어에 맞는 카테고리를 앞세우되, 해당 카테고리가
 * 12칸을 못 채우면 인접 카테고리로 채워 빈 섹션을 만들지 않는다.
 *
 * - single: 싱글만.
 * - album: 정규앨범 + 컴필레이션. 운영자 확인(2026-09-04) — 컴필레이션도 정규로 본다.
 * - ep: EP를 먼저, 부족분은 앨범(EP는 미니앨범이라 앨범 작업에 가깝다) → 싱글 순.
 */
const TIER_CATEGORIES: Record<ReleaseTier, PortfolioItem['category'][]> = {
  single: ['single'],
  album: ['album', 'compilation'],
  ep: ['ep', 'album', 'single'],
};

const DISCOGRAPHY_LIMIT = 12;

/**
 * 티어 디스코그래피 항목을 고른다.
 *
 * 순서: (1) 티어 카테고리 & featured → (2) 티어 카테고리 non-featured → (3) 그 외 featured.
 * "티어 카테고리 우선"이라 정규앨범 페이지 상단은 반드시 앨범/컴필레이션이 온다. 12칸을
 * 못 채우면 featured 전체에서 마저 채워 빈 섹션을 만들지 않는다.
 */
export const getTierPortfolioItems = (locale: Locale, tier: ReleaseTier): TierPortfolioItem[] => {
  const all = getPortfolioItems(locale);
  const inTier = TIER_CATEGORIES[tier];
  const pick = ({ id, title, description, image, artist, featured, category }: PortfolioItem): TierPortfolioItem => ({
    id, title, description, image, artist, featured, category,
  });

  const seen = new Set<string>();
  const result: TierPortfolioItem[] = [];
  const take = (items: PortfolioItem[]) => {
    for (const item of items) {
      if (result.length >= DISCOGRAPHY_LIMIT) break;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(pick(item));
    }
  };

  const isTierCategory = (item: PortfolioItem) => inTier.includes(item.category);
  // 버킷 안에서는 TIER_CATEGORIES에 적은 순서로 정렬한다 — EP처럼 여러 카테고리를 폴백으로
  // 쓰는 티어에서 "앞에 적은 카테고리를 먼저" 보이게(EP는 앨범 먼저) 하기 위해서다.
  // 같은 카테고리끼리는 원본(items.ts) 순서를 유지한다(안정 정렬).
  const byTierPriority = (items: PortfolioItem[]) =>
    [...items].sort((a, b) => inTier.indexOf(a.category) - inTier.indexOf(b.category));

  take(byTierPriority(all.filter((i) => isTierCategory(i) && i.featured)));
  take(byTierPriority(all.filter((i) => isTierCategory(i) && !i.featured)));
  take(all.filter((i) => i.featured));

  return result;
};

export const getAudioTracks = (locale: Locale): AudioTrack[] => {
    if (enableCache) {
        const cached = audioTracksCache[locale];
        if (cached) return cached;
    }

    const tracks = buildAudioTracks(locale);
    if (enableCache) {
        audioTracksCache[locale] = tracks;
    }
    return tracks;
};
