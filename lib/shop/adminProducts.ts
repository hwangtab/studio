import { desc, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus } from '../../db/schema';
import { SHOP_PRODUCTS } from '../../data/shop/catalog';
import type { ShopReviewStatus } from './productRules';

/** 관리자 상품 심사 읽기 — 내부 메모·내려받기 키까지 읽는다. 아티스트 경로(`creatorProductWrite.ts`)는 이 칸들을 읽지 않는다. */

export interface ShopDigitalFile {
  label: string;
  key: string;
  /** true면 상품 화면의 미리듣기 파일이다 — 구매자 내려받기 목록에는 들어가지 않는다(전자상거래법 제17조 제6항의 시험 사용 상품). */
  preview?: true;
}

export interface AdminShopSku {
  id: string;
  optionLabel: string | null;
  price: number;
  retired: boolean;
  locked: boolean;
  /** `shop_skus` 총 재고. 행이 없으면 null(아직 안 넣음). */
  stock: number | null;
}

export interface AdminShopProductDetail {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  /** 상점 등재 slug(`/ko/shop/artist/<slug>`). 등재가 없으면 null. */
  artistSlug: string | null;
  slug: string;
  category: 'album' | 'goods';
  kind: 'physical' | 'digital';
  title: string;
  subtitle: string | null;
  description: string;
  images: string[];
  shipsOn: string | null;
  editionSize: number | null;
  digitalFiles: ShopDigitalFile[];
  reviewStatus: ShopReviewStatus;
  published: boolean;
  reviewNote: string | null;
  internalNote: string | null;
  submittedAt: number | null;
  approvedAt: number | null;
  creatorEditedAt: number | null;
  updatedAt: number;
  skus: AdminShopSku[];
  /** 파일 상품(`data/shop/catalog.ts`)이 이 slug를 이미 쓴다 — 파일이 이겨 이 상품은 열리지 않는다. */
  shadowedByFileSlug: boolean;
}

export interface AdminShopProductSummary {
  id: string;
  title: string;
  slug: string;
  reviewStatus: ShopReviewStatus;
  published: boolean;
  creatorName: string;
  submittedAt: number | null;
  creatorEditedAt: number | null;
  updatedAt: number;
  shadowedByFileSlug: boolean;
  unlockedSkuCount: number;
}

const parseImages = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
  } catch {
    return [];
  }
};

export const parseDigitalFiles = (raw: string | null): ShopDigitalFile[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v) => {
      if (typeof v !== 'object' || v === null) return [];
      const { label, key, preview } = v as Record<string, unknown>;
      return typeof label === 'string' && typeof key === 'string' ? [{ label, key, ...(preview === true ? { preview: true as const } : {}) }] : [];
    });
  } catch {
    return [];
  }
};

/** 판매 파일(구매자가 내려받는 것)과 미리듣기 파일을 가른다. */
export const salesDigitalFiles = (files: readonly ShopDigitalFile[]): ShopDigitalFile[] => files.filter((f) => !f.preview);
export const previewDigitalFiles = (files: readonly ShopDigitalFile[]): ShopDigitalFile[] => files.filter((f) => f.preview === true);

const fileSlugs = (): Set<string> => new Set(SHOP_PRODUCTS.map((p) => p.slug));

export const loadShopProductForAdmin = async (productId: string): Promise<AdminShopProductDetail | null> => {
  const db = getDb();
  const [row] = await db.select().from(shopProducts).where(eq(shopProducts.id, productId)).limit(1);
  if (!row) return null;
  const [creator] = await db.select({ name: fundingCreators.name, email: fundingCreators.email })
    .from(fundingCreators).where(eq(fundingCreators.id, row.creatorId)).limit(1);
  const [artist] = await db.select({ slug: shopArtists.slug }).from(shopArtists).where(eq(shopArtists.creatorId, row.creatorId)).limit(1);
  const skus = await db.select().from(shopProductSkus).where(eq(shopProductSkus.productId, productId));
  const stockRows = skus.length === 0
    ? []
    : await db.all<{ id: string; stock: number }>(
      sql`SELECT k.id AS id, k.stock AS stock FROM shop_skus k JOIN shop_product_skus s ON s.id = k.id WHERE s.product_id = ${productId}`,
    );
  const stockById = new Map(stockRows.map((r) => [r.id, Number(r.stock)]));
  return {
    id: row.id,
    creatorId: row.creatorId,
    creatorName: creator?.name ?? '',
    creatorEmail: creator?.email ?? '',
    artistSlug: artist?.slug ?? null,
    slug: row.slug,
    category: row.category,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    images: parseImages(row.images),
    shipsOn: row.shipsOn,
    editionSize: row.editionSize,
    digitalFiles: parseDigitalFiles(row.digitalFiles),
    reviewStatus: row.reviewStatus,
    published: row.published,
    reviewNote: row.reviewNote,
    internalNote: row.internalNote,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    creatorEditedAt: row.creatorEditedAt,
    updatedAt: row.updatedAt,
    skus: [...skus].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map((s) => ({
      id: s.id, optionLabel: s.optionLabel, price: s.price, retired: s.retired, locked: s.lockedAt !== null, stock: stockById.get(s.id) ?? null,
    })),
    shadowedByFileSlug: fileSlugs().has(row.slug),
  };
};

const STATUS_PRIORITY: Record<ShopReviewStatus, number> = {
  submitted: 0, changes_requested: 1, approved: 2, draft: 3, rejected: 4,
};

/** 심사 대기열 — 제출된 것이 먼저, 그다음 승인 뒤 수정·새 옵션 승인 대기가 있는 것. */
export const listShopProductsForAdmin = async (): Promise<AdminShopProductSummary[]> => {
  const db = getDb();
  const rows = await db
    .select({
      id: shopProducts.id, title: shopProducts.title, slug: shopProducts.slug, reviewStatus: shopProducts.reviewStatus,
      published: shopProducts.published, creatorName: fundingCreators.name, submittedAt: shopProducts.submittedAt,
      creatorEditedAt: shopProducts.creatorEditedAt, updatedAt: shopProducts.updatedAt,
    })
    .from(shopProducts)
    .innerJoin(fundingCreators, eq(fundingCreators.id, shopProducts.creatorId))
    .orderBy(desc(shopProducts.updatedAt));
  const unlocked = await db.all<{ product_id: string; n: number }>(
    sql`SELECT product_id, COUNT(*) AS n FROM shop_product_skus WHERE locked_at IS NULL GROUP BY product_id`,
  );
  const unlockedById = new Map(unlocked.map((r) => [r.product_id, Number(r.n)]));
  const taken = fileSlugs();
  return rows
    .map((r) => ({ ...r, shadowedByFileSlug: taken.has(r.slug), unlockedSkuCount: unlockedById.get(r.id) ?? 0 }))
    .sort((a, b) => {
      const pending = (x: AdminShopProductSummary) => (x.reviewStatus === 'approved' && x.unlockedSkuCount > 0 ? -1 : STATUS_PRIORITY[x.reviewStatus]);
      return pending(a) - pending(b) || b.updatedAt - a.updatedAt;
    });
};

/** 심사 대기 건수(관리자 상점 화면의 링크 옆 숫자). 표가 없거나 조회가 실패하면 null — 화면이 숫자 없이 링크만 보인다. */
export const countPendingShopProducts = async (): Promise<number | null> => {
  try {
    const [row] = await getDb().all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM shop_products WHERE review_status = 'submitted'`);
    return Number(row?.n ?? 0);
  } catch (error: unknown) {
    console.error('[shop] 심사 대기 건수 조회 실패:', error);
    return null;
  }
};
