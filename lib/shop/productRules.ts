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

/** 아티스트가 고칠 수 있는 칸의 이름. `skus`는 SKU 추가·판매 종료(승인 뒤)와 가격·옵션명·삭제(잠기기 전)를 모두 뜻한다. */
export type ShopProductEditableField =
  | 'title' | 'subtitle' | 'description' | 'images' | 'category' | 'kind' | 'slug' | 'shipsOn' | 'editionSize' | 'skus' | 'published';

/**
 * 심사 상태 × 아티스트가 고칠 수 있는 칸 — 서버(`creatorProductWrite.ts`)와 화면이 이 표 하나를 쓴다.
 * 승인 뒤에는 제목·slug·분류·kind·한정 수량이 잠기고, 예약 발송일은 관리자만 바꾼다(`set_ships_on`).
 * 잠긴 SKU(승인 때 잠긴다)는 `skus`가 열려 있어도 id·가격·옵션명을 못 바꾸고 판매 종료(retired)만 바뀐다.
 */
export const SHOP_PRODUCT_EDITABLE: Record<ShopReviewStatus, readonly ShopProductEditableField[]> = {
  draft: ['title', 'subtitle', 'description', 'images', 'category', 'kind', 'slug', 'shipsOn', 'editionSize', 'skus'],
  submitted: [],
  changes_requested: ['title', 'subtitle', 'description', 'images', 'category', 'kind', 'slug', 'shipsOn', 'editionSize', 'skus'],
  approved: ['subtitle', 'description', 'images', 'skus', 'published'],
  rejected: [],
};

export const canCreatorEditShopField = (status: ShopReviewStatus, field: ShopProductEditableField): boolean =>
  SHOP_PRODUCT_EDITABLE[status]?.includes(field) ?? false;

/** 폼이 열려 있는가 — 한 칸이라도 고칠 수 있으면 true. */
export const canCreatorEditShopProduct = (status: ShopReviewStatus): boolean =>
  (SHOP_PRODUCT_EDITABLE[status]?.length ?? 0) > 0;

/** 제목·부제·본문·사진·SKU 상한과 가격 규칙. 화면과 서버가 같은 값을 쓴다. */
export const SHOP_CREATOR_LIMITS = {
  titleMax: 80,
  subtitleMax: 120,
  descriptionMax: 4000,
  optionLabelMax: 40,
  slugMin: 3,
  slugMax: 60,
  imagesMax: 8,
  skusMax: 12,
  priceMin: 1_000,
  priceMax: 1_000_000,
  priceStep: 10,
  editionSizeMax: 10_000,
  /** 미심사(작성 중·심사 대기·보완 요청) 상품 상한 — 계정당. */
  draftsMax: 10,
  /** 디지털 파일 라벨·개수(관리자). */
  digitalFilesMax: 20,
  digitalLabelMax: 60,
} as const;

/** 초안의 임시 slug 접두사 — 실제 주소로 쓸 수 없다. */
export const DRAFT_SLUG_PREFIX = 'draft-';
export const isDraftPlaceholderSlug = (slug: string): boolean => slug.startsWith(DRAFT_SLUG_PREFIX);

/** 새 SKU id — 서버가 만든다(`db-` + 소문자 hex 10자). */
export const DB_SKU_ID_PATTERN = /^db-[0-9a-f]{10}$/;

export const SHOP_STATUS_LABELS: Record<ShopReviewStatus, string> = {
  draft: '작성 중',
  submitted: '심사 대기',
  changes_requested: '보완 요청',
  approved: '승인',
  rejected: '반려',
};
