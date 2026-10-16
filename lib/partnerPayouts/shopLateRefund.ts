import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SHOP_ARTIST_SHARE_PERCENT } from '../../data/pricing';
import { SHOP_PRODUCTS } from '../../data/shop/catalog';
import { isMissingTableError } from '../dbErrors';
import { kstMonthRange } from '../shop/artistPayout';
import { DB_SKU_PREFIX } from '../shop/productRules';
import { STUDIO_SHOP_ARTIST_SLUG } from '../shop/studioArtist';
import { insertAdjustmentIfAbsent } from './adjustments';

/**
 * 정산 뒤 환불 → 다음 정산에서 빼는 **이월 조정**(`late_refund`)을 만든다. 위탁 약관 제7조가 "정산한 뒤에 환불된 판매는 다음 정산에서 뺀다"고
 * 이미 약속했고(설계 §4), 그 약속의 코드가 이 파일이다.
 *
 * 언제 만드는가: 전액 환불로 `orders.status = 'refunded'`가 된 상점 주문이 **이미 기록된 정산의 스냅샷에 들어 있었을 때**.
 *  - 주문이 정산에 세어진 달: 실물은 발송(`shipped_at`)한 달, 배송 없는 디지털은 결제 승인 달(+ 내려받기 기록이 있어야 센다) — `listShopArtistSales`와 같은 기준.
 *  - "들어 있었다"의 판정: 그 (아티스트, 달) 기록이 있고, 기록이 만들어진 시각이 ① 주문이 세어질 조건을 갖춘 시각(발송·내려받기) 이후이고
 *    ② 전액 환불이 완결된 시각 이전(같은 초 포함)이다. 기록 뒤에 발송된 주문, 기록보다 먼저 환불된 주문은 스냅샷에 없었으니 뺄 것이 없다.
 *  - 금액: −(상품 판매가 합 × 55%, 반올림 + 아티스트 직접 발송이면 배송비 전액) — `computeShopArtistPayout`이 그 주문에서 아티스트 몫으로 잡았을 값이다.
 *    주문 단위로 반올림하므로 월 합계 반올림과 최대 몇 원 차이가 날 수 있다(운영자가 수기 조정으로 맞춘다).
 *
 * **부분 환불(`partially_refunded`)은 만들지 않는다.** 어느 줄이 환불됐는지 원장이 모르므로(정산 예정 표도 "직접 확인"으로 뺀다) 추측하지 않는다.
 * 부분 환불이 나중에 전액이 되면 그때 만들어지는데, 그 주문이 스냅샷에 있었는지는 알 수 없다 — 부분 환불 상태로 기록된 정산이라면 잘못 생긴
 * 조정이므로 운영자가 반대 부호의 수기 조정으로 상쇄한다(관리자 화면에서 미적용 조정이 모두 보인다).
 *
 * 멱등: (kind, payee_key, reason, source_ref=주문번호)가 UNIQUE라 몇 번 불러도 한 번만 쌓인다. 환불 경로 두 곳(`cancelShopOrder`·웹훅 전액 취소 대사)이
 * 부르고, 정산 기록 직전에도 한 번 더 불러 메운다. 호출부는 `safeSyncShopLateRefundAdjustments`로 감싸 **환불 자체가 이 조정 때문에 실패하지 않게** 한다.
 */

type OrderFacts = {
  status: string;
  postcode: string;
  shipped_at: number | null;
  shipping_fee: number;
  approved_at: number | null;
  downloaded_at: number | null;
  /** 전액 환불이 완결된 시각 = 완료(done)된 환불 행의 마지막 생성 시각. */
  refunded_at: number | null;
};

const kstMonthOf = (epochSec: number): string => new Date((epochSec + 9 * 3600) * 1000).toISOString().slice(0, 7);

interface Share { key: string; itemsAmount: number; shippingAmount: number }

