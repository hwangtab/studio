import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { validateTrackingInput } from '../funding/trackingValidation';
import { resolveOrderShipper } from './artistShipping';
import { sendShopShippedEmail } from './email';
import { findShopOrderByOrderNo, rowsAffectedOf } from './service';
import { shopOrderShips } from './shape';

/**
 * 발송 상태 전이 — 운영자만(관리자 화면). `preparing → shipped → delivered`. 취소는 lib/shop/cancel.ts.
 * 결제가 끝난 주문만 보낸다 — 결제 대기·만료 주문에 운송장을 붙이면 돈 없이 물건이 나간다.
 */

export type ShopFulfillmentOutcome = { ok: true } | { ok: false; message: string };

/**
 * 누가 발송 상태를 바꾸는가. 관리자는 어느 주문이든, 아티스트는 **자기가 직접 보내는 주문**만 — 이 함수 하나가 두 경로의
 * 발송 처리(상태 전이·고객 발송 메일)를 같이 지난다. 아티스트 경로는 라우트가 아니라 여기서 소유를 다시 판정한다.
 */
export type ShopFulfillmentActor = { kind: 'admin' } | { kind: 'artist'; creatorId: string };

const NOT_FOUND = '주문을 찾을 수 없어요.';

/** 아티스트 actor가 이 주문의 발송 주체인가. 아니면 존재를 알리지 않는 같은 문구로 거절한다. */
const ownsOrder = async (orderNo: string, actor: ShopFulfillmentActor | undefined): Promise<boolean> => {
  if (!actor || actor.kind === 'admin') return true;
  const shipper = await resolveOrderShipper(orderNo);
  return shipper.kind === 'artist' && shipper.creatorId === actor.creatorId;
};

export const markShopOrderShipped = async (input: { orderNo: string; courier: string; trackingNumber: string; actor?: ShopFulfillmentActor }): Promise<ShopFulfillmentOutcome> => {
  const courier = input.courier.trim();
  const trackingNumber = input.trackingNumber.trim();
  if (!courier || !trackingNumber) return { ok: false, message: '택배사와 운송장 번호를 모두 적어 주세요.' };
  const checked = validateTrackingInput({ trackingCompany: courier, trackingNumber });
  if (!checked.ok) return checked;

  const order = await findShopOrderByOrderNo(input.orderNo);
  if (!order || !order.shopOrder) return { ok: false, message: NOT_FOUND };
  if (!(await ownsOrder(order.orderNo, input.actor))) return { ok: false, message: NOT_FOUND };
  // 일부 환불된 주문은 어느 줄이 환불됐는지 원장이 모른다 — 아티스트는 보내기 전에 스튜디오가 확인한다.
  if (input.actor?.kind === 'artist' && order.status === 'partially_refunded') {
    return { ok: false, message: '일부 환불된 주문이에요. 보내기 전에 스튜디오 놀에 확인해 주세요.' };
  }
  if (order.status !== 'paid' && order.status !== 'partially_refunded') return { ok: false, message: '결제가 끝난 주문만 보낼 수 있어요.' };
  // 디지털 상품만 담은 주문(우편번호 '')은 보낼 것이 없다 — 첫 내려받기가 delivered로 닫는다.
  if (!shopOrderShips(order.shopOrder)) return { ok: false, message: '배송이 없는 디지털 주문이에요. 발송 처리를 하지 않습니다.' };

  // 운송장을 고쳐 적는 것(shipped → shipped)도 받는다 — 오타를 고칠 길이 있어야 한다. 메일은 처음 보낼 때만.
  const wasPreparing = order.shopOrder.fulfillmentStatus === 'preparing';
  const result = await getDb().run(sql`
    UPDATE shop_orders
    SET fulfillment_status = 'shipped', courier = ${courier}, tracking_number = ${trackingNumber},
        shipped_at = COALESCE(shipped_at, unixepoch()), updated_at = unixepoch()
    WHERE order_no = ${order.orderNo} AND fulfillment_status IN ('preparing', 'shipped')
  `);
  if (rowsAffectedOf(result) === 0) return { ok: false, message: '방금 상태가 바뀌었어요(취소됐거나 배송 완료). 새로고침해 주세요.' };
  if (wasPreparing) await sendShopShippedEmail(order.orderNo);
  return { ok: true };
};

export const markShopOrderDelivered = async (orderNo: string, actor?: ShopFulfillmentActor): Promise<ShopFulfillmentOutcome> => {
  if (!(await ownsOrder(orderNo, actor))) return { ok: false, message: NOT_FOUND };
  const result = await getDb().run(sql`
    UPDATE shop_orders SET fulfillment_status = 'delivered', delivered_at = unixepoch(), updated_at = unixepoch()
    WHERE order_no = ${orderNo} AND fulfillment_status = 'shipped'
  `);
  return rowsAffectedOf(result) === 0 ? { ok: false, message: '발송한 주문만 배송 완료로 바꿀 수 있어요.' } : { ok: true };
};
