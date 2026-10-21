import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_PLATFORM_FEE_PERCENT, SHOP_ARTIST_SHARE_PERCENT } from '../../data/pricing';
import { SHOP_PRODUCTS } from '../../data/shop/catalog';
import { STUDIO_SHOP_ARTIST_SLUG } from '../shop/studioArtist';
import type { RevenueRow } from './revenueReport';

/**
 * 판매·중개(펀딩·공연·상점)의 매출 = **스튜디오가 가져가는 몫(플랫폼 수수료)** 뿐이다. 결제액 전체를 매출에 올리면 개설자·주최자·아티스트에게
 * 정산해 줄 돈까지 섞여 매출이 부풀어 보인다(운영자 지적 2026-10-21).
 *
 * - 펀딩·공연: 순결제액 × `FUNDING_PLATFORM_FEE_PERCENT`(5.5%, 부가세 포함 — 주최자 약관 제6조가 펀딩과 같은 상수). 결제(PG) 수수료는
 *   스튜디오가 대신 내는 **비용**이라 매출에서 더하지도 빼지도 않는다.
 * - 상점: 아티스트 상품은 판매가의 `100 − SHOP_ARTIST_SHARE_PERCENT`%(스튜디오 몫), 스튜디오 자체 상품은 전부 스튜디오 몫이다. 배송비는 발송하는 쪽의 몫이라
 *   스튜디오가 보내면 스튜디오 몫, 아티스트가 직접 보내면 아티스트 몫(lib/shop/artistPayout.ts와 같은 규칙). 이 비율을 주문별 결제액에 곱한다
 *   — 환불도 같은 비율로 줄어든다. 정산 기록의 실제 금액과는 반올림·부분 환불에서 몇 원 다를 수 있다(여기는 발생 기준 추정).
 *
 * 행의 `gross`·`refunded`·`vat`는 수수료분으로 바꾸고 원래 결제액은 `sourceGross`에 남긴다(화면이 "결제액 → 수수료"를 보인다).
 */

const round = Math.round;

const feeRow = (row: RevenueRow, rate: number): RevenueRow => {
  const gross = round(row.gross * rate);
  const refunded = Math.min(gross, round(row.refunded * rate));
  return { ...row, sourceGross: row.gross, feeRate: rate, gross, refunded, vat: round(gross / 11) };
};

interface MerchLine { order_no: string; sku_id: string; unit_price: number; quantity: number; shipping_fee: number; artist_ships: number; db_artist: number | null }

/** 상점 주문별 스튜디오 몫 비율(0~1). 읽지 못한 주문은 키가 없다 — 호출부가 100%로 두지 않고 그대로 둔다. */
export const loadMerchStudioFractions = async (orderNos: readonly string[]): Promise<Map<string, number>> => {
  const out = new Map<string, number>();
  if (orderNos.length === 0) return out;
  const fileArtistBySku = new Map(SHOP_PRODUCTS.flatMap((p) => (p.artist ? p.skus.map((s) => [s.id, true] as const) : [])));
  const placeholders = sql.join(orderNos.map((n) => sql`${n}`), sql`, `);
  const lines = await getDb().all<MerchLine>(sql`
    SELECT i.order_no AS order_no, i.sku_id AS sku_id, i.unit_price AS unit_price, i.quantity AS quantity, so.shipping_fee AS shipping_fee,
      CASE WHEN EXISTS (
        SELECT 1 FROM shop_order_items i2
        JOIN shop_product_skus ps2 ON ps2.id = i2.sku_id
        JOIN shop_products p2 ON p2.id = ps2.product_id
        JOIN shop_product_fulfillment f ON f.product_id = p2.id AND f.mode = 'artist'
        WHERE i2.order_no = i.order_no AND p2.kind <> 'digital'
          AND p2.creator_id NOT IN (SELECT creator_id FROM shop_artists WHERE slug = ${STUDIO_SHOP_ARTIST_SLUG})
      ) THEN 1 ELSE 0 END AS artist_ships,
      CASE WHEN i.sku_id LIKE 'db-%' THEN (
        SELECT CASE WHEN p.creator_id IN (SELECT creator_id FROM shop_artists WHERE slug = ${STUDIO_SHOP_ARTIST_SLUG}) THEN 0 ELSE 1 END
        FROM shop_product_skus ps JOIN shop_products p ON p.id = ps.product_id WHERE ps.id = i.sku_id
      ) ELSE NULL END AS db_artist
    FROM shop_order_items i
    JOIN shop_orders so ON so.order_no = i.order_no
    WHERE i.order_no IN (${placeholders})
  `);
  const byOrder = new Map<string, { items: number; studio: number; shipping: number; artistShips: boolean }>();
  for (const l of lines) {
    const acc = byOrder.get(l.order_no) ?? { items: 0, studio: 0, shipping: Number(l.shipping_fee), artistShips: Number(l.artist_ships) > 0 };
    const sale = Number(l.unit_price) * Number(l.quantity);
    const isArtist = l.db_artist === null ? fileArtistBySku.has(l.sku_id) : Number(l.db_artist) === 1;
    acc.items += sale;
    acc.studio += isArtist ? sale * (1 - SHOP_ARTIST_SHARE_PERCENT / 100) : sale;
    byOrder.set(l.order_no, acc);
  }
  for (const [orderNo, a] of byOrder) {
    const total = a.items + a.shipping;
    if (total <= 0) continue;
    out.set(orderNo, (a.studio + (a.artistShips ? 0 : a.shipping)) / total);
  }
  return out;
};

/** 판매·중개 행을 수수료 몫으로 바꾼다. 직접 서비스 행은 그대로. */
export const applyPlatformFees = async (rows: RevenueRow[]): Promise<RevenueRow[]> => {
  const merchNos = rows.filter((r) => r.type === 'merch').map((r) => r.orderNo);
  let merch = new Map<string, number>();
  if (merchNos.length > 0) {
    try {
      merch = await loadMerchStudioFractions(merchNos);
    } catch (error) {
      // 표가 없거나 조회가 실패하면 상점 행은 결제액 그대로 두고 로그만 남긴다 — 숫자를 지어내지 않는다.
      console.error('[revenue] 상점 스튜디오 몫 조회 실패 — 상점 행은 결제액 그대로 둡니다:', error instanceof Error ? error.message : String(error));
    }
  }
  const feeRate = FUNDING_PLATFORM_FEE_PERCENT / 100;
  return rows.map((row) => {
    if (row.type === 'funding' || row.type === 'ticket') return feeRow(row, feeRate);
    if (row.type === 'merch') {
      const f = merch.get(row.orderNo);
      return f === undefined ? row : feeRow(row, f);
    }
    return row;
  });
};