/** 주문 줄을 정산 대상 키(`file:<slug>`·`creator:<id>`)별로 묶고, 아티스트 직접 발송이면 배송비를 얹는다. */
const loadShares = async (orderNo: string, shipsPhysically: boolean, shippingFee: number): Promise<Share[]> => {
  const db = getDb();
  const items = await db.all<{ sku_id: string; unit_price: number; quantity: number }>(sql`
    SELECT sku_id, unit_price, quantity FROM shop_order_items WHERE order_no = ${orderNo}
  `);
  const shares = new Map<string, Share>();
  const bump = (key: string, amount: number) => {
    const s = shares.get(key) ?? { key, itemsAmount: 0, shippingAmount: 0 };
    s.itemsAmount += amount;
    shares.set(key, s);
  };

  const artistBySku = new Map(SHOP_PRODUCTS.flatMap((p) => (p.artist ? p.skus.map((s) => [s.id, p.artist as string] as const) : [])));
  const dbSkuIds: string[] = [];
  for (const i of items) {
    const amount = Number(i.unit_price) * Number(i.quantity);
    const fileArtist = artistBySku.get(i.sku_id);
    if (fileArtist) bump(`file:${fileArtist}`, amount);
    else if (i.sku_id.startsWith(DB_SKU_PREFIX)) dbSkuIds.push(i.sku_id);
  }
  if (dbSkuIds.length === 0) return [...shares.values()];

  const dbRows = await db.all<{ sku_id: string; creator_id: string; kind: string }>(sql`
    SELECT ps.id AS sku_id, p.creator_id AS creator_id, p.kind AS kind
    FROM shop_product_skus ps JOIN shop_products p ON p.id = ps.product_id
    WHERE ps.id IN (${sql.join(dbSkuIds.map((id) => sql`${id}`), sql`, `)})
      AND p.creator_id NOT IN (SELECT creator_id FROM shop_artists WHERE slug = ${STUDIO_SHOP_ARTIST_SLUG})
  `);
  const productOfSku = new Map(dbRows.map((r) => [r.sku_id, r]));
  // 발송 주체 표(0057)가 없으면 전부 스튜디오 발송이다 — 정산 예정 표와 같은 취급.
  let artistShippedCreators = new Set<string>();
  try {
    const f = await db.all<{ creator_id: string }>(sql`
      SELECT DISTINCT p.creator_id AS creator_id
      FROM shop_order_items i
      JOIN shop_product_skus ps ON ps.id = i.sku_id
      JOIN shop_products p ON p.id = ps.product_id
      JOIN shop_product_fulfillment f ON f.product_id = p.id AND f.mode = 'artist'
      WHERE i.order_no = ${orderNo} AND p.kind <> 'digital'
    `);
    artistShippedCreators = new Set(f.map((r) => r.creator_id));
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }
  for (const i of items) {
    const row = productOfSku.get(i.sku_id);
    if (row) bump(`creator:${row.creator_id}`, Number(i.unit_price) * Number(i.quantity));
  }
  if (shipsPhysically && shippingFee > 0) {
    for (const creatorId of artistShippedCreators) {
      const s = shares.get(`creator:${creatorId}`);
      if (s) s.shippingAmount = shippingFee;
    }
  }
  return [...shares.values()];
};

export interface SyncLateRefundResult {
  created: number;
  /** 이미 있어서 건너뛴 것(멱등). */
  existing: number;
}

const syncOrder = async (orderNo: string, onlyKey?: string): Promise<SyncLateRefundResult> => {
  const db = getDb();
  const out: SyncLateRefundResult = { created: 0, existing: 0 };
  const [facts] = await db.all<OrderFacts>(sql`
    SELECT o.status AS status, so.postcode AS postcode, so.shipped_at AS shipped_at, so.shipping_fee AS shipping_fee,
           (SELECT MIN(pay.approved_at) FROM payments pay WHERE pay.order_id = o.id) AS approved_at,
           (SELECT d.first_downloaded_at FROM shop_order_downloads d WHERE d.order_no = o.order_no) AS downloaded_at,
           (SELECT MAX(r.created_at) FROM refunds r JOIN payments pay ON pay.id = r.payment_id WHERE pay.order_id = o.id AND r.status = 'done') AS refunded_at
    FROM orders o JOIN shop_orders so ON so.order_no = o.order_no
    WHERE o.order_no = ${orderNo} AND o.type = 'merch'
  `);
  if (!facts || facts.status !== 'refunded') return out;
  // 환불 기록(완료된 환불 행)이 없으면 언제 환불됐는지 몰라 스냅샷 전후를 가를 수 없다 — 추측하지 않는다.
  if (facts.refunded_at === null) return out;

  const ships = facts.postcode !== '';
  let period: string;
  let qualifiedAt: number;
  if (ships) {
    if (facts.shipped_at === null) return out; // 발송한 적 없는 주문은 어느 달 정산에도 세어진 적이 없다.
    period = kstMonthOf(Number(facts.shipped_at));
    qualifiedAt = Number(facts.shipped_at);
  } else {
    if (facts.approved_at === null || facts.downloaded_at === null) return out; // 내려받기 전 디지털은 정산에 넣지 않는다.
    period = kstMonthOf(Number(facts.approved_at));
    qualifiedAt = Number(facts.downloaded_at);
  }
  if (!kstMonthRange(period)) return out;

  for (const share of await loadShares(orderNo, ships, Number(facts.shipping_fee))) {
    if (onlyKey && share.key !== onlyKey) continue;
    const [payout] = await db.all<{ id: string; created_at: number }>(sql`
      SELECT id, created_at FROM partner_payouts WHERE kind = 'shop' AND subject_key = ${share.key} AND period = ${period}
    `);
    if (!payout || Number(payout.created_at) < qualifiedAt) continue;
    // 환불이 기록보다 먼저였다면 그 스냅샷은 환불된 주문을 애초에 세지 않았다(이체 전 기록을 지우고 다시 기록한 경우 포함) — 뺄 것이 없다.
    if (Number(facts.refunded_at) < Number(payout.created_at)) continue;
    const amount = -(Math.round((share.itemsAmount * SHOP_ARTIST_SHARE_PERCENT) / 100) + share.shippingAmount);
    const result = await insertAdjustmentIfAbsent({
      kind: 'shop', payeeKey: share.key, amount, reason: 'late_refund', sourceRef: orderNo,
      memo: `주문 ${orderNo} 환불 — ${period} 정산에 포함돼 있던 판매`, originPayoutId: payout.id,
    });
    if (result === 'inserted') out.created += 1;
    else if (result === 'exists') out.existing += 1;
  }
  return out;
};

