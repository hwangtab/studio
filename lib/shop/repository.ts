import {
  artistShopProducts, findShopProduct, findSellableSku, publishedShopProducts, type ResolvedSku,
} from './catalog';
import { findDbProductBySlug, findDbSellableSku, listDbPublishedProducts, listDbPublishedProductsByCreator, listDbSkusForAdmin } from './dbProducts';
import { findShopArtistCreatorId } from './artists';
import { isDbSkuId } from './productRules';
import { SHOP_PRODUCTS, type ShopProduct, type ShopSku } from '../../data/shop/catalog';

/**
 * 상점 상품을 읽는 **유일한 입구**(서버 전용 — DB를 import하므로 클라이언트 번들에 넣지 않는다).
 *
 * 순서는 파일(`data/shop/catalog.ts`) 먼저, 그다음 DB다. 같은 slug가 양쪽에 있으면 파일이 이긴다(펀딩 repository.ts와 같다).
 * 파일은 배포에 실려 있어 어느 인스턴스에서 읽어도 같지만 DB는 그 사이 누군가 고쳤을 수 있다.
 *
 * - 공개 목록·상세는 **DB 오류를 삼킨다**(빌드는 TURSO_* 없이 성공해야 하고, DB가 흔들려도 파일 상품은 열려 있어야 한다).
 * - 주문 생성처럼 권리를 판정하는 자리(`findSellableSkuAsync`)는 `{found}`/`{lookupFailed}`로 부재와 실패를 나눈다 → API 503.
 * - **`db-`로 시작하지 않는 SKU id는 DB를 조회하지 않는다** — 마이그레이션 0053 전 배포에서도 파일 상품 결제가 안 깨진다.
 */

const safeDb = async <T>(run: () => Promise<T>, fallback: T, where: string): Promise<T> => {
  try {
    return await run();
  } catch (error: unknown) {
    console.error(`[shop] DB 조회 실패(${where}) — 파일 기준으로만 응답합니다:`, error);
    return fallback;
  }
};

const fileSlugs = (): Set<string> => new Set(SHOP_PRODUCTS.map((p) => p.slug));

/** 공개 상품 목록 — 파일 먼저, 그다음 DB(파일에 있는 slug는 뺀다). */
export const listPublishedShopProducts = async (): Promise<ShopProduct[]> => {
  const fromFile = publishedShopProducts();
  const taken = fileSlugs();
  const fromDb = await safeDb(() => listDbPublishedProducts(), [] as ShopProduct[], 'list');
  return [...fromFile, ...fromDb.filter((p) => !taken.has(p.slug))];
};

/** slug로 공개 상품 하나. 파일 먼저. DB 오류는 삼키고 null. */
export const findShopProductAsync = async (slug: unknown): Promise<ShopProduct | null> => {
  if (typeof slug !== 'string') return null;
  const fromFile = findShopProduct(slug);
  if (fromFile) return fromFile;
  // 파일에 (비공개로라도) 있는 slug는 파일이 이긴다 — DB가 그 주소를 가로채지 못한다.
  if (fileSlugs().has(slug)) return null;
  return safeDb(() => findDbProductBySlug(slug), null, `slug=${slug}`);
};

export type SellableSkuLookup = { found: ResolvedSku | null } | { lookupFailed: true };

/** 팔 수 있는 SKU — 부재(`found: null`)와 조회 실패(`lookupFailed`)를 나눈다. */
export const findSellableSkuAsync = async (skuId: unknown): Promise<SellableSkuLookup> => {
  const fromFile = findSellableSku(skuId);
  if (fromFile) return { found: fromFile };
  if (!isDbSkuId(skuId)) return { found: null };
  try {
    return { found: await findDbSellableSku(skuId) };
  } catch (error: unknown) {
    console.error(`[shop] DB SKU 조회 실패(sku=${skuId}):`, error);
    return { lookupFailed: true };
  }
};

/**
 * 그 아티스트의 공개 상품 — 파일 상품(`artist === slug`) 먼저, 그다음 그 slug의 `shop_artists` 소유자가 가진 공개 DB 상품.
 * 파일 slug에 가려지는 DB 상품은 뺀다. DB 오류는 삼키고 파일 상품만 돌려준다.
 */
export const listShopProductsByArtist = async (artistSlug: string): Promise<ShopProduct[]> => {
  const fromFile = artistShopProducts(artistSlug);
  const taken = fileSlugs();
  const fromDb = await safeDb(async () => {
    const creatorId = await findShopArtistCreatorId(artistSlug);
    return creatorId ? listDbPublishedProductsByCreator(creatorId) : [];
  }, [] as ShopProduct[], `artist=${artistSlug}`);
  return [...fromFile, ...fromDb.filter((p) => !taken.has(p.slug))];
};

/** 관리자 재고 표용 — 파일 SKU 전부 + DB의 잠긴 SKU. DB 오류는 삼킨다. */
export const listAllSkusForAdmin = async (): Promise<Array<{ product: ShopProduct; sku: ShopSku }>> => {
  const fromFile = SHOP_PRODUCTS.flatMap((p) => p.skus.map((sku) => ({ product: p, sku })));
  const fromDb = await safeDb(() => listDbSkusForAdmin(), [] as Array<{ product: ShopProduct; sku: ShopSku }>, 'admin-skus');
  // 파일 slug에 가려진 DB 상품의 SKU도 싣는다 — 가려져도 sku_id로 팔릴 수 있어 재고를 정할 수 있어야 한다.
  return [...fromFile, ...fromDb];
};
