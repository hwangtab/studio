import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isMissingTableError } from '../dbErrors';
import { isStudioShopArtistSlug } from './studioArtist';

/**
 * 상품의 발송 주체(`shop_product_fulfillment`, 마이그레이션 0057) — 서버 전용.
 *
 * 판매자·결제·환불·고객 응대는 언제나 스튜디오다. 이 표는 **포장해 보내는 쪽**만 가른다. 행이 없으면 'studio'다.
 * 파일 카탈로그 상품은 표에 닿지 않고 항상 스튜디오 발송이다.
 *
 * **표가 없는 DB(마이그레이션 전 배포)에서도 기존 주문 경로가 그대로 돈다** — 읽기는 `no such table`을 'studio'로 본다.
 * 그 밖의 오류는 던진다(주문 생성은 `lookup_failed` 503으로, 섞인 주문을 못 거르는 채 통과시키지 않는다).
 *
 * **승인 뒤에는 바꿀 수 없다.** 발송 주체가 갈리면 이미 들어온 주문의 발송 책임·개인정보 제공 범위가 바뀐다.
 * 쓰기 문장의 WHERE가 `review_status <> 'approved'`를 같이 걸어, 읽은 뒤 승인이 끼어도 0행이다.
 */

export type ShopFulfillmentMode = 'studio' | 'artist';

const FULFILLMENT_TABLE = 'shop_product_fulfillment';

/** 상품 id → 아티스트 상점 slug. 아티스트가 직접 보내는 상품만 들어 있다. 표가 없으면 빈 맵. */
export const loadShippedByArtistSlugs = async (productIds: readonly string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (productIds.length === 0) return out;
  try {
    const rows = await getDb().all<{ product_id: string; slug: string }>(sql`
      SELECT f.product_id AS product_id, a.slug AS slug
      FROM shop_product_fulfillment f
      JOIN shop_products p ON p.id = f.product_id
      JOIN shop_artists a ON a.creator_id = p.creator_id
      WHERE f.mode = 'artist' AND p.kind <> 'digital' AND f.product_id IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})
    `);
    for (const r of rows) out.set(r.product_id, r.slug);
  } catch (error: unknown) {
    if (!isMissingTableError(error, FULFILLMENT_TABLE)) throw error;
  }
  return out;
};

/** 한 상품의 현재 발송 주체. `tableMissing`이면 마이그레이션 0057 전이다(항상 'studio'). */
export const loadProductFulfillmentMode = async (productId: string): Promise<{ mode: ShopFulfillmentMode; tableMissing: boolean }> => {
  try {
    const [row] = await getDb().all<{ mode: string }>(sql`SELECT mode FROM shop_product_fulfillment WHERE product_id = ${productId}`);
    return { mode: row?.mode === 'artist' ? 'artist' : 'studio', tableMissing: false };
  } catch (error: unknown) {
    if (isMissingTableError(error, FULFILLMENT_TABLE)) return { mode: 'studio', tableMissing: true };
    throw error;
  }
};

export type SetFulfillmentModeResult =
  | { ok: true }
  | { ok: false; code: 'not_found' | 'invalid' | 'conflict' | 'storage_unavailable'; message: string };

const deny = (code: 'not_found' | 'invalid' | 'conflict' | 'storage_unavailable', message: string): SetFulfillmentModeResult => ({ ok: false, code, message });

export const setProductFulfillmentMode = async (
  productId: string,
  mode: ShopFulfillmentMode,
  now: Date = new Date(),
): Promise<SetFulfillmentModeResult> => {
  if (mode !== 'studio' && mode !== 'artist') return deny('invalid', '발송 주체는 스튜디오 또는 아티스트예요.');
  const db = getDb();
  const [product] = await db.all<{ review_status: string; kind: string; artist_slug: string | null }>(sql`
    SELECT p.review_status AS review_status, p.kind AS kind,
           (SELECT a.slug FROM shop_artists a WHERE a.creator_id = p.creator_id) AS artist_slug
    FROM shop_products p WHERE p.id = ${productId}
  `);
  if (!product) return deny('not_found', '상품을 찾을 수 없어요.');
  if (product.review_status === 'approved') {
    return deny('conflict', '승인된 상품의 발송 주체는 바꿀 수 없어요. 이미 들어온 주문의 발송 책임이 갈려요.');
  }
  if (mode === 'artist') {
    if (product.kind === 'digital') return deny('invalid', '디지털 상품은 발송이 없어요.');
    if (!product.artist_slug) return deny('invalid', '상점 아티스트로 등재된 계정의 상품만 아티스트가 보낼 수 있어요.');
    if (isStudioShopArtistSlug(product.artist_slug)) return deny('invalid', '스튜디오 상품은 스튜디오가 보내요.');
  }
  const epoch = Math.floor(now.getTime() / 1000);
  try {
    const result = await db.run(sql`
      INSERT INTO shop_product_fulfillment (product_id, mode, created_at, updated_at)
      SELECT ${productId}, ${mode}, ${epoch}, ${epoch}
      WHERE EXISTS (
        SELECT 1 FROM shop_products WHERE id = ${productId} AND review_status <> 'approved'
          ${mode === 'artist' ? sql`AND kind <> 'digital'` : sql``}
      )
      ON CONFLICT(product_id) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at
    `);
    if (Number(result.rowsAffected) === 0) return deny('conflict', '그 사이 상품이 승인됐거나 디지털 상품으로 바뀌었어요. 새로고침해 확인해 주세요.');
  } catch (error: unknown) {
    if (isMissingTableError(error, FULFILLMENT_TABLE)) return deny('storage_unavailable', '발송 주체 표가 아직 없어요. 마이그레이션 0057을 먼저 적용해 주세요.');
    throw error;
  }
  return { ok: true };
};

/**
 * 디지털 상품에는 발송 주체가 없다 — 저장 때 종류가 디지털이면 아티스트 발송 행을 지운다(행이 없으면 'studio').
 * 승인 전에만 종류를 바꿀 수 있으므로 승인 뒤 주문의 발송 책임은 흔들리지 않는다. 표가 없으면(0057 전) 지울 것도 없다.
 */
export const clearArtistFulfillmentOfDigital = async (productId: string): Promise<void> => {
  try {
    await getDb().run(sql`
      DELETE FROM shop_product_fulfillment
      WHERE product_id = ${productId} AND mode = 'artist'
        AND EXISTS (SELECT 1 FROM shop_products WHERE id = ${productId} AND kind = 'digital')
    `);
  } catch (error: unknown) {
    if (!isMissingTableError(error, FULFILLMENT_TABLE)) throw error;
  }
};