/**
 * 한 주문의 정산 뒤 환불 조정을 만든다(멱등). 표가 없거나 DB 오류면 던진다 — 환불 경로에서는 `safeSyncShopLateRefundAdjustments`를 쓴다.
 * `{ subjectKey }`를 주면 그 대상의 **기록된 달마다** 환불된 주문을 찾아 보충한다(정산 기록 직전에 쓴다).
 */
export const syncShopLateRefundAdjustments = async (target: { orderNo: string } | { subjectKey: string }): Promise<SyncLateRefundResult> => {
  if ('orderNo' in target) return syncOrder(target.orderNo);
  const db = getDb();
  const total: SyncLateRefundResult = { created: 0, existing: 0 };
  const payouts = await db.all<{ period: string }>(sql`
    SELECT period FROM partner_payouts WHERE kind = 'shop' AND subject_key = ${target.subjectKey}
  `);
  for (const { period } of payouts) {
    const range = kstMonthRange(period);
    if (!range) continue;
    // 그 달에 발송했거나(실물) 그 달에 결제 승인된(배송 없는 디지털) 환불 주문 후보 — 아티스트 몫 판정은 syncOrder가 한다.
    const candidates = await db.all<{ order_no: string }>(sql`
      SELECT o.order_no FROM orders o JOIN shop_orders so ON so.order_no = o.order_no
      WHERE o.type = 'merch' AND o.status = 'refunded'
        AND ((so.postcode <> '' AND so.shipped_at >= ${range.from} AND so.shipped_at < ${range.to})
          OR (so.postcode = ''
              AND (SELECT MIN(pay.approved_at) FROM payments pay WHERE pay.order_id = o.id) >= ${range.from}
              AND (SELECT MIN(pay.approved_at) FROM payments pay WHERE pay.order_id = o.id) < ${range.to}))
    `);
    for (const c of candidates) {
      const r = await syncOrder(c.order_no, target.subjectKey);
      total.created += r.created;
      total.existing += r.existing;
    }
  }
  return total;
};

/**
 * 환불 경로용 — **절대 던지지 않는다.** 환불은 이미 끝났고, 조정을 못 만든 것은 로그로 남긴다(`[partner-payouts]`). 못 만든 조정은
 * 그 아티스트의 다음 정산 기록 직전 보충(`syncShopLateRefundAdjustments({ subjectKey })`)이 메운다. 표가 없는 DB(0067 전)는 조용히 건너뛴다.
 */
export const safeSyncShopLateRefundAdjustments = async (orderNo: string): Promise<void> => {
  try {
    await syncShopLateRefundAdjustments({ orderNo });
  } catch (error) {
    if (isMissingTableError(error)) return;
    console.error('[partner-payouts] 정산 뒤 환불 조정 생성 실패 — 다음 정산 기록 때 보충됩니다', { orderNo, error });
  }
};
