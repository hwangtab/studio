import { randomBytes, randomUUID } from 'node:crypto';

import { and, count, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, shopProducts, shopProductSkus, type ShopProductRow, type ShopProductSkuRow } from '../../db/schema';
import { SHOP_PRODUCTS } from '../../data/shop/catalog';
import { isDefaultCreatorName } from '../funding/creatorValidation';
import { isUniqueConflictError } from '../funding/slugOccupancy';
import { nextReviewStatus } from '../funding/reviewTransition';
import { getShopArtistByCreator } from './artists';
import { loadProductFulfillmentMode, type ShopFulfillmentMode } from './fulfillmentMode';
import { findMissingShopProductFields, splitShopDescription, type ShopProductInput } from './creatorValidation';
import {
  canAdminEditShopField, canAdminEditShopProduct, canCreatorEditShopField, canCreatorEditShopProduct, DB_SKU_PREFIX, DRAFT_SLUG_PREFIX, SHOP_CREATOR_LIMITS,
  type ShopReviewStatus,
} from './productRules';

/**
 * 아티스트(개설자)의 상품 쓰기 — `lib/funding/creatorProjectWrite.ts`를 본떴다. 규칙은 `lib/shop/CLAUDE.md`.
 *
 * - **남의 상품은 '없다'(not_found)로 답한다** — 존재 여부를 알려 주지 않는다.
 * - **이 모듈은 `shop_skus`(재고)에 닿지 않는다.** 재고는 관리자만 쓴다(설계 §0-4). 테스트가 이 사실을 고정한다.
 * - 아티스트에게 돌려주는 객체에 `internal_note`·`digital_files`(R2 키)를 싣지 않는다 — 조회가 애초에 그 칸을 읽어
 *   `hasDownloads` 불리언으로만 줄인다.
 * - 시각은 전부 초 단위 정수다(스키마의 plain integer 칸).
 */

export type ProductWriteCode =
  | 'not_found' | 'not_editable' | 'locked' | 'duplicate_slug' | 'too_many' | 'invalid' | 'no_shop' | 'incomplete';

export type ProductWriteResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: ProductWriteCode; message: string };

const deny = (code: ProductWriteCode, message: string): { ok: false; code: ProductWriteCode; message: string } => ({ ok: false, code, message });

const raced = () => deny('not_editable', '그 사이 상품 상태가 바뀌어 저장하지 못했어요. 새로고침 후 다시 확인해 주세요.');

export interface CreatorProductSku {
  id: string;
  optionLabel: string | null;
  price: number;
  retired: boolean;
  /** 승인 때 잠긴 SKU — 가격·옵션명을 못 바꾸고 지울 수 없다(판매 종료만). */
  locked: boolean;
}

export interface CreatorProductDetail {
  id: string;
  slug: string;
  category: 'album' | 'goods';
  kind: 'physical' | 'digital';
  title: string;
  subtitle: string | null;
  description: string;
  images: string[];
  shipsOn: string | null;
  editionSize: number | null;
  reviewStatus: ShopReviewStatus;
  published: boolean;
  /** 운영자가 아티스트에게 보이려고 적은 사유(보완 요청·반려). 내부 메모(`internal_note`)가 아니다. */
  reviewNote: string | null;
  submittedAt: number | null;
  approvedAt: number | null;
  creatorEditedAt: number | null;
  /** 내려받기 파일이 등록돼 있는가(키는 싣지 않는다). */
  hasDownloads: boolean;
  skus: CreatorProductSku[];
  creator: { name: string; email: string };
  /** 발송 주체(읽기 전용 — 운영자가 승인 전에 정한다). 표가 없으면 'studio'. */
  fulfillmentMode: ShopFulfillmentMode;
}

export interface CreatorProductSummary {
  id: string;
  title: string;
  slug: string;
  category: 'album' | 'goods';
  reviewStatus: ShopReviewStatus;
  published: boolean;
  reviewNote: string | null;
  cover: string | null;
  skuCount: number;
  updatedAt: number;
}

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

const kstToday = (now: Date): string => new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

const newSkuId = (): string => `${DB_SKU_PREFIX}${randomBytes(5).toString('hex')}`;

const toSku = (r: ShopProductSkuRow): CreatorProductSku => ({
  id: r.id, optionLabel: r.optionLabel, price: r.price, retired: r.retired, locked: r.lockedAt !== null,
});

