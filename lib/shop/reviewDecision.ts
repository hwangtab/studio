import { and, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { shopProducts } from '../../db/schema';
import { SHOP_PRODUCTS } from '../../data/shop/catalog';
import { isSafeObjectKey } from '../funding/objectKey';
import { fundingDownloadObjectExists } from '../funding/r2';
import { isUniqueConflictError } from '../funding/slugOccupancy';
import { nextReviewStatus, type ReviewAction } from '../funding/reviewTransition';
import { isDefaultCreatorName } from '../funding/creatorValidation';
import { loadProductFulfillmentMode, setProductFulfillmentMode, type ShopFulfillmentMode } from './fulfillmentMode';
import { loadShopProductForAdmin, parseDigitalFiles, previewDigitalFiles, salesDigitalFiles, type ShopDigitalFile } from './adminProducts';
import { findMissingShopProductFields, isValidDateOnly, shopSlugRejection } from './creatorValidation';
import { SHOP_CREATOR_LIMITS } from './productRules';

/**
 * 상품 심사 판정과 관리자 액션 — `lib/funding/reviewDecision.ts`를 본떴다(전이는 `nextReviewStatus`가 정본).
 *
 * **승인은 한 묶음이다: slug 확정 · SKU `locked_at` · 승인 상태.** 상품 UPDATE와 SKU 잠금 UPDATE를 `db.batch`에 넣고,
 * SKU 잠금의 WHERE에 `EXISTS(p.review_status='approved' AND p.updated_at = <이 배치의 epoch>)`를 건다 — "승인 상태인가"만 보면
 * 다른 운영자가 먼저 승인해 둔 경우에도 참이라, 이 호출은 conflict를 돌려주면서 실제로는 SKU를 잠그고 커밋한다.
 * epoch까지 요구하면 "이 호출이 방금 승인으로 만든 바로 그 행"만 통과한다. 시각 칸은 전부 초 단위 정수다.
 */

export type ShopDecisionAction = Extract<ReviewAction, 'approve' | 'request_changes' | 'reject'>;

export type ShopDecisionCode =
  | 'not_found' | 'conflict' | 'invalid_slug' | 'duplicate_slug' | 'incomplete' | 'no_artist' | 'no_files' | 'digital_edition' | 'digital_shipper';

export type ShopDecisionResult =
  | { ok: true; slug: string; warnings?: string[] }
  | { ok: false; code: ShopDecisionCode; message: string };

const deny = (code: ShopDecisionCode, message: string): { ok: false; code: ShopDecisionCode; message: string } => ({ ok: false, code, message });

const STALE = '그 사이 아티스트가 수정해 다시 제출했어요. 새로고침해 새 판본을 확인해 주세요.';
const CHANGED = '그 사이 상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.';
const SKUS_CHANGED = '그사이 옵션이 바뀌었어요. 새로고침해 확인해 주세요.';

const NOTE_REQUIRED: Record<'request_changes' | 'reject', string> = {
  request_changes: '보완 요청에는 안내 메모가 필요해요.',
  reject: '반려에는 사유 메모가 필요해요.',
};

export const decideShopProduct = async (
  productId: string,
  action: ShopDecisionAction,
  /** `expectedUpdatedAt`: 관리자 화면이 연 판본(updated_at 초). 주면 그 판본일 때만 판정한다(바로 승인 경로). */
  input: { note?: string; slug?: string; expectedSubmittedAt?: number | null; expectedUpdatedAt?: number },
  now: Date = new Date(),
): Promise<ShopDecisionResult> => {
  const product = await loadShopProductForAdmin(productId);
  if (!product) return deny('not_found', '상품을 찾을 수 없어요.');

  // 운영자가 본 판본이 지금 판본인가 — 화면을 연 뒤 철회 → 수정 → 재제출하면 상태는 다시 submitted라 상태만으로는 못 본 판본이 승인된다.
  const versionCondition = input.expectedSubmittedAt === undefined
    ? undefined
    : input.expectedSubmittedAt === null
      ? sql`${shopProducts.submittedAt} IS NULL`
      : eq(shopProducts.submittedAt, input.expectedSubmittedAt);
  if (input.expectedSubmittedAt !== undefined && (product.submittedAt ?? null) !== input.expectedSubmittedAt) {
    return deny('conflict', STALE);
  }
  if (input.expectedUpdatedAt !== undefined && product.updatedAt !== input.expectedUpdatedAt) return deny('conflict', STALE);
  const updatedCondition = input.expectedUpdatedAt === undefined ? undefined : eq(shopProducts.updatedAt, input.expectedUpdatedAt);

  const next = nextReviewStatus(product.reviewStatus, action);
  if (!next) return deny('conflict', '지금 상태에서는 그 판정을 할 수 없어요.');

  const note = input.note?.trim() || null;
  if ((action === 'request_changes' || action === 'reject') && !note) return deny('incomplete', NOTE_REQUIRED[action]);

  const db = getDb();
  const epoch = Math.floor(now.getTime() / 1000);

  if (action !== 'approve') {
    const result = await db.update(shopProducts)
      .set({ reviewStatus: next, reviewNote: note, ...(action === 'reject' ? { rejectedAt: epoch } : {}), updatedAt: epoch })
      .where(and(eq(shopProducts.id, productId), eq(shopProducts.reviewStatus, product.reviewStatus), versionCondition, updatedCondition));
    if (Number(result.rowsAffected) === 0) return deny('conflict', CHANGED);
    return { ok: true, slug: product.slug };
  }

  // --- 승인 경로 ---
  const slug = (input.slug?.trim() || product.slug).toLowerCase();
  const slugProblem = shopSlugRejection(slug);
  if (slugProblem) return deny('invalid_slug', slugProblem);
  // 파일이 이긴다(repository.ts) — 같은 slug로 승인하면 이 상품은 어떤 주소로도 열리지 않는다.
  if (SHOP_PRODUCTS.some((p) => p.slug === slug)) {
    return deny('duplicate_slug', '이미 사이트가 쓰고 있는 주소라 사용할 수 없어요. 다른 주소를 적어 주세요.');
  }
  const [taken] = await db.select({ id: shopProducts.id }).from(shopProducts)
    .where(and(eq(shopProducts.slug, slug), ne(shopProducts.id, productId), ne(shopProducts.reviewStatus, 'rejected'))).limit(1);
  if (taken) return deny('duplicate_slug', '이미 쓰이고 있는 주소예요. 다른 주소를 적어 주세요.');

  const missing = findMissingShopProductFields(
    {
      title: product.title, slug, description: product.description, images: product.images, skus: product.skus,
      creatorName: product.creatorName, creatorEmail: product.creatorEmail,
    },
    !isDefaultCreatorName(product.creatorName, product.creatorEmail) && product.creatorName.trim() !== '',
  );
  if (missing.length > 0) return deny('incomplete', `다음 항목이 비어 있어 승인할 수 없어요: ${missing.join(', ')}`);

  if (!product.artistSlug) {
    return deny('no_artist', '상점 아티스트로 등재되지 않은 계정이에요. /admin/shop/artists에서 먼저 등재해 주세요.');
  }
  if (product.kind === 'digital' && product.editionSize !== null) {
    return deny('digital_edition', '한정 번호는 실물 상품에만 붙일 수 있어요. 한정 수량을 비워 달라고 요청해 주세요.');
  }
  // 디지털 상품에는 발송이 없다 — 옛 상태로 아티스트 발송 행이 남아 있으면 승인하지 않는다(받는 분 정보 제공·배송비 정산이 따라 붙는다).
  if (product.kind === 'digital' && (await loadProductFulfillmentMode(productId)).mode === 'artist') {
    return deny('digital_shipper', '디지털 상품인데 발송 주체가 아티스트로 정해져 있어요. 운영 칸에서 발송 주체를 스튜디오로 바꾼 뒤 승인해 주세요.');
  }
  if (product.kind === 'digital' && salesDigitalFiles(product.digitalFiles).length === 0) {
    return deny('no_files', '디지털 상품은 내려받기 파일을 등록한 뒤에 승인할 수 있어요.');
  }
  // 내려받기를 시작하면 청약철회가 제한되므로(전자상거래법 제17조 제2항 제5호) 시험 사용 상품(미리듣기)을 먼저 제공해야 한다(같은 조 제6항).
  if (product.kind === 'digital' && previewDigitalFiles(product.digitalFiles).length === 0) {
    return deny('no_files', '디지털 상품은 상품 화면에서 먼저 들어 볼 수 있는 미리듣기 파일을 등록한 뒤에 승인할 수 있어요. (30초~1분 발췌본을 저장소에 올리고 "미리듣기 파일" 칸에 넣어 주세요.)');
  }

  let batch;
  try {
    batch = await db.batch([
      db.update(shopProducts)
        .set({
          reviewStatus: next, slug, approvedAt: epoch, published: true,
          reviewNote: input.note !== undefined ? note : product.reviewNote,
          updatedAt: epoch,
        })
        .where(and(eq(shopProducts.id, productId), eq(shopProducts.reviewStatus, product.reviewStatus), versionCondition, updatedCondition)),
      db.run(sql`
        UPDATE shop_product_skus SET locked_at = ${epoch}, updated_at = unixepoch()
        WHERE product_id = ${productId} AND locked_at IS NULL
          AND EXISTS (
            SELECT 1 FROM shop_products p
            WHERE p.id = shop_product_skus.product_id AND p.review_status = 'approved' AND p.updated_at = ${epoch}
          )
      `),
    ]);
  } catch (error: unknown) {
    if (isUniqueConflictError(error, 'shop_products.slug')) {
      return deny('duplicate_slug', '그 사이 다른 상품이 같은 주소로 승인됐어요. 다른 주소를 적어 주세요.');
    }
    throw error;
  }
  if (Number(batch[0].rowsAffected) === 0) return deny('conflict', CHANGED);
  return { ok: true, slug };
};

// ─── 관리자 액션 ────────────────────────────────────────────────────────────────

/** 관리자 화면이 본 미잠금 옵션 한 줄 — "새 옵션 승인"은 이 목록과 지금 DB가 같을 때만 잠근다. */
export interface ShopSeenSku { id: string; price: number; optionLabel: string | null }

export type ShopAdminAction =
  | { type: 'lock_new_skus'; skus: ShopSeenSku[] }
  | { type: 'set_ships_on'; shipsOn: string | null }
  | { type: 'set_published'; published: boolean }
  | { type: 'set_internal_note'; note: string }
  | { type: 'set_digital_files'; files: ShopDigitalFile[] }
  | { type: 'set_fulfillment_mode'; mode: ShopFulfillmentMode };

export type ShopAdminCode = 'not_found' | 'invalid' | 'conflict' | 'incomplete' | 'storage_unavailable';
export type ShopAdminResult =
  | { ok: true; slug: string; locked?: number }
  | { ok: false; code: ShopAdminCode; message: string };

const adminDeny = (code: ShopAdminCode, message: string): { ok: false; code: ShopAdminCode; message: string } => ({ ok: false, code, message });

export const DIGITAL_KEY_PREFIX = 'shop/';

export const applyShopAdminAction = async (
  productId: string,
  action: ShopAdminAction,
  now: Date = new Date(),
): Promise<ShopAdminResult> => {
  const product = await loadShopProductForAdmin(productId);
  if (!product) return adminDeny('not_found', '상품을 찾을 수 없어요.');
  const db = getDb();
  const epoch = Math.floor(now.getTime() / 1000);

  switch (action.type) {
    case 'lock_new_skus': {
      if (product.reviewStatus !== 'approved') return adminDeny('conflict', '승인된 상품의 새 옵션만 승인할 수 있어요.');
      const unlocked = product.skus.filter((s) => !s.locked);
      if (unlocked.length === 0) return adminDeny('conflict', '승인할 새 옵션이 없어요.');
      const sellable = product.skus.filter((s) => !s.retired);
      if (sellable.length > 1 && sellable.some((s) => !s.optionLabel?.trim())) {
        return adminDeny('incomplete', '옵션이 여럿이면 모두 이름이 있어야 해요. 아티스트에게 보완을 요청해 주세요.');
      }
      // 운영자가 화면에서 본 옵션만 잠근다 — 그 사이 아티스트가 옵션을 더하거나 가격·이름을 고쳤으면 보지 않은 판본이 팔리기 시작한다.
      const seen = action.skus;
      const label = (v: string | null | undefined) => v ?? null;
      const sameSet = seen.length === unlocked.length && new Set(seen.map((s) => s.id)).size === seen.length
        && unlocked.every((u) => seen.some((s) => s.id === u.id && s.price === u.price && label(s.optionLabel) === label(u.optionLabel)));
      if (!sameSet) return adminDeny('conflict', SKUS_CHANGED);
      // 읽은 뒤의 경합도 문장 하나로 막는다: 잠글 행은 본 값과 같은 행뿐이고, 미잠금 옵션 전체가 본 목록과 정확히 같을 때만 잠근다.
      // 두 하위 조회는 바깥 행을 참조하지 않아(비상관) 갱신 전 상태로 한 번 계산된다.
      const match = (alias: string) => sql.join(
        seen.map((s) => sql`(${sql.raw(alias)}.id = ${s.id} AND ${sql.raw(alias)}.price = ${s.price} AND ${sql.raw(alias)}.option_label IS ${label(s.optionLabel)})`),
        sql` OR `,
      );
      const result = await db.run(sql`
        UPDATE shop_product_skus SET locked_at = ${epoch}, updated_at = ${epoch}
        WHERE product_id = ${productId} AND locked_at IS NULL AND (${match('shop_product_skus')})
          AND EXISTS (SELECT 1 FROM shop_products p WHERE p.id = ${productId} AND p.review_status = 'approved')
          AND NOT EXISTS (SELECT 1 FROM shop_product_skus x WHERE x.product_id = ${productId} AND x.locked_at IS NULL AND NOT (${match('x')}))
          AND (SELECT COUNT(*) FROM shop_product_skus x WHERE x.product_id = ${productId} AND x.locked_at IS NULL AND (${match('x')})) = ${seen.length}
      `);
      if (Number(result.rowsAffected) === 0) return adminDeny('conflict', SKUS_CHANGED);
      return { ok: true, slug: product.slug, locked: Number(result.rowsAffected) };
    }
    case 'set_ships_on': {
      if (action.shipsOn !== null && !isValidDateOnly(action.shipsOn)) return adminDeny('invalid', '발송 예정일을 날짜로 적어 주세요.');
      await db.update(shopProducts).set({ shipsOn: action.shipsOn, updatedAt: epoch }).where(eq(shopProducts.id, productId));
      return { ok: true, slug: product.slug };
    }
    case 'set_published': {
      if (product.reviewStatus !== 'approved') return adminDeny('conflict', '승인된 상품만 공개 여부를 바꿀 수 있어요.');
      if (action.published && !product.skus.some((s) => s.locked && !s.retired)) {
        return adminDeny('incomplete', '판매 중인 옵션이 없어요. 새 옵션을 먼저 승인해 주세요.');
      }
      const result = await db.update(shopProducts).set({ published: action.published, updatedAt: epoch })
        .where(and(eq(shopProducts.id, productId), eq(shopProducts.reviewStatus, 'approved')));
      if (Number(result.rowsAffected) === 0) return adminDeny('conflict', CHANGED);
      return { ok: true, slug: product.slug };
    }
    case 'set_internal_note': {
      if (action.note.length > 2000) return adminDeny('invalid', '내부 메모는 2,000자 이내로 적어 주세요.');
      // updated_at을 건드리지 않는다 — 메모만 달아도 "수정됨"으로 보이는 것을 막는다(승인 배치의 epoch 증거도 이 값이다).
      await db.update(shopProducts).set({ internalNote: action.note.trim() || null }).where(eq(shopProducts.id, productId));
      return { ok: true, slug: product.slug };
    }
    case 'set_digital_files': {
      const files = action.files;
      if (files.length > SHOP_CREATOR_LIMITS.digitalFilesMax) return adminDeny('invalid', `파일은 최대 ${SHOP_CREATOR_LIMITS.digitalFilesMax}개까지예요.`);
      if (product.kind === 'digital' && product.reviewStatus === 'approved') {
        if (salesDigitalFiles(files).length === 0) return adminDeny('conflict', '승인된 디지털 상품의 파일은 비울 수 없어요.');
        if (previewDigitalFiles(files).length === 0) return adminDeny('conflict', '승인된 디지털 상품의 미리듣기 파일은 비울 수 없어요.');
      }
      const seen = new Set<string>();
      for (const f of files) {
        const label = f.label.trim();
        if (!label || label.length > SHOP_CREATOR_LIMITS.digitalLabelMax) return adminDeny('invalid', `파일 이름은 1~${SHOP_CREATOR_LIMITS.digitalLabelMax}자로 적어 주세요.`);
        if (!isSafeObjectKey(f.key) || !f.key.startsWith(DIGITAL_KEY_PREFIX)) {
          return adminDeny('invalid', `파일 키는 ${DIGITAL_KEY_PREFIX}로 시작하는 저장소 경로여야 해요: ${f.key}`);
        }
        if (seen.has(f.key)) {
          return adminDeny('invalid', `같은 파일이 두 번 들어 있어요: ${f.key} (미리듣기는 판매 파일과 다른 발췌본이어야 해요 — 같은 파일이면 전곡을 무료로 받게 돼요.)`);
        }
        seen.add(f.key);
      }
      // 다른 상품이 쓰는 키(판매·미리듣기 모두)는 받지 않는다 — 남의 판매 파일 키를 미리듣기로 넣으면 그 전곡이 누구에게나 공개된다.
      if (files.length > 0) {
        const others = await db.select({ id: shopProducts.id, title: shopProducts.title, digitalFiles: shopProducts.digitalFiles })
          .from(shopProducts).where(and(ne(shopProducts.id, productId), sql`${shopProducts.digitalFiles} IS NOT NULL`));
        for (const other of others) {
          const taken = parseDigitalFiles(other.digitalFiles).find((o) => seen.has(o.key));
          if (taken) {
            return adminDeny('invalid', `다른 상품("${other.title || other.id}")이 쓰는 파일이에요: ${taken.key} (상품마다 따로 올린 파일만 넣을 수 있어요.)`);
          }
        }
      }
      for (const f of files) {
        let exists: boolean;
        try {
          exists = await fundingDownloadObjectExists(f.key);
        } catch (error: unknown) {
          console.error('[shop/admin] 내려받기 객체 확인 실패:', error);
          return adminDeny('storage_unavailable', '저장소에서 파일을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
        if (!exists) return adminDeny('invalid', `저장소에 없는 파일이에요: ${f.key}`);
      }
      const stored = files.length === 0 ? null : JSON.stringify(files.map((f) => ({ label: f.label.trim(), key: f.key, ...(f.preview ? { preview: true } : {}) })));
      await db.update(shopProducts).set({ digitalFiles: stored, updatedAt: epoch }).where(eq(shopProducts.id, productId));
      return { ok: true, slug: product.slug };
    }
    case 'set_fulfillment_mode': {
      // 승인 전에만 정한다 — 승인된 상품·스튜디오 상품·디지털 상품의 거부는 setProductFulfillmentMode가 판정한다.
      const result = await setProductFulfillmentMode(productId, action.mode, now);
      if (!result.ok) return adminDeny(result.code === 'not_found' ? 'not_found' : result.code === 'invalid' ? 'invalid' : result.code === 'conflict' ? 'conflict' : 'storage_unavailable', result.message);
      return { ok: true, slug: product.slug };
    }
    default: {
      const exhaustive: never = action;
      throw new Error(`처리되지 않은 관리자 액션: ${JSON.stringify(exhaustive)}`);
    }
  }
};
