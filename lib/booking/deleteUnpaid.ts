import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, reviewRequests, workOrders } from '../../db/schema';
import { DELETABLE_UNPAID_STATUSES, EXPIRED_DELETE_AFTER_MS } from './unpaidDeletePolicy';

/**
 * **돈이 오가지 않은 신청 기록 삭제**(관리자) — 테스트로 만든 예약·잘못 올린 수기 등록을 목록에서 지운다.
 *
 * 대상 상태: 입금 전 취소(`deposit_cancelled`), 그리고 카드 결제창을 열었다가 끝내지 않은 만료(`expired`)·실패(`failed`)
 * (운영자 요청 2026-10-23 — 테스트 주문이 "만료"로 쌓여 지울 길이 없었다). 만료·실패는 **만든 지 하루가 지난 것만** 지운다 —
 * 결제창에서 승인은 났는데 성공 화면을 못 거친 결제는 토스 웹훅이 뒤늦게 주문을 찾아 확정하는데, 그 전에 주문을 지우면
 * 받은 돈이 붙을 곳을 잃는다.
 *
 * 돈이 한 번도 오가지 않은 기록만 지운다. 결제 행(payments)이 하나라도 있으면 매출·환불 장부의 근거라 거절한다 —
 * 그 경우는 환불 흐름으로 정리한다. 조건: 세션·믹싱 주문, 위 상태, 결제 행 없음, 환불 계좌 없음,
 * 남은 캘린더 일정(`gcal_event_id`) 없음(남은 [입금 대기] 일정이 웹 예약을 막고 있으면 먼저 "대기 일정 지우기").
 * 삭제는 한 batch — 자식 행(후기 요청·예약·작업·주문) 순서로 지운다.
 */

export type DeleteUnpaidResult =
  | { ok: true; orderNo: string }
  | { ok: false; code: 'not_found' | 'not_allowed'; message: string };

export const deleteUnpaidCancelledOrder = async (orderId: string, now: Date = new Date()): Promise<DeleteUnpaidResult> => {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (t, { eq: eqCol }) => eqCol(t.id, orderId),
    with: { bookings: true, payments: true },
  });
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  const status = order.status;
  if ((order.type !== 'session' && order.type !== 'mixing') || !(DELETABLE_UNPAID_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, code: 'not_allowed', message: '입금 전 취소·만료·결제 실패인 세션·믹싱 신청만 삭제할 수 있어요.' };
  }
  if (status !== 'deposit_cancelled' && now.getTime() - order.createdAt.getTime() < EXPIRED_DELETE_AFTER_MS) {
    return { ok: false, code: 'not_allowed', message: '만든 지 하루가 지나야 삭제할 수 있어요(늦게 도착하는 결제 승인을 기다립니다).' };
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

  // 자식 행에도 같은 조건(읽은 상태 그대로 + 결제 행 없음)을 건다 — 검사와 삭제 사이에 상태가 바뀌거나 늦은 승인이 결제 행을
  // 남겼으면 자식만 지워지고 주문이 남거나, 결제가 붙은 주문이 지워지는 일이 없게.
  const stillDeletable = sql`${order.id} IN (SELECT id FROM orders WHERE status = ${status}) AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ${order.id})`;
  await db.batch([
    db.delete(reviewRequests).where(sql`${reviewRequests.orderId} = ${order.id} AND ${stillDeletable}`),
    db.delete(bookings).where(sql`${bookings.orderId} = ${order.id} AND ${stillDeletable}`),
    db.delete(workOrders).where(sql`${workOrders.orderId} = ${order.id} AND ${stillDeletable}`),
    // 결제창 연 기록 — FK가 cascade지만 외래 키 검사가 꺼진 연결에서도 고아로 남지 않게 직접 지운다(표가 없는 DB는 없다: 0042).
    db.run(sql`DELETE FROM payment_window_opens WHERE order_id = ${order.id} AND ${stillDeletable}`),
    db.delete(orders).where(sql`${orders.id} = ${order.id} AND ${stillDeletable}`),
  ]);
  console.warn('[admin] 돈이 오가지 않은 기록 삭제', { orderNo: order.orderNo, type: order.type, status });
  return { ok: true, orderNo: order.orderNo };
};
