import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SHOP_PRODUCTS } from '../../data/shop/catalog';
import { getRemainingStock } from './service';

/** 관리자 상점 화면 — 주문 목록·재고 표. */

export interface AdminShopOrderRow {
  orderNo: string;
  status: string;
  fulfillmentStatus: string;
  customerName: string;
  totalAmount: number;
  itemSummary: string;
  createdAt: number;
}

/** 최근 주문(결제 대기·만료는 뺀다 — 관리자가 할 일이 없는 주문). */
export const listAdminShopOrders = async (limit = 200): Promise<AdminShopOrderRow[]> => {
  const rows = await getDb().all<{
    order_no: string; status: string; fulfillment_status: string; customer_name: string; total_amount: number;
    item_summary: string | null; created_at: number;
  }>(sql`
    SELECT o.order_no, o.status, so.fulfillment_status, o.customer_name, o.total_amount, o.created_at,
           (SELECT GROUP_CONCAT(i.product_title || COALESCE(' · ' || i.option_label, '') || ' ×' || i.quantity, ', ')
            FROM shop_order_items i WHERE i.order_no = o.order_no) AS item_summary
    FROM orders o JOIN shop_orders so ON so.order_no = o.order_no
    WHERE o.type = 'merch' AND o.status NOT IN ('pending', 'expired', 'failed')
    ORDER BY o.created_at DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    orderNo: r.order_no, status: r.status, fulfillmentStatus: r.fulfillment_status, customerName: r.customer_name,
    totalAmount: Number(r.total_amount), itemSummary: r.item_summary ?? '', createdAt: Number(r.created_at),
  }));
};

export interface AdminSkuStockRow {
  skuId: string;
  productTitle: string;
  optionLabel: string | null;
  price: number;
  published: boolean;
  retired: boolean;
  stock: number | null;
  remaining: number;
}

/** 카탈로그의 모든 SKU와 DB 재고. 재고 행이 없으면 stock null(= 0, 아직 안 넣음). */
export const listAdminSkuStock = async (now: Date): Promise<AdminSkuStockRow[]> => {
  const skus = SHOP_PRODUCTS.flatMap((p) => p.skus.map((s) => ({ product: p, sku: s })));
  if (skus.length === 0) return [];
  const ids = skus.map((x) => x.sku.id);
  const stockRows = await getDb().all<{ id: string; stock: number }>(
    sql`SELECT id, stock FROM shop_skus WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
  );
  const stockById = new Map(stockRows.map((r) => [r.id, Number(r.stock)]));
  const remaining = await getRemainingStock(ids, now);
  return skus.map(({ product, sku }) => ({
    skuId: sku.id, productTitle: product.title, optionLabel: sku.optionLabel ?? null, price: sku.price,
    published: product.published, retired: Boolean(sku.retired),
    stock: stockById.get(sku.id) ?? null, remaining: remaining[sku.id] ?? 0,
  }));
};

/** 총 재고를 정한다(없으면 만든다). 카탈로그에 없는 SKU는 거절한다. */
export const setSkuStock = async (skuId: string, stock: number): Promise<{ ok: true } | { ok: false; message: string }> => {
  const product = SHOP_PRODUCTS.find((p) => p.skus.some((s) => s.id === skuId));
  if (!product) return { ok: false, message: '카탈로그에 없는 SKU예요.' };
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return { ok: false, message: '재고는 0 이상의 정수로 적어 주세요.' };
  await getDb().run(sql`
    INSERT INTO shop_skus (id, product_slug, stock) VALUES (${skuId}, ${product.slug}, ${stock})
    ON CONFLICT(id) DO UPDATE SET stock = excluded.stock, updated_at = unixepoch()
  `);
  return { ok: true };
};
