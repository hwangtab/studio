import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SHOP_HOLD_SECONDS, SHOP_SALES_OPEN } from '../../data/shop/policy';
import { splitInclusiveAmount } from '../booking/amounts';
import { generateManageToken } from '../booking/token';
import { computeShopTotals } from './amounts';
import { shopLineName, type ResolvedSku } from './catalog';
import { findSellableSkuAsync } from './repository';
import { generateShopOrderNo } from './shape';
import { hasMixedKinds, hasMixedShippers } from './shipper';
import { editionGates, remainingStockSql, stockGateSql } from './stock';
import type { CreateShopOrderPayload } from './validation';

/** libSQL batch 결과의 rowsAffected(lib/shows/service.ts와 같은 로컬 헬퍼 — 모듈 그래프를 섞지 않는다). */
export const rowsAffectedOf = (result: unknown): number =>
  (result as { rowsAffected?: number } | undefined)?.rowsAffected ?? 0;

export type CreateShopOrderResult =
  | { ok: true; orderNo: string; totalAmount: number; orderName: string }
  | { ok: false; code: 'sales_closed' | 'unknown_item' | 'sold_out' | 'lookup_failed' | 'shipping_required' | 'mixed_shipper' | 'mixed_kind' };

/**
 * 주문 생성 — 재고를 SHOP_HOLD_SECONDS 동안 잡고(`pending`), 결제 승인(confirmShopOrder)이 `paid`로 바꾼다.
 *
 * 금액·상품명은 요청이 아니라 카탈로그에서만 읽는다. 재고 판정은 **첫 INSERT의 WHERE** 하나에 모든 줄의 게이트를
 * AND로 건다 — 뒤따르는 shop_orders·shop_order_items INSERT는 "주문이 실제로 만들어졌나"만 EXISTS로 본다.
 * 게이트가 0행이면 나머지도 전부 0행으로 끝나 정리할 것이 없다(공연 createShowOrder와 같은 패턴).
 */
export const createShopOrder = async (
  input: CreateShopOrderPayload,
  now: Date,
  opts: { salesOpen?: boolean } = {},
): Promise<CreateShopOrderResult> => {
  if (!(opts.salesOpen ?? SHOP_SALES_OPEN)) return { ok: false, code: 'sales_closed' };

  const resolved: Array<ResolvedSku & { quantity: number }> = [];
  for (const line of input.lines) {
    const lookup = await findSellableSkuAsync(line.skuId);
    // 조회 실패는 "없는 상품"이 아니다 — 400으로 읽히면 고객이 멀쩡한 상품을 판매 종료로 오해한다(API는 503).
    if ('lookupFailed' in lookup) return { ok: false, code: 'lookup_failed' };
    if (!lookup.found) return { ok: false, code: 'unknown_item' };
    resolved.push({ ...lookup.found, quantity: line.quantity });
  }

  // 한 주문은 실물만 또는 디지털만 — 디지털을 내려받으면 같은 주문의 실물까지 "발송 전 취소"가 막힌다(lib/shop/shipper.ts).
  if (hasMixedKinds(resolved.map((r) => r.product))) return { ok: false, code: 'mixed_kind' };

  // 한 주문은 한 발송 주체만 — 스튜디오 발송과 아티스트 직접 발송(또는 다른 아티스트)을 섞으면 운송장 하나로 닫을 수 없다.
  // 장바구니가 이미 거르지만 서버가 다시 판정한다.
  if (hasMixedShippers(resolved.map((r) => r.product))) return { ok: false, code: 'mixed_shipper' };

  // 실물 줄이 하나라도 있으면 배송지가 필요하다. 디지털 상품만이면 배송지·배송비가 없다(받은 배송지는 쓰지 않는다).
  const needsShipping = resolved.some((r) => r.product.kind !== 'digital');
  if (needsShipping && !input.shipping) return { ok: false, code: 'shipping_required' };
  const ship = needsShipping ? input.shipping : null;

  const totals = computeShopTotals(resolved.map((r) => ({ unitPrice: r.sku.price, quantity: r.quantity, digital: r.product.kind === 'digital' })));
  const { itemAmount, vatAmount, totalAmount } = splitInclusiveAmount(totals.total);
  const orderNo = generateShopOrderNo(now);
  const manageToken = generateManageToken();
  const holdExpiresAt = Math.floor(now.getTime() / 1000) + SHOP_HOLD_SECONDS;

  // 재고 게이트(SKU별) + 한정판 게이트(상품별 — 남은 번호 수). 화면의 남은 수량과 같은 식이다(lib/shop/stock.ts).
  const gates = sql.join([
    ...resolved.map((r) => stockGateSql(r.sku.id, r.quantity, now)),
    ...editionGates(resolved.map((r) => ({ skuId: r.sku.id, quantity: r.quantity, productKey: r.product.slug })), now),
  ], sql` AND `);

  const db = getDb();
  const statements = [
    db.run(sql`
      INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
                          item_amount, vat_amount, total_amount, manage_token)
      SELECT lower(hex(randomblob(16))), ${orderNo}, 'merch', 'pending', ${input.customerName}, ${input.customerPhone},
             ${input.customerEmail}, ${itemAmount}, ${vatAmount}, ${totalAmount}, ${manageToken}
      WHERE ${gates}
    `),
    db.run(sql`
      INSERT INTO shop_orders (order_no, recipient_name, recipient_phone, postcode, address1, address2, shipping_memo,
                               subtotal_amount, shipping_fee, hold_expires_at)
      SELECT ${orderNo}, ${ship?.recipientName ?? ''}, ${ship?.recipientPhone ?? ''}, ${ship?.postcode ?? ''},
             ${ship?.address1 ?? ''}, ${ship?.address2 ?? null}, ${ship?.shippingMemo ?? null},
             ${totals.subtotal}, ${totals.shippingFee}, ${holdExpiresAt}
      WHERE EXISTS (SELECT 1 FROM orders WHERE order_no = ${orderNo})
    `),
    ...resolved.map((r) =>
      db.run(sql`
        INSERT INTO shop_order_items (id, order_no, sku_id, product_slug, product_title, option_label, unit_price, quantity)
        SELECT lower(hex(randomblob(16))), ${orderNo}, ${r.sku.id}, ${r.product.slug}, ${r.product.title},
               ${r.sku.optionLabel ?? null}, ${r.sku.price}, ${r.quantity}
        WHERE EXISTS (SELECT 1 FROM shop_orders WHERE order_no = ${orderNo})
      `),
    ),
  ];
  const results = await db.batch(statements as [typeof statements[number], ...typeof statements]);
  if (rowsAffectedOf(results[0]) === 0) return { ok: false, code: 'sold_out' };

  const first = resolved[0];
  const firstName = shopLineName(first.product.title, first.sku.optionLabel);
  const totalQty = resolved.reduce((n, r) => n + r.quantity, 0);
  const orderName = (resolved.length === 1 ? `${firstName} ${first.quantity}개` : `${firstName} 외 ${totalQty - first.quantity}개`).slice(0, 100);
  return { ok: true, orderNo, totalAmount, orderName };
};

