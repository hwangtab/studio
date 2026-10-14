import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { shopProducts } from '../../db/schema';
import { ensureStudioShopArtist } from './artists';
import {
  createDraftProduct, loadProductForCreator, saveProduct,
  type CreatorProductDetail, type ProductWriteResult,
} from './creatorProductWrite';
import { validateShopProductInput } from './creatorValidation';
import { decideShopProduct, type ShopDecisionResult } from './reviewDecision';

/**
 * 관리자가 관리자 화면에서 상품을 직접 만들고·고치고·승인하는 경로. 아티스트 경로(`creatorProductWrite.ts`)와 같은 쓰기·검증·
 * 잠금 규칙을 탄다 — 관리자라고 승인된 SKU의 가격·옵션명·잠긴 칸을 바꿀 수 있는 것이 아니다. 다른 점은 둘이다:
 * ① 소유자가 아니라 관리자 인증으로 호출한다(소유 계정은 상품이 가진 `creator_id`), ② 열린 칸이 `canAdminEditShopField`다.
 * 재고(`shop_skus`)는 여기서도 건드리지 않는다 — `setSkuStock`이 유일한 경로다.
 */

export type AdminDraftTarget = { studio: true } | { creatorId: string };

/** 초안을 만든다. 스튜디오 상품이면 스튜디오 계정을 먼저 보장한다. 미심사 상한은 관리자에게 적용하지 않는다. */
export const createDraftProductAsAdmin = async (target: AdminDraftTarget): Promise<ProductWriteResult<{ id: string; creatorId: string }>> => {
  const creatorId = 'studio' in target ? (await ensureStudioShopArtist()).creatorId : target.creatorId;
  const result = await createDraftProduct(creatorId, { admin: true });
  return result.ok ? { ok: true, id: result.id, creatorId } : result;
};

/** 입력 검증 + 저장. 소유자는 상품 행에서 읽는다. 돌려주는 객체는 아티스트가 보는 것과 같은 모양(내부 메모·파일 키 없음). */
export const saveProductAsAdmin = async (
  productId: string,
  raw: unknown,
  now: Date = new Date(),
): Promise<ProductWriteResult<{ product: CreatorProductDetail }>> => {
  const [row] = await getDb().select({ creatorId: shopProducts.creatorId }).from(shopProducts).where(eq(shopProducts.id, productId)).limit(1);
  if (!row) return { ok: false, code: 'not_found', message: '상품을 찾을 수 없어요.' };
  const current = await loadProductForCreator(row.creatorId, productId);
  if (!current) return { ok: false, code: 'not_found', message: '상품을 찾을 수 없어요.' };
  const validated = validateShopProductInput(raw, { creatorId: row.creatorId, existing: current.images });
  if (!validated.ok) return { ok: false, code: 'invalid', message: validated.message };
  const saved = await saveProduct(row.creatorId, productId, validated.value, now, { admin: true });
  if (!saved.ok) return saved;
  const product = await loadProductForCreator(row.creatorId, productId);
  if (!product) return { ok: false, code: 'not_found', message: '상품을 찾을 수 없어요.' };
  return { ok: true, product };
};

/**
 * 저장한 그대로 바로 승인한다 — 작성 중·보완 요청 상품을 심사 대기로 올린 뒤 기존 승인 배치(`decideShopProduct`)를 부른다.
 * 거부 조건(주소 충돌·사진/소개/옵션 없음·디지털 파일 없음 등)은 승인과 같다. 거부되면 올려 둔 심사 대기를 되돌려
 * 아티스트 쪽에 "심사 대기"가 남지 않게 한다. 이미 심사 대기인 상품은 그냥 승인한다.
 */
export const approveShopProductNow = async (
  productId: string,
  input: { slug?: string },
  now: Date = new Date(),
): Promise<ShopDecisionResult> => {
  const db = getDb();
  const [row] = await db.select({ status: shopProducts.reviewStatus, submittedAt: shopProducts.submittedAt })
    .from(shopProducts).where(eq(shopProducts.id, productId)).limit(1);
  if (!row) return { ok: false, code: 'not_found', message: '상품을 찾을 수 없어요.' };
  const epoch = Math.floor(now.getTime() / 1000);

  if (row.status === 'submitted') {
    return decideShopProduct(productId, 'approve', { slug: input.slug, expectedSubmittedAt: row.submittedAt }, now);
  }
  if (row.status !== 'draft' && row.status !== 'changes_requested') {
    return { ok: false, code: 'conflict', message: '지금 상태에서는 승인할 수 없어요.' };
  }

  const lift = await db.update(shopProducts)
    .set({ reviewStatus: 'submitted', submittedAt: epoch })
    .where(and(eq(shopProducts.id, productId), eq(shopProducts.reviewStatus, row.status)));
  if (Number(lift.rowsAffected) === 0) return { ok: false, code: 'conflict', message: '그 사이 상태가 바뀌었어요. 새로고침 후 다시 확인해 주세요.' };

  let result: ShopDecisionResult;
  try {
    result = await decideShopProduct(productId, 'approve', { slug: input.slug, expectedSubmittedAt: epoch }, now);
  } catch (error: unknown) {
    await revert(productId, row.status, row.submittedAt, epoch);
    throw error;
  }
  if (!result.ok) await revert(productId, row.status, row.submittedAt, epoch);
  return result;
};

const revert = async (productId: string, status: 'draft' | 'changes_requested', submittedAt: number | null, epoch: number) => {
  try {
    await getDb().update(shopProducts).set({ reviewStatus: status, submittedAt })
      .where(and(eq(shopProducts.id, productId), eq(shopProducts.reviewStatus, 'submitted'), eq(shopProducts.submittedAt, epoch)));
  } catch (error: unknown) {
    console.error(`[shop/admin] 바로 승인 실패 뒤 상태를 되돌리지 못했습니다 (id=${productId}):`, error);
  }
};
