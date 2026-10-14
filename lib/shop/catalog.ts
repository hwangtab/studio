import { isDbSkuId } from './productRules';
import { SHOP_PRODUCTS, type ShopProduct, type ShopSku } from '../../data/shop/catalog';

/**
 * 카탈로그 조회·검증 — 순수 모듈(클라이언트도 쓴다). 정본은 data/shop/catalog.ts.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SHOP_SLUG_PATTERN = SLUG_PATTERN;
const SKU_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** pages/[locale]/shop/ 아래 리터럴 페이지 — 리터럴 라우트가 [slug]를 이겨 그 상품은 어떤 주소로도 안 열린다. */
export const SHOP_RESERVED_SLUGS = ['success', 'fail', 'manage', 'artist'] as const;

export const publishedShopProducts = (products: readonly ShopProduct[] = SHOP_PRODUCTS): ShopProduct[] =>
  products.filter((p) => p.published);

export const findShopProduct = (slug: unknown, products: readonly ShopProduct[] = SHOP_PRODUCTS): ShopProduct | null => {
  if (typeof slug !== 'string') return null;
  return products.find((p) => p.slug === slug && p.published) ?? null;
};

export interface ResolvedSku {
  product: ShopProduct;
  sku: ShopSku;
}

/** 팔 수 있는 SKU만(공개 상품 + retired 아님). 없으면 null. */
export const findSellableSku = (skuId: unknown, products: readonly ShopProduct[] = SHOP_PRODUCTS): ResolvedSku | null => {
  if (typeof skuId !== 'string') return null;
  for (const product of products) {
    if (!product.published) continue;
    const sku = product.skus.find((s) => s.id === skuId && !s.retired);
    if (sku) return { product, sku };
  }
  return null;
};

/** 그 아티스트의 공개 상품(위탁 판매). */
export const artistShopProducts = (artistSlug: string, products: readonly ShopProduct[] = SHOP_PRODUCTS): ShopProduct[] =>
  products.filter((p) => p.published && p.artist === artistSlug);

/** 한 줄 표시 이름 — "상품명 · 옵션". */
export const shopLineName = (title: string, optionLabel?: string | null): string =>
  optionLabel ? `${title} · ${optionLabel}` : title;

/**
 * 카탈로그 모양 검사 — 문제 목록(비면 정상). data/shop/catalog.test.ts가 CI에서 돌린다. 주문 경로가 잘못된 정의를
 * 만나면 조용히 이상한 값을 팔게 되므로 정의 단계에서 막는다.
 */
export const validateShopCatalog = (products: readonly ShopProduct[]): string[] => {
  const problems: string[] = [];
  const slugs = new Set<string>();
  const skuIds = new Set<string>();
  for (const p of products) {
    const where = `상품 ${p.slug || '(slug 없음)'}`;
    if (!SLUG_PATTERN.test(p.slug)) problems.push(`${where}: slug는 소문자·숫자·하이픈만`);
    if ((SHOP_RESERVED_SLUGS as readonly string[]).includes(p.slug)) problems.push(`${where}: 예약된 slug(페이지 이름과 겹친다)`);
    if (slugs.has(p.slug)) problems.push(`${where}: slug 중복`);
    slugs.add(p.slug);
    if (p.category !== 'album' && p.category !== 'goods') problems.push(`${where}: category는 album 또는 goods`);
    if (!p.title.trim()) problems.push(`${where}: title이 비었다`);
    if (p.artist !== undefined && !SLUG_PATTERN.test(p.artist)) problems.push(`${where}: artist는 data/artists의 slug(소문자·숫자·하이픈)`);
    if (p.description.length === 0 || !p.description[0].trim()) problems.push(`${where}: 첫 문단(description[0])이 비었다`);
    if (p.description[0] && /^(##|>)/.test(p.description[0].trim())) problems.push(`${where}: 첫 문단은 평문이어야 한다(검색 요약·OG 설명)`);
    if (p.published && p.images.length === 0) problems.push(`${where}: 공개 상품은 이미지가 한 장 이상 있어야 한다`);
    for (const img of p.images) {
      if (!/^\/images\/shop\/[a-z0-9-]+-\d{8}\.(webp|jpg|png|avif)$/.test(img)) {
        problems.push(`${where}: 이미지 ${img}는 /images/shop/<이름>-YYYYMMDD.<확장자> 형식이어야 한다(immutable 캐시)`);
      }
    }
    if (p.kind === 'digital') problems.push(`${where}: 디지털 상품(kind: 'digital')은 DB 상품 전용이다`);
    if (p.editionSize !== undefined) problems.push(`${where}: 한정판 넘버링(editionSize)은 DB 상품 전용이다`);
    if (p.skus.length === 0) problems.push(`${where}: SKU가 없다`);
    const sellable = p.skus.filter((s) => !s.retired);
    if (p.published && sellable.length === 0) problems.push(`${where}: 공개 상품인데 팔 수 있는 SKU가 없다`);
    if (sellable.length > 1 && sellable.some((s) => !s.optionLabel?.trim())) {
      problems.push(`${where}: SKU가 여럿이면 모두 optionLabel이 있어야 한다(고를 이름)`);
    }
    for (const s of p.skus) {
      if (!SKU_ID_PATTERN.test(s.id)) problems.push(`${where}: SKU id ${s.id}는 소문자·숫자·하이픈만`);
      if (isDbSkuId(s.id)) problems.push(`${where}: SKU id ${s.id}는 'db-' 접두사를 쓸 수 없다(DB 상품 전용)`);
      if (skuIds.has(s.id)) problems.push(`${where}: SKU id ${s.id} 중복(전역에서 겹치면 안 된다)`);
      skuIds.add(s.id);
      if (!Number.isInteger(s.price) || s.price <= 0) problems.push(`${where}: SKU ${s.id} 가격은 0보다 큰 정수(원)`);
    }
  }
  return problems;
};