const toDetail = (row: ShopProductRow, skus: readonly ShopProductSkuRow[], creator: { name: string; email: string }, fulfillmentMode: ShopFulfillmentMode): CreatorProductDetail => ({
  id: row.id,
  slug: row.slug,
  category: row.category,
  kind: row.kind,
  title: row.title,
  subtitle: row.subtitle,
  description: row.description,
  images: parseImages(row.images),
  shipsOn: row.shipsOn,
  editionSize: row.editionSize,
  reviewStatus: row.reviewStatus,
  published: row.published,
  reviewNote: row.reviewNote,
  submittedAt: row.submittedAt,
  approvedAt: row.approvedAt,
  creatorEditedAt: row.creatorEditedAt,
  hasDownloads: hasFiles(row.digitalFiles),
  skus: [...skus].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map(toSku),
  creator,
  fulfillmentMode,
});

const loadOwnRow = async (creatorId: string, productId: string): Promise<ShopProductRow | null> => {
  const [row] = await getDb().select().from(shopProducts)
    .where(and(eq(shopProducts.id, productId), eq(shopProducts.creatorId, creatorId))).limit(1);
  return row ?? null;
};

/** 남의 상품이면 null — 호출부가 404로 답한다. 내부 메모·파일 키는 담기지 않는다. */
export const loadProductForCreator = async (creatorId: string, productId: string): Promise<CreatorProductDetail | null> => {
  const row = await loadOwnRow(creatorId, productId);
  if (!row) return null;
  const [creator] = await getDb().select({ name: fundingCreators.name, email: fundingCreators.email })
    .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  const skus = await getDb().select().from(shopProductSkus).where(eq(shopProductSkus.productId, productId));
  // 발송 주체는 읽기 전용 표시다 — 못 읽어도 상품 화면은 열려야 한다('studio'로 두고 로그).
  const { mode } = await loadProductFulfillmentMode(productId).catch((error: unknown) => {
    console.error('[shop] 발송 주체 조회 실패 — 스튜디오 발송으로 표시합니다:', error);
    return { mode: 'studio' as const };
  });
  return toDetail(row, skus, creator ?? { name: '', email: '' }, mode);
};

/** 콘솔 목록 — 승인·진행 중인 것이 위. */
export const listProductsForCreator = async (creatorId: string): Promise<CreatorProductSummary[]> => {
  const rows = await getDb().select().from(shopProducts).where(eq(shopProducts.creatorId, creatorId)).orderBy(desc(shopProducts.updatedAt));
  if (rows.length === 0) return [];
  const skuRows = await getDb().select({ productId: shopProductSkus.productId }).from(shopProductSkus)
    .where(inArray(shopProductSkus.productId, rows.map((r) => r.id)));
  const counts = new Map<string, number>();
  for (const s of skuRows) counts.set(s.productId, (counts.get(s.productId) ?? 0) + 1);
  return rows.map((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category, reviewStatus: r.reviewStatus, published: r.published,
    reviewNote: r.reviewNote, cover: parseImages(r.images)[0] ?? null, skuCount: counts.get(r.id) ?? 0, updatedAt: r.updatedAt,
  }));
};

const UNREVIEWED: readonly ShopReviewStatus[] = ['draft', 'submitted', 'changes_requested'];

/**
 * 초안 생성 — `shop_artists` 행이 있는 계정만. 임시 주소(`draft-<uuid>`)로 만든다.
 * 관리자가 대신 만들 때(`admin: true`)는 미심사 상한을 보지 않는다(상한은 아티스트의 남용을 막는 장치다).
 */
export const createDraftProduct = async (creatorId: string, options: { admin?: boolean } = {}): Promise<ProductWriteResult<{ id: string }>> => {
  if (!(await getShopArtistByCreator(creatorId))) return deny('no_shop', '상점이 열린 아티스트만 상품을 만들 수 있어요.');
  if (!options.admin) {
    const [{ value: existing }] = await getDb().select({ value: count() }).from(shopProducts)
      .where(and(eq(shopProducts.creatorId, creatorId), inArray(shopProducts.reviewStatus, [...UNREVIEWED])));
    if (existing >= SHOP_CREATOR_LIMITS.draftsMax) {
      return deny('too_many', '아직 심사되지 않은 상품이 너무 많아요. 심사가 끝난 뒤 새 상품을 만들 수 있어요.');
    }
  }
  const [row] = await getDb().insert(shopProducts).values({
    creatorId, slug: `${DRAFT_SLUG_PREFIX}${randomUUID()}`, category: 'goods', title: '',
  }).returning({ id: shopProducts.id });
  return { ok: true, id: row.id };
};

