import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { remainingRefundable, settleRefund, type CancelInput } from '../booking/cancel';
import { isBankDepositPayment } from '../payments/bankDeposit';
import { sendShopCancelledEmails } from './email';
import { getFirstDownloadedAt } from './downloads';
import { isDbSkuId } from './productRules';
import { releaseOrderSerials } from './serials';
import { findShopOrderByOrderNo, rowsAffectedOf } from './service';

/**
 * 상점 주문 취소·환불 — **전액만** 한다(1차). 고객은 발송 전(`preparing`)에만, 운영자는 발송 뒤에도(반품 환불) 할 수 있다.
 * 줄 단위·배송비 제외 같은 부분 환불은 아직 없다 — 필요하면 토스 콘솔에서 하고, 웹훅 대사가 원장을 맞춘다.
 *
 * 돈을 움직이고 기록하는 구간은 예약·믹싱과 같은 `settleRefund`(lib/booking/cancel.ts)를 쓴다 — 멱등키·잔액 상한·
 * 실패 기록이 한 벌이다. 선점은 `shop_orders.fulfillment_status`를 읽은 값 그대로일 때만 `cancelled`로 바꾸는 CAS다
 * (고객 취소와 관리자 발송 처리가 겹치면 한쪽만 이긴다). 토스가 거절하면 선점을 되돌린다.
 *
 * **디지털 상품**: 고객은 내려받기를 시작한 뒤에는 취소할 수 없다(전자상거래법 제17조 제2항 제5호). 선점 UPDATE의 WHERE가
 * `NOT EXISTS(shop_order_downloads)`를 함께 걸어, 내려받기 기록과 겹치면 어느 쪽이 먼저든 다른 쪽은 0행이다. `db-` 줄이 있는 주문에만
 * 걸린다(표 없는 DB에서 파일 상품 주문 취소가 깨지지 않게). 운영자 환불은 내려받은 뒤에도 할 수 있다(관리자 화면이 내려받음을 알린다).
 *
 * 재고는 따로 돌려주지 않는다 — 주문이 `refunded`가 되는 순간 점유 계산(lib/shop/stock.ts)에서 빠진다.
 */

export type ShopCancelOutcome =
  | { ok: true; refundAmount: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'shipped' | 'downloaded' | 'toss_failed' | 'recording_failed' | 'temporarily_unavailable'; message: string };

const DOWNLOADED_MESSAGE = '내려받기를 시작한 주문은 여기서 취소할 수 없어요(전자상거래법 제17조 제2항 제5호). 문의는 카카오톡이나 010-4255-7893으로 해 주세요.';

export const cancelShopOrder = async (input: {
  orderNo: string;
  requestedBy: 'customer' | 'admin';
  reason: string;
  now: Date;
}): Promise<ShopCancelOutcome> => {
  const order = await findShopOrderByOrderNo(input.orderNo);
  if (!order || !order.shopOrder) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    return { ok: false, code: 'invalid_state', message: '이미 취소됐거나 결제가 끝나지 않은 주문이에요.' };
  }
  const fulfillment = order.shopOrder.fulfillmentStatus;
  if (fulfillment === 'cancelled') return { ok: false, code: 'invalid_state', message: '이미 취소된 주문이에요.' };
  // 내려받기 기록이 있으면 고객 취소는 막는다. 디지털만 주문은 첫 내려받기가 `delivered`로 닫으므로 이 검사가 먼저 와야 문구가 맞다.
  const customerGuardsDownload = input.requestedBy === 'customer' && order.shopOrder.items.some((i) => isDbSkuId(i.skuId));
  if (customerGuardsDownload) {
    try {
      if ((await getFirstDownloadedAt(order.orderNo)) !== null) return { ok: false, code: 'downloaded', message: DOWNLOADED_MESSAGE };
    } catch (error) {
      console.error('[shop-cancel] 내려받기 기록 확인 실패', { orderNo: order.orderNo, error });
      return { ok: false, code: 'temporarily_unavailable', message: '지금은 취소를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }
  }
  if (input.requestedBy === 'customer' && fulfillment !== 'preparing') {
    return { ok: false, code: 'shipped', message: '이미 보낸 주문은 여기서 취소할 수 없어요. 반품은 카카오톡이나 010-4255-7893으로 문의해 주세요.' };
  }
  const payment = order.payments[0];
  if (!payment || isBankDepositPayment(payment)) {
    // 상점은 토스 결제만 받는다 — 이 분기에 오면 데이터가 어긋난 것이다.
    console.error('[shop-cancel] 토스 결제 행이 없는 상점 주문', { orderNo: order.orderNo });
    return { ok: false, code: 'invalid_state', message: '결제 기록을 찾지 못했어요. 010-4255-7893으로 문의해 주세요.' };
  }

  const db = getDb();
  const claim = await db.run(sql`
    UPDATE shop_orders SET fulfillment_status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
    WHERE order_no = ${order.orderNo} AND fulfillment_status = ${fulfillment}
    ${customerGuardsDownload ? sql`AND NOT EXISTS (SELECT 1 FROM shop_order_downloads WHERE order_no = ${order.orderNo})` : sql``}
  `);
  if (rowsAffectedOf(claim) === 0) {
    // 읽은 뒤에 내려받기가 먼저 기록됐을 수 있다 — 그 경우 문구를 맞춘다.
    if (customerGuardsDownload && (await getFirstDownloadedAt(order.orderNo).catch(() => null)) !== null) {
      return { ok: false, code: 'downloaded', message: DOWNLOADED_MESSAGE };
    }
    return { ok: false, code: 'invalid_state', message: '방금 상태가 바뀌었어요. 화면을 새로고침해 주세요.' };
  }

  const revertClaim = async (): Promise<void> => {
    try {
      await db.run(sql`
        UPDATE shop_orders SET fulfillment_status = ${fulfillment}, cancelled_at = NULL, updated_at = unixepoch()
        WHERE order_no = ${order.orderNo} AND fulfillment_status = 'cancelled'
      `);
    } catch (error) {
      console.error('[shop-cancel] 선점 되돌리기 실패 — 수동 복구 필요', { orderNo: order.orderNo, error });
    }
  };

  const remaining = remainingRefundable(order, order.payments);
  if (remaining <= 0) {
    await revertClaim();
    return { ok: false, code: 'invalid_state', message: '환불할 금액이 남아 있지 않아요.' };
  }

  const cancelInput: CancelInput = { orderNo: order.orderNo, requestedBy: input.requestedBy, reason: input.reason, now: input.now };
  const failure = await settleRefund({
    order, payment, refundAmount: remaining, remaining, input: cancelInput, revertClaim,
    recordFailureLog: '[shop-cancel] 상점 환불 완료, DB 기록 실패',
  });
  if (failure) {
    const code = failure.code === 'not_found' ? 'invalid_state' : failure.code;
    return { ok: false, code, message: failure.message };
  }

  // 한정판 번호 반납 — 발송 전(선점 전 preparing) 전액 취소만. 발송 뒤 반품 환불은 번호를 남긴다.
  if (fulfillment === 'preparing') await releaseOrderSerials(order.orderNo, order.shopOrder.items);

  await sendShopCancelledEmails(order.orderNo, remaining, input.requestedBy);
  return { ok: true, refundAmount: remaining };
};
