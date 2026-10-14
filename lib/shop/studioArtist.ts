/**
 * 스튜디오 자체 상품의 소유 계정 — 순수 상수(클라이언트도 쓴다).
 *
 * `shop_products.creator_id`가 `funding_creators` FK라 스튜디오 상품도 "상점 아티스트" 하나가 소유한다. 이 slug를 가진
 * `shop_artists` 행이 그 계정이고, 서버가 처음 필요할 때 만든다(`ensureStudioShopArtist`). 판정은 이 상수 하나다:
 * - 아티스트 정산 예정 표에서 뺀다(스튜디오 몫).
 * - 공개 아티스트 페이지·상품 상세의 아티스트 링크·사이트맵·llms에 나오지 않는다(스튜디오 상품은 `/ko/shop`에만).
 * - 일반 아티스트 등재가 이 slug를 쓰지 못한다.
 */
export const STUDIO_SHOP_ARTIST_SLUG = 'studio-nol';
export const STUDIO_SHOP_ARTIST_NAME = '스튜디오 놀';

export const isStudioShopArtistSlug = (slug: string | null | undefined): boolean => slug === STUDIO_SHOP_ARTIST_SLUG;
