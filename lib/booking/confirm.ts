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
  | {
      ok: false;
      code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed';
      message: string;
    };

const GENERIC_TOSS_ERROR_MESSAGE = '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const RECORDING_FAILED_MESSAGE =
  '결제는 완료되었으나 예약 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.';

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
    // CONFIG_ERROR·NETWORK_ERROR는 우리 쪽 설정·네트워크 문제라 원문을 그대로 보이면
    // 내부 구성(비밀키 누락 등)이 새어나간다 — 고객에겐 일반 문구, 원문은 서버 로그에만.
    const isInternalError = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    if (isInternalError) {
      console.error('[booking-confirm] 토스 승인 내부 오류', {
        orderNo: order.orderNo,
        code: toss.code,
        message: toss.message,
      });
    }
    return { ok: false, code: 'toss_rejected', message: isInternalError ? GENERIC_TOSS_ERROR_MESSAGE : toss.message };
  }

  const db = getDb();
  const booking = order.bookings[0];
  try {
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
  } catch (error) {
    // 토스 승인은 이미 끝났다 — 이 실패가 "동시 확정에서 다른 쪽이 이겼다"(멱등, paymentKey
    // unique 위반)인지 "진짜 DB 장애"인지는 payments에 이 paymentKey가 이미 있는지로 가른다.
    const existing = await db.query.payments.findFirst({
      where: (t, { eq }) => eq(t.paymentKey, toss.payment.paymentKey),
    });
    if (existing) return { ok: true, orderNo: order.orderNo };
    console.error('[booking-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', {
      orderNo: order.orderNo,
      paymentKey: toss.payment.paymentKey,
      error,
    });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

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
      try {
        await db
          .update(bookings)
          .set({ gcalError: `create(${kstDateString(new Date())}): ${detail}` })
          .where(eq(bookings.id, booking.id));
      } catch (writeError) {
        console.error('[booking-confirm] gcalError 기록 실패', {
          orderNo: order.orderNo,
          bookingId: booking.id,
          error: writeError,
        });
      }
    }

    const notifyError = await sendBookingConfirmedEmails({ ...order, status: 'paid' }, booking);
    try {
      await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));
    } catch (error) {
      console.error('[booking-confirm] notificationError 기록 실패', {
        orderNo: order.orderNo,
        notifyError,
        error,
      });
    }
  } else {
    // Phase 1에선 발생 불가(주문 생성이 항상 bookings 1건을 동반) — 상태 불변식이 깨졌을 때의 방어 로그.
    console.error('[booking-confirm] bookings 없는 주문 — 후처리 생략', { orderNo: order.orderNo });
  }

  return { ok: true, orderNo: order.orderNo };
};
