import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, payments } from '../../db/schema';
import { sendBookingConfirmedEmails } from './email';
import { createBookingEvent } from './gcal';
import { findOrderByOrderNo } from './service';
import { confirmPayment } from './toss';
import { kstDateString } from './kst';

export type ConfirmOutcome =
  | { ok: true; orderNo: string }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected'; message: string };

export const confirmBookingPayment = async (input: {
  orderNo: string;
  paymentKey: string;
  amount: number;
}): Promise<ConfirmOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  // success 페이지 새로고침·웹훅 중복 도착 멱등성 — 이미 확정이면 성공으로 답한다.
  if (order.status === 'paid') return { ok: true, orderNo: order.orderNo };
  if (order.status !== 'pending')
    return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 주문입니다.' };

  // 서버가 저장한 금액이 유일한 진실 — 다르면 토스를 부르지도 않는다(위변조 차단).
  if (input.amount !== order.totalAmount)
    return { ok: false, code: 'amount_mismatch', message: '결제 금액이 주문과 일치하지 않습니다.' };

  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount });
  if (!toss.ok) {
    const db = getDb();
    await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    return { ok: false, code: 'toss_rejected', message: toss.message };
  }

  const db = getDb();
  const booking = order.bookings[0];
  // payments INSERT가 맨 앞 — paymentKey unique 위반이 동시 확정의 두 번째 시도를
  // batch 전체 실패로 만든다(절반만 쓰인 상태가 남지 않는다).
  await db.batch([
    db.insert(payments).values({
      orderId: order.id,
      paymentKey: toss.payment.paymentKey,
      method: toss.payment.method ?? null,
      approvedAt: toss.payment.approvedAt ? new Date(toss.payment.approvedAt) : null,
      receiptUrl: toss.payment.receipt?.url ?? null,
      rawResponse: JSON.stringify(toss.payment),
    }),
    db.update(orders)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'pending'))),
    db.update(bookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(eq(bookings.orderId, order.id), eq(bookings.status, 'pending'))),
  ]);

  // 후처리 — 결제는 이미 성공했으므로 실패를 삼키되 반드시 기록한다 (스펙 §10).
  if (booking) {
    try {
      const eventId = await createBookingEvent({
        summary: `[예약] ${booking.serviceType} — ${order.customerName}`,
        description: [
          `상품: ${booking.productId} (${booking.durationHours}시간)`,
          `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
          `주문번호: ${order.orderNo}`,
          `요청사항: ${booking.customerNote ?? '없음'}`,
        ].join('\n'),
        start: booking.startAt,
        end: booking.endAt,
      });
      await db.update(bookings).set({ gcalEventId: eventId }).where(eq(bookings.id, booking.id));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await db.update(bookings).set({ gcalError: `create(${kstDateString(new Date())}): ${detail}` }).where(eq(bookings.id, booking.id));
    }

    const notifyError = await sendBookingConfirmedEmails({ ...order, status: 'paid' }, booking);
    await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));
  }

  return { ok: true, orderNo: order.orderNo };
};
