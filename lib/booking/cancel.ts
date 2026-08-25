import { eq, sql } from 'drizzle-orm';

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

  // 관리자 임의 환불액은 0원(당일 취소와 동형의 유효한 액션) 이상 총액 이하의 정수만 허용한다.
  if (
    input.requestedBy === 'admin' &&
    typeof input.overrideAmount === 'number' &&
    (!Number.isInteger(input.overrideAmount) || input.overrideAmount < 0 || input.overrideAmount > order.totalAmount)
  )
    return { ok: false, code: 'invalid_state', message: '환불 금액이 올바르지 않습니다.' };

  const refundAmount = input.requestedBy === 'admin' && typeof input.overrideAmount === 'number'
    ? input.overrideAmount
    : computeRefund(order.totalAmount, booking.startAt, input.now).refundAmount;

  const db = getDb();

  // 원자적 선점 — 돈이 나가기 전에 이 요청만 이 예약을 쥔다. 동시 셀프 취소 2건이 둘 다 위
  // 상태 검사를 통과해도(읽기 시점엔 둘 다 confirmed), UPDATE...WHERE status='confirmed'는
  // 하나만 rowsAffected 1을 받는다. 진 쪽은 토스를 아예 부르지 않는다 — 이렇게 하지 않으면
  // 50% 환불 구간에서 두 요청 모두 검사를 통과해 토스가 둘 다 승인해 버려(합이 잔액과 같음)
  // 이중 환불로 이어진다.
  const claim = await db.run(
    sql`UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch() WHERE id = ${booking.id} AND status = 'confirmed'`,
  );
  if (Number(claim.rowsAffected) === 0)
    return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 예약입니다.' };

  let tossTransactionKey: string | null = null;

  if (refundAmount > 0) {
    const toss = await cancelPayment({
      paymentKey: payment.paymentKey,
      cancelReason: input.reason,
      cancelAmount: refundAmount,
    });
    if (!toss.ok) {
      // 토스가 거절했으니 선점을 되돌린다 — 안 그러면 환불 한 푼 없이 예약만 취소된 채 남는다.
      try {
        await db.run(
          sql`UPDATE bookings SET status = 'confirmed', cancelled_at = NULL, updated_at = unixepoch() WHERE id = ${booking.id} AND status = 'cancelled'`,
        );
      } catch (revertError) {
        console.error('[booking-cancel] 선점 revert 실패 — 수동 복구 필요', {
          orderNo: order.orderNo,
          error: revertError,
        });
      }
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
    // bookings는 이미 위 선점에서 cancelled로 넘어갔다 — 여기선 refunds 기록과 orders 상태 전이만 한다.
    await db.batch([
      db.insert(refunds).values({
        paymentId: payment.id, amount: refundAmount, reason: input.reason,
        requestedBy: input.requestedBy, tossTransactionKey, status: 'done',
      }),
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