const sameLabel = (a: string | null, b: string | null): boolean => (a ?? null) === (b ?? null);

/** 파일 상품 slug·다른 살아 있는 DB 상품 slug와 겹치는가. */
const slugTaken = async (slug: string, exceptProductId: string): Promise<boolean> => {
  if (SHOP_PRODUCTS.some((p) => p.slug === slug)) return true;
  const [row] = await getDb().select({ id: shopProducts.id }).from(shopProducts)
    .where(and(eq(shopProducts.slug, slug), ne(shopProducts.id, exceptProductId), ne(shopProducts.reviewStatus, 'rejected'))).limit(1);
  return Boolean(row);
};

/**
 * 저장. 입력은 `validateShopProductInput`을 지난 값이다. 상태별로 열린 칸(`SHOP_PRODUCT_EDITABLE`)만 바뀌고,
 * 닫힌 칸이 저장된 값과 다르면 `locked`로 거부한다(화면은 잠긴 칸의 저장값을 그대로 보낸다).
 * 승인 상태에서 저장하면 `creator_edited_at`을 찍고 `approvedEdit: true`를 돌려준다 — 호출부가 운영자에게 메일을 보낸다.
 */
export const saveProduct = async (
  creatorId: string,
  productId: string,
  value: ShopProductInput,
  now: Date = new Date(),
  options: { admin?: boolean } = {},
): Promise<ProductWriteResult<{ approvedEdit: boolean }>> => {
  // 관리자 저장(`admin: true`)은 `creatorId`에 상품 소유자를 넘긴다. 열린 칸만 `canAdminEditShopField`로 달라지고, SKU 잠금·
  // 제목/주소 잠금(승인 뒤)은 아래 같은 판정을 탄다 — 관리자도 판매 중인 옵션의 가격을 못 바꾼다.
  const admin = options.admin === true;
  const row = await loadOwnRow(creatorId, productId);
  if (!row) return deny('not_found', '상품을 찾을 수 없어요.');
  const status = row.reviewStatus;
  if (!(admin ? canAdminEditShopProduct(status) : canCreatorEditShopProduct(status))) {
    return deny('not_editable', '지금 상태에서는 상품을 고칠 수 없어요.');
  }

  const can = (f: Parameters<typeof canCreatorEditShopField>[1]) => (admin ? canAdminEditShopField(status, f) : canCreatorEditShopField(status, f));
  const storedImages = parseImages(row.images);
  const slugIn = value.slug === '' ? row.slug : value.slug;

  const lockedChecks: Array<[Parameters<typeof canCreatorEditShopField>[1], boolean, string]> = [
    ['title', value.title !== row.title, '제목은 승인된 뒤에는 바꿀 수 없어요.'],
    ['slug', slugIn !== row.slug, '주소는 승인된 뒤에는 바꿀 수 없어요.'],
    ['category', value.category !== row.category, '분류는 승인된 뒤에는 바꿀 수 없어요.'],
    ['kind', value.kind !== row.kind, '종류는 승인된 뒤에는 바꿀 수 없어요.'],
    ['shipsOn', (value.shipsOn ?? null) !== (row.shipsOn ?? null), '발송 예정일은 승인된 뒤에는 운영자만 바꿀 수 있어요.'],
    ['editionSize', (value.editionSize ?? null) !== (row.editionSize ?? null), '한정 수량은 승인된 뒤에는 바꿀 수 없어요.'],
    ['subtitle', (value.subtitle ?? null) !== (row.subtitle ?? null), '지금은 부제를 고칠 수 없어요.'],
    ['description', value.description !== row.description, '지금은 소개를 고칠 수 없어요.'],
    ['images', JSON.stringify(value.images) !== JSON.stringify(storedImages), '지금은 사진을 고칠 수 없어요.'],
  ];
  for (const [field, changed, message] of lockedChecks) {
    if (changed && !can(field)) return deny('locked', message);
  }

  if (can('slug') && slugIn !== row.slug && (await slugTaken(slugIn, productId))) {
    return deny('duplicate_slug', '이미 쓰이고 있는 주소예요. 다른 주소를 적어 주세요.');
  }
  if (can('shipsOn') && value.shipsOn && value.shipsOn !== row.shipsOn && value.shipsOn < kstToday(now)) {
    return deny('invalid', '발송 예정일은 오늘 이후로 적어 주세요.');
  }

  // --- SKU 판정(쓰기 전에 전부 본다) ---
  const existing = await getDb().select().from(shopProductSkus).where(eq(shopProductSkus.productId, productId));
  const byId = new Map(existing.map((s) => [s.id, s]));
  const incomingIds = new Set<string>();
  for (const s of value.skus) {
    if (!s.id) continue;
    const stored = byId.get(s.id);
    if (!stored) return deny('invalid', '옵션 정보가 올바르지 않아요. 새로고침해 주세요.');
    incomingIds.add(s.id);
    if (stored.lockedAt !== null && (stored.price !== s.price || !sameLabel(stored.optionLabel, s.optionLabel))) {
      return deny('locked', '판매 중인 옵션은 가격을 바꿀 수 없어요. 새 옵션을 추가하세요.');
    }
  }
  const removed = existing.filter((s) => !incomingIds.has(s.id));
  if (removed.some((s) => s.lockedAt !== null)) {
    return deny('locked', '판매 중인 옵션은 지울 수 없어요. 판매를 멈추려면 "판매 종료"로 바꿔 주세요.');
  }

  const nowSec = Math.floor(now.getTime() / 1000);
  // 관리자 저장은 "아티스트가 승인 뒤 고쳤다"는 표시도 알림 메일도 만들지 않는다.
  const approvedEdit = status === 'approved' && !admin;

  try {
    const result = await getDb().update(shopProducts).set({
      title: value.title,
      subtitle: value.subtitle,
      description: value.description,
      images: JSON.stringify(value.images),
      category: value.category,
      kind: value.kind,
      slug: slugIn,
      shipsOn: value.shipsOn,
      editionSize: value.editionSize,
      updatedAt: nowSec,
      ...(approvedEdit ? { creatorEditedAt: nowSec } : {}),
    }).where(and(eq(shopProducts.id, productId), eq(shopProducts.creatorId, creatorId), eq(shopProducts.reviewStatus, status)));
    if (Number(result.rowsAffected) === 0) return raced();
  } catch (error: unknown) {
    if (isUniqueConflictError(error, 'shop_products.slug')) {
      return deny('duplicate_slug', '그 사이 다른 상품이 같은 주소를 쓰기 시작했어요. 다른 주소를 적어 주세요.');
    }
    throw error;
  }

  // 잠긴 SKU에는 가격·옵션명 UPDATE가 닿지 않는다 — 읽은 뒤 승인이 잠근 경합도 WHERE locked_at IS NULL이 0행으로 막는다.
  for (const gone of removed) {
    const del = await getDb().delete(shopProductSkus)
      .where(and(eq(shopProductSkus.id, gone.id), eq(shopProductSkus.productId, productId), isNull(shopProductSkus.lockedAt)));
    if (Number(del.rowsAffected) === 0) return raced();
  }
  for (const [index, s] of value.skus.entries()) {
    if (!s.id) {
      await getDb().insert(shopProductSkus).values({
        id: newSkuId(), productId, optionLabel: s.optionLabel, price: s.price, retired: s.retired, sortOrder: index,
      });
      continue;
    }
    const stored = byId.get(s.id)!;
    if (stored.lockedAt !== null) {
      // 잠긴 SKU는 판매 종료 여부와 순서만 바뀐다.
      await getDb().update(shopProductSkus).set({ retired: s.retired, sortOrder: index, updatedAt: nowSec })
        .where(and(eq(shopProductSkus.id, s.id), eq(shopProductSkus.productId, productId), isNotNull(shopProductSkus.lockedAt)));
      continue;
    }
    const upd = await getDb().update(shopProductSkus)
      .set({ optionLabel: s.optionLabel, price: s.price, retired: s.retired, sortOrder: index, updatedAt: nowSec })
      .where(and(eq(shopProductSkus.id, s.id), eq(shopProductSkus.productId, productId), isNull(shopProductSkus.lockedAt)));
    if (Number(upd.rowsAffected) === 0) return raced();
  }
  return { ok: true, approvedEdit };
};

