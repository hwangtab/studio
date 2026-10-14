import { listShopArtistSlugsWithDbProducts, resolveShopArtist } from './artists';
import { listPublishedShopProducts, listShopProductsByArtist } from './repository';
import type { ShopProduct } from '../../data/shop/catalog';

/**
 * 검색엔진·AI에 내보내는 상점 목록(사이트맵·llms) — 서버 전용. 공개 상품 전부와, 공개 상품이 있고 페이지가 열리는 아티스트.
 * DB 조회 실패는 삼킨다(500보다 줄어든 목록이 낫다). 판매가 닫혀 있는지는 호출부가 본다.
 */
export const loadShopPublicIndex = async (): Promise<{ products: ShopProduct[]; artists: Array<{ slug: string; name: string }> }> => {
  const products = await listPublishedShopProducts();
  let dbSlugs: string[] = [];
  try {
    dbSlugs = await listShopArtistSlugsWithDbProducts();
  } catch (error: unknown) {
    console.error('[shop] 아티스트 목록 조회 실패:', error);
  }
  const fileSlugs = products.flatMap((p) => (p.artist ? [p.artist] : []));
  const artists: Array<{ slug: string; name: string }> = [];
  for (const slug of new Set([...fileSlugs, ...dbSlugs])) {
    const artist = await resolveShopArtist(slug);
    if (!artist) continue;
    if ((await listShopProductsByArtist(slug)).length === 0) continue;
    artists.push({ slug, name: artist.name });
  }
  return { products, artists };
};
