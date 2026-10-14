import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { shopProducts, shopProductSkus, type ShopProductRow, type ShopProductSkuRow } from '../../db/schema';
import type { ShopProduct, ShopSku } from '../../data/shop/catalog';
import type { ResolvedSku } from './catalog';

/**
 * DB 상품(아티스트 위탁) 읽기 — 공개 객체 `ShopProduct`로 정규화한다. 호출은 `repository.ts`가 유일한 입구다.
 *
 * - 공개 = `review_status='approved' AND published=1`. 판매 가능 SKU = `locked_at IS NOT NULL AND retired=0`.
 *   잠기지 않은 SKU(승인 뒤 아티스트가 더한 것)는 관리자가 "새 옵션 승인"으로 잠그기 전까지 보이지도 팔리지도 않는다.
 * - 공개 객체에 `digital_files`(R2 키)를 싣지 않는다 — `hasDownloads`만. 내부 메모·심사 메모도 싣지 않는다.
 * - 이 모듈은 `relations()`를 쓰지 않는다(새 표는 기존 관계에 잇지 않는다 — 0022 함정).
 */

const parseImages = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
  } catch {
    return [];
  }
};

const hasFiles = (raw: string | null): boolean => {
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
};

export const toShopSku = (row: ShopProductSkuRow): ShopSku => ({
  id: row.id,
  ...(row.optionLabel ? { optionLabel: row.optionLabel } : {}),
  price: row.price,
  ...(row.retired ? { retired: true } : {}),
});

/** DB 행 → ShopProduct. `skus`는 호출부가 정한 것(공개는 잠긴 SKU만)을 받는다. */
export const normalizeDbProduct = (row: ShopProductRow, skus: readonly ShopProductSkuRow[]): ShopProduct => ({
  slug: row.slug,
  category: row.category,
  title: row.title,
  ...(row.subtitle ? { subtitle: row.subtitle } : {}),
  description: row.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
  images: parseImages(row.images),
  skus: [...skus].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map(toShopSku),
  published: row.reviewStatus === 'approved' && row.published,
  kind: row.kind,
  ...(row.shipsOn ? { shipsOn: row.shipsOn } : {}),
  ...(row.editionSize != null ? { editionSize: row.editionSize } : {}),
  hasDownloads: hasFiles(row.digitalFiles),
  source: 'db',
});

const publicProductWhere = and(eq(shopProducts.reviewStatus, 'approved'), eq(shopProducts.published, true));

const loadLockedSkus = async (productIds: string[]): Promise<Map<string, ShopProductSkuRow[]>> => {
  const out = new Map<string, ShopProductSkuRow[]>();
  if (productIds.length === 0) return out;
  const rows = await getDb()
    .select()
    .from(shopProductSkus)
    .where(and(inArray(shopProductSkus.productId, productIds), isNotNull(shopProductSkus.lockedAt)))
    .orderBy(asc(shopProductSkus.sortOrder), asc(shopProductSkus.id));
  for (const r of rows) {
    const list = out.get(r.productId) ?? [];
    list.push(r);
    out.set(r.productId, list);
  }
  return out;
};

/** 팔 수 있는 SKU가 하나도 없는 상품은 공개하지 않는다(주문 폼이 가격을 못 고른다). */
const hasSellable = (skus: readonly ShopProductSkuRow[]): boolean => skus.some((s) => !s.retired);

export const listDbPublishedProducts = async (): Promise<ShopProduct[]> => {
  const rows = await getDb().select().from(shopProducts).where(publicProductWhere).orderBy(asc(shopProducts.approvedAt), asc(shopProducts.slug));
  const skus = await loadLockedSkus(rows.map((r) => r.id));
  return rows.flatMap((r) => {
    const list = skus.get(r.id) ?? [];
    return hasSellable(list) ? [normalizeDbProduct(r, list)] : [];
  });
};

/** 그 아티스트(creator)의 공개 DB 상품. */
export const listDbPublishedProductsByCreator = async (creatorId: string): Promise<ShopProduct[]> => {
  const rows = await getDb().select().from(shopProducts)
    .where(and(publicProductWhere, eq(shopProducts.creatorId, creatorId)))
    .orderBy(asc(shopProducts.approvedAt), asc(shopProducts.slug));
  const skus = await loadLockedSkus(rows.map((r) => r.id));
  return rows.flatMap((r) => {
    const list = skus.get(r.id) ?? [];
    return hasSellable(list) ? [normalizeDbProduct(r, list)] : [];
  });
};

export const findDbProductBySlug = async (slug: string): Promise<ShopProduct | null> => {
  const rows = await getDb().select().from(shopProducts).where(and(publicProductWhere, eq(shopProducts.slug, slug))).limit(1);
  const row = rows[0];
  if (!row) return null;
  const list = (await loadLockedSkus([row.id])).get(row.id) ?? [];
  return hasSellable(list) ? normalizeDbProduct(row, list) : null;
};

/** 팔 수 있는 DB SKU — 공개 상품 + 잠김 + retired 아님. 없으면 null. */
export const findDbSellableSku = async (skuId: string): Promise<ResolvedSku | null> => {
  const rows = await getDb()
    .select({ sku: shopProductSkus, product: shopProducts })
    .from(shopProductSkus)
    .innerJoin(shopProducts, eq(shopProducts.id, shopProductSkus.productId))
    .where(and(eq(shopProductSkus.id, skuId), isNotNull(shopProductSkus.lockedAt), eq(shopProductSkus.retired, false), publicProductWhere))
    .limit(1);
  const hit = rows[0];
  if (!hit) return null;
  const list = (await loadLockedSkus([hit.product.id])).get(hit.product.id) ?? [hit.sku];
  const product = normalizeDbProduct(hit.product, list);
  const sku = product.skus.find((s) => s.id === hit.sku.id);
  return sku ? { product, sku } : null;
};

/** 관리자 재고 표용 — 공개 여부와 무관하게 **잠긴** SKU 전부(재고는 잠긴 SKU만 정한다). */
export const listDbSkusForAdmin = async (): Promise<Array<{ product: ShopProduct; sku: ShopSku }>> => {
  const rows = await getDb()
    .select({ sku: shopProductSkus, product: shopProducts })
    .from(shopProductSkus)
    .innerJoin(shopProducts, eq(shopProducts.id, shopProductSkus.productId))
    .where(isNotNull(shopProductSkus.lockedAt))
    .orderBy(asc(shopProducts.slug), asc(shopProductSkus.sortOrder), asc(shopProductSkus.id));
  return rows.map(({ sku, product }) => ({ product: normalizeDbProduct(product, [sku]), sku: toShopSku(sku) }));
};
