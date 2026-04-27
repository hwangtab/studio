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
