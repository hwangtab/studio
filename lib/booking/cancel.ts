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
/**
 * 토스 취소 요청의 멱등키.
 *
 * (주문번호, 환불액)으로 결정적이어야 한다 — 타임아웃 후 고객·관리자가 다시 취소를 눌러도
 * 같은 키가 만들어져야 토스가 최초 취소를 replay하기 때문이다. 랜덤 UUID를 쓰면 이 보호가
 * 통째로 사라진다. 토스 규격: 최대 300자, 첫 요청일로부터 15일 유효
 * (https://docs.tosspayments.com/reference/using-api/authorization).
 *
 * 알려진 한계: 관리자가 "같은 주문에 같은 금액"을 15일 안에 두 번 나눠 환불하려는 경우
 * 두 번째가 replay된다. 부분환불 두 번을 같은 금액으로 쪼개 넣는 운영은 없고, 있다 해도
 * 이중 환불 사고보다 훨씬 가벼운 실패 방향이라 감수한다.
 */
const refundIdempotencyKey = (orderNo: string, refundAmount: number): string =>
  `refund:${orderNo}:${refundAmount}`;

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
      // 재시도가 돈을 두 번 내보내지 못하게 하는 유일한 장치. cancelPayment의 NETWORK_ERROR는
      // "요청이 안 닿았다"와 "토스는 취소했는데 12초 타임아웃으로 응답만 못 받았다"를 구분하지
      // 못한다 — 후자에서 아래 revert가 예약을 confirmed로 되돌리면 고객이 다시 취소를 눌렀을 때
      // computeRefund가 같은 부분환불액을 또 계산하고, 잔액이 남아 있어 토스가 두 번째 취소도
      // 승인한다(50% 티어 275,000원 건에서 137,500원 초과 지급). 키가 (orderNo, 환불액)로
      // 결정적이라 그 재시도가 최초 취소의 응답을 그대로 재사용해 실제 취소는 한 번만 일어난다.
      idempotencyKey: refundIdempotencyKey(order.orderNo, refundAmount),
    });
    if (!toss.ok) {
      // 토스가 거절했으니 선점을 되돌린다 — 안 그러면 환불 한 푼 없이 예약만 취소된 채 남는다.
      // 멱등키 덕에 이 되돌림이 이중 환불로 이어지지 않는다(재시도는 같은 키로 replay된다).
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
    // 토스 취소는 이미 끝났다 — 여기서는 삼키되 기록한다(confirm.ts의 recording_failed와 동일 원칙).
    // 복구는 토스가 보내는 CANCELED 웹훅이 맡는다: 그 시점엔 booking이 이미 cancelled라
    // 선점할 게 없으므로, webhook.ts의 대사 보정(reconcileRefunds)이 토스 취소 합계와 우리
    // refunds 합계의 차액을 refunds에 채워 넣고 orders 상태를 맞춘다.
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
