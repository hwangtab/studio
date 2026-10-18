import { sql } from 'drizzle-orm';

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
  // 원본 일정이 남은 예약은 지우지 않는다 — 표시(메모)가 사라지면 다음 자동 등록이 그 원본을 새 예약으로 되살린다.
  if (order.bookings.some((b) => (b.customerNote ?? '').includes('[원본 일정이 남아 있음:'))) {
    return { ok: false, code: 'not_allowed', message: '캘린더에 원래 일정이 남아 있어요. 캘린더에서 그 일정을 먼저 지운 뒤 삭제해 주세요.' };
  }
  const refundAccounts = await db.all<{ id: string }>(sql`SELECT id FROM refund_accounts WHERE order_no = ${order.orderNo} LIMIT 1`);
  if (refundAccounts.length > 0) return { ok: false, code: 'not_allowed', message: '환불 계좌 기록이 있어 삭제할 수 없어요.' };

  await db.batch([
    // 자식 행에도 같은 상태 조건을 건다 — 검사와 삭제 사이에 주문 상태가 바뀌었으면 자식만 지워지고 주문이 남는 일이 없게.
    db.delete(reviewRequests).where(sql`${reviewRequests.orderId} = ${order.id} AND ${order.id} IN (SELECT id FROM orders WHERE status = 'deposit_cancelled')`),
    db.delete(bookings).where(sql`${bookings.orderId} = ${order.id} AND ${order.id} IN (SELECT id FROM orders WHERE status = 'deposit_cancelled')`),
    db.delete(workOrders).where(sql`${workOrders.orderId} = ${order.id} AND ${order.id} IN (SELECT id FROM orders WHERE status = 'deposit_cancelled')`),
    db.delete(orders).where(sql`${orders.id} = ${order.id} AND ${orders.status} = 'deposit_cancelled'`),
  ]);
  console.warn('[admin] 입금 전 취소 기록 삭제', { orderNo: order.orderNo, type: order.type });
  return { ok: true, orderNo: order.orderNo };
};
