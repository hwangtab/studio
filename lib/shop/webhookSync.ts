import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';

/**
 * 토스 쪽에서 전액 취소된 상점 주문의 발송 상태를 닫는다(웹훅 CANCELED). 이미 cancelled면 아무것도 안 한다.
 * 발송한 뒤에 콘솔에서 환불했다면(반품) 그 사실도 cancelled로 남는다 — 돈이 다 돌아간 주문은 더 보낼 것이 없다.
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
};