/** 중복 주소가 아니고 필수 항목이 다 찼는가 — 제출 게이트. 비면 null. */
export const checkSubmittable = async (detail: CreatorProductDetail): Promise<string | null> => {
  const missing = findMissingShopProductFields(
    {
      title: detail.title, slug: detail.slug, description: detail.description, images: detail.images,
      skus: detail.skus, creatorName: detail.creator.name, creatorEmail: detail.creator.email,
    },
    !isDefaultCreatorName(detail.creator.name, detail.creator.email) && detail.creator.name.trim() !== '',
  );
  if (missing.length > 0) return `다음 항목을 채워 주세요: ${missing.join(', ')}`;
  if (splitShopDescription(detail.description).length === 0) return '소개를 적어 주세요.';
  if (await slugTaken(detail.slug, detail.id)) return '이미 쓰이고 있는 주소예요. 다른 주소를 적어 주세요.';
  return null;
};

/** 심사 신청. `draft`·`changes_requested` → `submitted`. 낙관적 잠금(reviewStatus)으로 그 사이 판정을 덮지 않는다. */
export const submitProduct = async (
  creatorId: string,
  productId: string,
  now: Date = new Date(),
): Promise<ProductWriteResult<{ product: CreatorProductDetail }>> => {
  const detail = await loadProductForCreator(creatorId, productId);
  if (!detail) return deny('not_found', '상품을 찾을 수 없어요.');
  if (!(await getShopArtistByCreator(creatorId))) return deny('no_shop', '상점이 열린 아티스트만 심사를 신청할 수 있어요.');
  const next = nextReviewStatus(detail.reviewStatus, 'submit');
  if (!next) return deny('not_editable', '지금 상태에서는 심사를 신청할 수 없어요.');
  const problem = await checkSubmittable(detail);
  if (problem) return deny('incomplete', problem);

  const nowSec = Math.floor(now.getTime() / 1000);
  const result = await getDb().update(shopProducts).set({ reviewStatus: next, submittedAt: nowSec, updatedAt: nowSec })
    .where(and(eq(shopProducts.id, productId), eq(shopProducts.creatorId, creatorId), eq(shopProducts.reviewStatus, detail.reviewStatus)));
  if (Number(result.rowsAffected) === 0) return raced();
  return { ok: true, product: { ...detail, reviewStatus: next, submittedAt: nowSec } };
};

