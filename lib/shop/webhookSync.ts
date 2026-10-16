import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { safeSyncShopLateRefundAdjustments } from '../partnerPayouts/shopLateRefund';
import { DB_SKU_PREFIX } from './productRules';
import { deleteOrderSerials } from './serials';

/**
 * 토스 쪽에서 전액 취소된 상점 주문의 발송 상태를 닫는다(웹훅 CANCELED). 이미 cancelled면 아무것도 안 한다.
 * 발송한 뒤에 콘솔에서 환불했다면(반품) 그 사실도 cancelled로 남는다 — 돈이 다 돌아간 주문은 더 보낼 것이 없다.
 * 발송 전(`shipped_at IS NULL`)이었다면 한정판 번호를 반납한다. 발송 뒤 반품은 번호를 남긴다.
 */
export const closeShopFulfillmentOnFullCancel = async (orderNo: string): Promise<void> => {
  try {
    await getDb().run(sql`
      UPDATE shop_orders SET fulfillment_status = 'cancelled', cancelled_at = COALESCE(cancelled_at, unixepoch()), updated_at = unixepoch()
      WHERE order_no = ${orderNo} AND fulfillment_status <> 'cancelled'
    `);
  } catch (error) {
    console.error('[shop-webhook] 전액 취소 뒤 발송 상태 닫기 실패', { orderNo, error });
  }
  try {
    const [row] = await getDb().all<{ unshipped: number; db_lines: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM shop_orders WHERE order_no = ${orderNo} AND shipped_at IS NULL) AS unshipped,
        (SELECT COUNT(*) FROM shop_order_items WHERE order_no = ${orderNo} AND sku_id LIKE ${`${DB_SKU_PREFIX}%`}) AS db_lines
    `);
    if (Number(row?.unshipped ?? 0) > 0 && Number(row?.db_lines ?? 0) > 0) {
      await deleteOrderSerials(orderNo);
    }
  } catch (error) {
    console.error('[shop-webhook] 한정판 번호 반납 확인 실패', { orderNo, error });
  }
  // 정산 뒤 환불이면 다음 정산에서 뺄 이월 조정을 쌓는다(대사가 주문을 refunded로 옮긴 뒤라 여기서 판정된다). 던지지 않는다.
  await safeSyncShopLateRefundAdjustments(orderNo);
};
