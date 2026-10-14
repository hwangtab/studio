/**
 * 상점 DB 상품 규칙 — 순수 모듈(클라이언트도 쓴다). import 없음.
 * 설계: docs/shop-artist-platform-design-2026-10.md §2·§4.
 */

/** 심사 상태. `fundingReviewStatusEnum`과 같은 값 집합 — productRules.test.ts가 대조한다. */
export type ShopReviewStatus = 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected';
export const SHOP_REVIEW_STATUSES: readonly ShopReviewStatus[] = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'];

/** DB 상품의 SKU id 접두사. 서버가 만들고, 파일 상품 SKU는 이 접두사를 못 쓴다(두 정본의 SKU 충돌이 구조적으로 불가능). */
export const DB_SKU_PREFIX = 'db-';

/** 이 SKU id가 DB 상품의 것인가 — 새 표에 닿는 문장은 이 판정이 참일 때만 돈다. */
export const isDbSkuId = (skuId: unknown): skuId is string =>
  typeof skuId === 'string' && skuId.startsWith(DB_SKU_PREFIX);

/** 심사 상태 × 아티스트가 고칠 수 있는 칸(PR 3에서 쓴다). */
export type ShopProductEditableField =
  | 'title' | 'subtitle' | 'description' | 'images' | 'category' | 'kind' | 'slug' | 'editionSize' | 'skus' | 'published';

export const SHOP_PRODUCT_EDITABLE: Record<ShopReviewStatus, readonly ShopProductEditableField[]> = {
  draft: ['title', 'subtitle', 'description', 'images', 'category', 'kind', 'slug', 'editionSize', 'skus'],
  submitted: [],
  changes_requested: ['title', 'subtitle', 'description', 'images', 'category', 'kind', 'slug', 'editionSize', 'skus'],
  // 승인 뒤: 제목·slug·분류·kind·edition_size는 잠긴다.
  approved: ['subtitle', 'description', 'images', 'skus', 'published'],
  rejected: [],
};

export const SHOP_CREATOR_LIMITS = {
  titleMax: 80,
  subtitleMax: 120,
  descriptionMax: 4000,
  imagesMax: 8,
  skusMax: 12,
  priceMax: 1_000_000,
  editionSizeMax: 10_000,
} as const;