/** 심사 신청 철회. `submitted` → `draft`, 제출 시각을 비운다(재제출 때 다시 찍는다). */
export const withdrawProduct = async (creatorId: string, productId: string, now: Date = new Date()): Promise<ProductWriteResult> => {
  const detail = await loadProductForCreator(creatorId, productId);
  if (!detail) return deny('not_found', '상품을 찾을 수 없어요.');
  const next = nextReviewStatus(detail.reviewStatus, 'withdraw');
  if (!next) return deny('not_editable', '지금 상태에서는 철회할 수 없어요.');
  const result = await getDb().update(shopProducts)
    .set({ reviewStatus: next, submittedAt: null, updatedAt: Math.floor(now.getTime() / 1000) })
    .where(and(eq(shopProducts.id, productId), eq(shopProducts.creatorId, creatorId), eq(shopProducts.reviewStatus, detail.reviewStatus)));
  if (Number(result.rowsAffected) === 0) return raced();
  return { ok: true };
};

/** 공개 여부 — 승인된 상품만. 공개하려면 팔 수 있는(잠기고 판매 종료 아닌) 옵션이 하나 이상 있어야 한다. */
export const setPublishedByCreator = async (
  creatorId: string,
  productId: string,
  published: boolean,
  now: Date = new Date(),
): Promise<ProductWriteResult> => {
  const row = await loadOwnRow(creatorId, productId);
  if (!row) return deny('not_found', '상품을 찾을 수 없어요.');
  if (!canCreatorEditShopField(row.reviewStatus, 'published')) return deny('not_editable', '승인된 상품만 공개 여부를 바꿀 수 있어요.');
  if (published) {
    const skus = await getDb().select().from(shopProductSkus).where(eq(shopProductSkus.productId, productId));
    if (!skus.some((s) => s.lockedAt !== null && !s.retired)) {
      return deny('incomplete', '판매 중인 옵션이 없어요. 새 옵션은 운영자가 승인하면 판매가 시작돼요.');
    }
  }
  const result = await getDb().update(shopProducts)
    .set({ published, updatedAt: Math.floor(now.getTime() / 1000) })
    .where(and(eq(shopProducts.id, productId), eq(shopProducts.creatorId, creatorId), eq(shopProducts.reviewStatus, 'approved')));
  if (Number(result.rowsAffected) === 0) return raced();
  return { ok: true };
};
