import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, reviewRequests, workOrders } from '../../db/schema';

/**
 * **입금 전에 취소된 신청 기록 삭제**(관리자) — 테스트로 만든 예약·잘못 올린 수기 등록을 목록에서 지운다.
 *
 * 돈이 한 번도 오가지 않은 기록만 지운다. 결제 행(payments)이 하나라도 있으면 매출·환불 장부의 근거라 거절한다 —
 * 그 경우는 환불 흐름으로 정리한다. 조건: 세션·믹싱 주문, `deposit_cancelled`, 결제 행 없음, 환불 계좌 없음,
 * 남은 캘린더 일정(`gcal_event_id`) 없음(남은 [입금 대기] 일정이 웹 예약을 막고 있으면 먼저 "대기 일정 지우기").
 * 삭제는 한 batch — 자식 행(후기 요청·예약·작업·주문) 순서로 지운다.
 */

export type DeleteUnpaidResult =
  | { ok: true; orderNo: string }
  | { ok: false; code: 'not_found' | 'not_allowed'; message: string };

export const deleteUnpaidCancelledOrder = async (orderId: string): Promise<DeleteUnpaidResult> => {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (t, { eq: eqCol }) => eqCol(t.id, orderId),
    with: { bookings: true, payments: true },
  });
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  if ((order.type !== 'session' && order.type !== 'mixing') || order.status !== 'deposit_cancelled') {
    return { ok: false, code: 'not_allowed', message: '입금 전에 취소된 세션·믹싱 신청만 삭제할 수 있어요.' };
  }
  if (order.payments.length > 0) return { ok: false, code: 'not_allowed', message: '결제 기록이 있어 삭제할 수 없어요.' };
  if (order.bookings.some((b) => b.gcalEventId)) {
    return { ok: false, code: 'not_allowed', message: '구글 캘린더에 남은 일정이 있어요. 먼저 “대기 일정 지우기”를 눌러 주세요.' };
  }
  const refundAccounts = await db.all<{ id: string }>(sql`SELECT id FROM refund_accounts WHERE order_no = ${order.orderNo} LIMIT 1`);
  if (refundAccounts.length > 0) return { ok: false, code: 'not_allowed', message: '환불 계좌 기록이 있어 삭제할 수 없어요.' };

  await db.batch([
    db.delete(reviewRequests).where(eq(reviewRequests.orderId, order.id)),
    db.delete(bookings).where(eq(bookings.orderId, order.id)),
    db.delete(workOrders).where(eq(workOrders.orderId, order.id)),
    // 마지막 가드: 그 사이 상태가 바뀌었으면(0행) 주문은 남는다.
    db.delete(orders).where(sql`${orders.id} = ${order.id} AND ${orders.status} = 'deposit_cancelled'`),
  ]);
  console.warn('[admin] 입금 전 취소 기록 삭제', { orderNo: order.orderNo, type: order.type });
  return { ok: true, orderNo: order.orderNo };
};
