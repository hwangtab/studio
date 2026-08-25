import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, refunds } from '../../db/schema';
import { sendBookingCancelledEmails } from './email';
import { deleteBookingEvent } from './gcal';
import { computeRefund } from './refund-policy';
import { findOrderByOrderNo } from './service';
import { cancelPayment } from './toss';

export type CancelOutcome =
  | { ok: true; refundAmount: number }
  | {
      ok: false;
      code: 'not_found' | 'invalid_state' | 'toss_failed' | 'recording_failed';
      message: string;
    };

const GENERIC_TOSS_ERROR_MESSAGE = '취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const RECORDING_FAILED_MESSAGE =
  '환불은 완료되었으나 처리 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.';

export const cancelBookingWithRefund = async (input: {
  orderNo: string;
  requestedBy: 'customer' | 'admin';
  reason: string;
  overrideAmount?: number;
  now: Date;
}): Promise<CancelOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  const booking = order.bookings[0];
  const payment = order.payments[0];
  const cancellable = (order.status === 'paid' || order.status === 'partially_refunded') && booking?.status === 'confirmed';
  if (!cancellable || !payment)
    return { ok: false, code: 'invalid_state', message: '취소할 수 있는 상태가 아닙니다.' };

  // 고객 셀프 취소는 이용 시작 전에만 — 시작 후 처리는 관리자의 몫(노쇼/완료/임의 환불).
  if (input.requestedBy === 'customer' && booking.startAt.getTime() <= input.now.getTime())
    return { ok: false, code: 'invalid_state', message: '이용 시작 후에는 온라인 취소가 불가합니다.' };

  const refundAmount = input.requestedBy === 'admin' && typeof input.overrideAmount === 'number'
    ? input.overrideAmount
    : computeRefund(order.totalAmount, booking.startAt, input.now).refundAmount;

  const db = getDb();
  let tossTransactionKey: string | null = null;

  if (refundAmount > 0) {
    const toss = await cancelPayment({
      paymentKey: payment.paymentKey,
      cancelReason: input.reason,
      cancelAmount: refundAmount,
    });
    if (!toss.ok) {
      // 실패도 이력이다 — 관리자가 재시도할 근거를 남긴다.
      await db.insert(refunds).values({
        paymentId: payment.id, amount: refundAmount, reason: input.reason,
        requestedBy: input.requestedBy, status: 'failed',
      });
      // CONFIG_ERROR·NETWORK_ERROR는 우리 쪽 설정·네트워크 문제라 원문을 그대로 보이면
      // 내부 구성(비밀키 누락 등)이 새어나간다 — 고객에겐 일반 문구, 원문은 서버 로그에만(confirm.ts와 동일 원칙).
      const isInternalError = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
      if (isInternalError) {
        console.error('[booking-cancel] 토스 취소 내부 오류', {
          orderNo: order.orderNo,
          code: toss.code,
          message: toss.message,
        });
      }
      return { ok: false, code: 'toss_failed', message: isInternalError ? GENERIC_TOSS_ERROR_MESSAGE : toss.message };
    }
    tossTransactionKey = toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null;
  }

  const nextOrderStatus = refundAmount >= order.totalAmount ? 'refunded'
    : refundAmount > 0 ? 'partially_refunded' : order.status;

  try {
    await db.batch([
      db.insert(refunds).values({
        paymentId: payment.id, amount: refundAmount, reason: input.reason,
        requestedBy: input.requestedBy, tossTransactionKey, status: 'done',
      }),
      db.update(bookings)
        .set({ status: 'cancelled', cancelledAt: input.now, updatedAt: input.now })
        .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'confirmed'))),
      db.update(orders)
        .set({ status: nextOrderStatus, updatedAt: input.now })
        .where(eq(orders.id, order.id)),
    ]);
  } catch (error) {
    // 토스 취소는 이미 끝났다 — 웹훅 CANCELED 이벤트가 상태를 복구하므로 여기서는 삼키되 기록한다
    // (confirm.ts의 recording_failed와 동일 원칙 — 다만 여기선 멱등 판정을 위한 재조회가 필요 없다).
    console.error('[booking-cancel] 환불 완료, DB 기록 실패', {
      orderNo: order.orderNo,
      refundAmount,
      error,
    });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

  // 후처리 — 환불은 끝났으므로 실패를 삼키되 기록 (confirm.ts와 동일 원칙).
  if (booking.gcalEventId) {
    try {
      await deleteBookingEvent(booking.gcalEventId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      try {
        await db.update(bookings).set({ gcalError: `delete: ${detail}` }).where(eq(bookings.id, booking.id));
      } catch (writeError) {
        console.error('[booking-cancel] gcalError 기록 실패', {
          orderNo: order.orderNo,
          bookingId: booking.id,
          error: writeError,
        });
      }
    }
  }

  const notifyError = await sendBookingCancelledEmails(order, booking, refundAmount);
  try {
    await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));
  } catch (error) {
    console.error('[booking-cancel] notificationError 기록 실패', {
      orderNo: order.orderNo,
      notifyError,
      error,
    });
  }

  return { ok: true, refundAmount };
};
