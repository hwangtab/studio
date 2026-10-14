import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { getRemainingStock } from './service';

/**
 * 아티스트에게 보이는 판매 현황 — SKU별 맡긴 수량·결제 완료·발송 완료·남은 수량. **구매자 정보는 한 칸도 읽지 않는다.**
 * 잠긴(판매가 시작된) SKU만 센다. 부분 환불 주문은 어느 줄이 환불됐는지 원장이 모르므로 결제 완료로 센다(보수적).
 * 남은 수량은 화면·게이트와 같은 점유 판정(`getRemainingStock`)이다.
 */

export interface CreatorSkuSales {
  skuId: string;
  productId: string;
  productTitle: string;
  optionLabel: string | null;
  retired: boolean;
  /** 맡긴 수량(`shop_skus.stock`). 운영자가 넣기 전이면 0. */
  deposited: number;
  paid: number;
  shipped: number;
  remaining: number;
}

export const loadCreatorSales = async (creatorId: string, now: Date = new Date()): Promise<CreatorSkuSales[]> => {
  const db = getDb();
  const skus = await db.all<{
    sku_id: string; product_id: string; title: string; option_label: string | null; retired: number; stock: number | null;
  }>(sql`
    SELECT s.id AS sku_id, p.id AS product_id, p.title AS title, s.option_label AS option_label, s.retired AS retired, k.stock AS stock
    FROM shop_product_skus s
    JOIN shop_products p ON p.id = s.product_id
    LEFT JOIN shop_skus k ON k.id = s.id
    WHERE p.creator_id = ${creatorId} AND s.locked_at IS NOT NULL
    ORDER BY p.updated_at DESC, s.sort_order ASC, s.id ASC
  `);
  if (skus.length === 0) return [];
  const ids = skus.map((s) => s.sku_id);

  const sold = await db.all<{ sku_id: string; paid: number; shipped: number }>(sql`
    SELECT i.sku_id AS sku_id,
           SUM(i.quantity) AS paid,
           SUM(CASE WHEN so.fulfillment_status IN ('shipped', 'delivered') THEN i.quantity ELSE 0 END) AS shipped
    FROM shop_order_items i
    JOIN orders o ON o.order_no = i.order_no
    JOIN shop_orders so ON so.order_no = i.order_no
    WHERE o.status IN ('paid', 'partially_refunded') AND i.sku_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    GROUP BY i.sku_id
  `);
  const soldById = new Map(sold.map((r) => [r.sku_id, r]));
  const remaining = await getRemainingStock(ids, now);

  return skus.map((s) => ({
    skuId: s.sku_id,
    productId: s.product_id,
    productTitle: s.title,
    optionLabel: s.option_label,
    retired: Boolean(s.retired),
    deposited: Number(s.stock ?? 0),
    paid: Number(soldById.get(s.sku_id)?.paid ?? 0),
    shipped: Number(soldById.get(s.sku_id)?.shipped ?? 0),
    remaining: remaining[s.sku_id] ?? 0,
  }));
};