/**
 * 홀드 만료 + 30분 유예가 지난 `pending` 주문을 `expired`로 닫는다(크론). 재고는 계산값이라 따로 돌려줄 것이 없다 —
 * 홀드 시각이 지나는 순간 이미 점유에서 빠진다. 이 정리는 관리자 목록에서 "결제 대기"가 쌓이지 않게 하는 것이다.
 * 유예는 결제창에서 늦게 돌아온 승인이 `expired`를 만나지 않게 둔다(웹훅 신뢰 경로는 expired도 받는다).
 */
export const expireStaleShopOrders = async (now: Date): Promise<number> => {
  const cutoff = Math.floor(now.getTime() / 1000) - 1800;
  const result = await getDb().run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'merch' AND status = 'pending'
      AND order_no IN (SELECT order_no FROM shop_orders WHERE hold_expires_at < ${cutoff})
  `);
  return rowsAffectedOf(result);
};

/** SKU별 남은 수량. 재고 행이 없는 SKU는 0. DB 장애는 호출부가 처리한다(화면은 "확인 중"으로 둔다). */
export const getRemainingStock = async (skuIds: readonly string[], now: Date): Promise<Record<string, number>> => {
  const out: Record<string, number> = Object.fromEntries(skuIds.map((id) => [id, 0]));
  if (skuIds.length === 0) return out;
  const rows = await getDb().all<{ id: string; remaining: number }>(remainingStockSql(skuIds, now));
  for (const r of rows) out[r.id] = Math.max(0, Number(r.remaining));
  return out;
};

/** 상점 주문 한 건 — 결제·환불·배송 정보까지. 확인·관리·관리자 화면 공통 진입점. */
export const findShopOrderByOrderNo = async (orderNo: string) =>
  getDb().query.orders.findFirst({
    where: (o, { and, eq }) => and(eq(o.orderNo, orderNo), eq(o.type, 'merch')),
    with: { shopOrder: { with: { items: true } }, payments: { with: { refunds: true } } },
  });

export type ShopOrderWithDetails = NonNullable<Awaited<ReturnType<typeof findShopOrderByOrderNo>>>;
