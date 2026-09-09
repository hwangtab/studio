import type { Locale } from '../../lib/i18n';
import type { PortfolioItem } from '../../types/data';
import { getPortfolioItems } from '../portfolio';

export type ArtistLinkKey = 'instagram' | 'youtube' | 'spotify' | 'melon' | 'bandcamp' | 'site';

/**
 * 후원 멤버십에 참여하는 아티스트. 운영자가 섭외·동의서를 받은 팀만 여기 싣는다.
 * 관리자 UI 없음 — 상품·포트폴리오와 같이 코드로 관리한다(스펙 §7.1).
 *
 * - portfolioArtist: data/portfolio/items.ts의 artist 문자열과 정확히 일치해야 작업 사례가 붙는다.
 * - image: 권리 확인된 파일만. 포트폴리오 이미지는 대부분 외부 CDN이라 그대로 못 쓴다.
 * - bio: 마크다운. 포트폴리오 productionNotes와 운영자 제공 자료에 있는 사실만 쓴다.
 */
export interface SupportedArtist {
  slug: string;
  name: string;
  portfolioArtist: string;
  tagline: string;
  bio: string;
  image: string;
  links: Partial<Record<ArtistLinkKey, string>>;
  /** false면 페이지는 있되 후원 CTA를 렌더하지 않는다(2차부터 의미를 가진다). */
  supportActive: boolean;
  /** 지급 시 세금 처리 — 3.3% 원천징수 | 사업자 세금계산서 (스펙 §10). */
  taxType: 'withholding' | 'invoice';
  joinedOn: string;
  /** 소개·링크를 마지막으로 고친 날. 사이트맵 lastmod는 이 파일의 커밋 시각을 쓰므로(lib/sitemap/routes.js) 표시·기록용이다. */
  updatedOn: string;
}

/** 목록 카드가 실제로 쓰는 필드만. taxType·joinedOn·portfolioArtist는 __NEXT_DATA__에 실리면 안 된다. */
export type ArtistCardData = Pick<SupportedArtist, 'slug' | 'name' | 'tagline' | 'image'>;

export const toArtistCardData = (a: SupportedArtist): ArtistCardData => ({
  slug: a.slug,
  name: a.name,
  tagline: a.tagline,
  image: a.image,
});

/** 상세 페이지가 실제로 쓰는 필드만. taxType·joinedOn·portfolioArtist는 __NEXT_DATA__에 실리면 안 된다. */
export type ArtistPageData = Pick<
  SupportedArtist,
  'slug' | 'name' | 'tagline' | 'bio' | 'image' | 'links' | 'supportActive'
>;

export const toArtistPageData = (a: SupportedArtist): ArtistPageData => ({
  slug: a.slug,
  name: a.name,
  tagline: a.tagline,
  bio: a.bio,
  image: a.image,
  links: a.links,
  supportActive: a.supportActive,
});

export const SUPPORTED_ARTISTS: readonly SupportedArtist[] = [];

export const getSupportedArtists = (): SupportedArtist[] => [...SUPPORTED_ARTISTS];

export const getSupportedArtist = (slug: string): SupportedArtist | null =>
  SUPPORTED_ARTISTS.find((a) => a.slug === slug) ?? null;

export const getArtistPortfolioItems = (artist: SupportedArtist, locale: Locale): PortfolioItem[] =>
  getPortfolioItems(locale)
    .filter((item) => item.artist === artist.portfolioArtist)
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
    });
