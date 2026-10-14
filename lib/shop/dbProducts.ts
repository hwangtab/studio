import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { shopProducts, shopProductSkus, type ShopProductRow, type ShopProductSkuRow } from '../../db/schema';
import type { ShopProduct, ShopSku } from '../../data/shop/catalog';
import type { ResolvedSku } from './catalog';
import { loadShippedByArtistSlugs } from './fulfillmentMode';
import { parseDigitalFiles, previewDigitalFiles, salesDigitalFiles } from './adminProducts';

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

const hasFiles = (raw: string | null): boolean => salesDigitalFiles(parseDigitalFiles(raw)).length > 0;

/** 미리듣기 파일의 라벨만 — R2 키는 싣지 않는다. 순번은 이 목록의 순서다(`/api/shop/preview?i=`). */
const previewLabels = (row: ShopProductRow): string[] =>
  row.kind === 'digital' ? previewDigitalFiles(parseDigitalFiles(row.digitalFiles)).map((f) => f.label) : [];

export const toShopSku = (row: ShopProductSkuRow): ShopSku => ({
  id: row.id,
  ...(row.optionLabel ? { optionLabel: row.optionLabel } : {}),
  price: row.price,
  ...(row.retired ? { retired: true } : {}),
});

/** DB 행 → ShopProduct. `skus`는 호출부가 정한 것(공개는 잠긴 SKU만)을 받는다. */
export const normalizeDbProduct = (row: ShopProductRow, skus: readonly ShopProductSkuRow[], shippedByArtist?: string): ShopProduct => ({
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
  ...(previewLabels(row).length > 0 ? { previews: previewLabels(row) } : {}),
  source: 'db',
  ...(shippedByArtist ? { shippedByArtist } : {}),
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

/** 팔 수 있는 상품만 골라 정규화한다. 발송 주체(아티스트 직접 발송)는 표가 없는 DB에서는 비어 있다(= 스튜디오 발송). */
const toPublicProducts = async (rows: ShopProductRow[]): Promise<ShopProduct[]> => {
  const skus = await loadLockedSkus(rows.map((r) => r.id));
  const sellable = rows.filter((r) => hasSellable(skus.get(r.id) ?? []));
  const shippers = await loadShippedByArtistSlugs(sellable.map((r) => r.id));
  return sellable.map((r) => normalizeDbProduct(r, skus.get(r.id) ?? [], shippers.get(r.id)));
};

export const listDbPublishedProducts = async (): Promise<ShopProduct[]> => {
  const rows = await getDb().select().from(shopProducts).where(publicProductWhere).orderBy(asc(shopProducts.approvedAt), asc(shopProducts.slug));
  return toPublicProducts(rows);
};

/** 그 아티스트(creator)의 공개 DB 상품. */
export const listDbPublishedProductsByCreator = async (creatorId: string): Promise<ShopProduct[]> => {
  const rows = await getDb().select().from(shopProducts)
    .where(and(publicProductWhere, eq(shopProducts.creatorId, creatorId)))
    .orderBy(asc(shopProducts.approvedAt), asc(shopProducts.slug));
  return toPublicProducts(rows);
};

export const findDbProductBySlug = async (slug: string): Promise<ShopProduct | null> => {
  const rows = await getDb().select().from(shopProducts).where(and(publicProductWhere, eq(shopProducts.slug, slug))).limit(1);
  const row = rows[0];
  if (!row) return null;
  const [product] = await toPublicProducts([row]);
  return product ?? null;
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
  const shipper = (await loadShippedByArtistSlugs([hit.product.id])).get(hit.product.id);
  const product = normalizeDbProduct(hit.product, list, shipper);
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

/** SKU id → 그 상품의 예약 발송일(`ships_on`). 값이 있는 SKU만. 주문 화면·메일이 상품의 현재 값을 읽는다(스냅샷 없음). */
export const loadDbShipsOnBySku = async (skuIds: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (skuIds.length === 0) return out;
  const rows = await getDb().all<{ id: string; ships_on: string }>(sql`
    SELECT k.id AS id, p.ships_on AS ships_on
    FROM shop_product_skus k JOIN shop_products p ON p.id = k.product_id
    WHERE k.id IN (${sql.join(skuIds.map((id) => sql`${id}`), sql`, `)}) AND p.ships_on IS NOT NULL
  `);
  for (const r of rows) out.set(r.id, r.ships_on);
  return out;
};

/**
 * 미리듣기 파일의 R2 키 — 공개·승인된 **디지털** 상품의 미리듣기 `index`번째(0부터). 없으면 null.
 * 판매 파일은 이 경로로 닿지 않는다(`preview: true` 항목만 센다). 키는 서버 안에서만 쓴다.
 */
export const findDbPreviewKey = async (slug: string, index: number): Promise<string | null> => {
  if (!Number.isInteger(index) || index < 0) return null;
  const rows = await getDb().select().from(shopProducts).where(and(publicProductWhere, eq(shopProducts.slug, slug), eq(shopProducts.kind, 'digital'))).limit(1);
  const row = rows[0];
  if (!row) return null;
  return previewDigitalFiles(parseDigitalFiles(row.digitalFiles))[index]?.key ?? null;
};
