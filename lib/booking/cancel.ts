import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, refunds, type Booking, type Order, type Payment, type Refund, type WorkOrder } from '../../db/schema';
import { sendBookingCancelledEmails, sendMixingOrderCancelledEmails } from './email';
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
 *
 * prefix는 "서로 replay되어야 하는 재시도끼리만 같은 키를 쓰게" 하는 네임스페이스다.
 * confirm.ts의 자동 전액 취소는 'autocancel'을 쓴다 — 같은 키를 쓰면 자동 취소가 실패한 뒤
 * 관리자가 같은 금액(전액)으로 넣는 수동 환불이 그 실패 응답을 replay해 영영 나가지 않는다.
 */
export const refundIdempotencyKey = (orderNo: string, refundAmount: number, prefix = 'refund'): string =>
  `${prefix}:${orderNo}:${refundAmount}`;

const RECORDING_FAILED_MESSAGE =
  '환불은 완료되었으나 처리 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.';

const MIXING_STARTED_MESSAGE =
  '작업이 시작된 주문은 온라인으로 취소할 수 없습니다. 010-4255-7893으로 문의해 주세요.';

/**
 * payments 각각의 refunds까지 물고 온 행 — findOrderByOrderNo가 이 형태로 돌려준다.
 *
 * refunds는 **필수**다. optional로 두면 관계 로딩(`with: { refunds: true }`)을 빠뜨린 새 호출자가
 * 타입 검사를 통과한 채 "환불 이력 0건"으로 잘못 계산해 잔액 상한을 총액까지 열어 버린다 —
 * 조용한 과다 환불이라 컴파일 에러로 걸리는 편이 낫다.
 */
type PaymentWithRefunds = Payment & { refunds: Refund[] };

/**
 * 아직 환불하지 않고 남은 금액.
 *
 * 이미 done으로 기록된 환불(부분환불·웹훅 대사 보정 포함)을 총액에서 뺀다. 이 값이 환불액의
 * 상한이다 — 없으면 partially_refunded 주문에 고객이 다시 셀프 취소를 걸었을 때 computeRefund가
 * 총액 기준 티어 금액을 그대로 돌려주고, 그 합이 결제액을 넘어 토스 취소가 거절되거나
 * (잔액이 남아 있으면) 과다 환불로 나간다.
 */
const remainingRefundable = (order: Order, payments: PaymentWithRefunds[]): number => {
  const refunded = payments.reduce(
    (sum, p) => sum + p.refunds.filter((r) => r.status === 'done').reduce((s, r) => s + r.amount, 0),
    0,
  );
  return Math.max(0, order.totalAmount - refunded);
};

const FULLY_REFUNDED_MESSAGE = '이미 전액 환불된 주문입니다.';

export type CancelInput = {
  orderNo: string;
  requestedBy: 'customer' | 'admin';
  reason: string;
  overrideAmount?: number;
  now: Date;
};

/**
 * 관리자 임의 환불액은 0원(당일 취소와 동형의 유효한 액션) 이상 **잔액** 이하의 정수만 허용한다.
 * 상한이 totalAmount가 아니라 remaining인 이유: 이미 일부를 환불한 주문에 총액을 다시 넣으면
 * 토스 잔액을 넘어 거절되거나, 두 번째 결제가 남아 있는 경우 과다 환불이 된다.
 */
const validateOverrideAmount = (remaining: number, input: CancelInput): string | null => {
  if (
    input.requestedBy === 'admin' &&
    typeof input.overrideAmount === 'number' &&
    (!Number.isInteger(input.overrideAmount) || input.overrideAmount < 0 || input.overrideAmount > remaining)
  )
    return '환불 금액이 올바르지 않습니다.';
  return null;
};

/** 토스 취소가 거절됐을 때 로그를 남기고, 내부 오류는 원문을 감춘 일반 문구로 바꾼다(confirm.ts와 동일 원칙). */
const tossFailureMessage = (context: string, orderNo: string, code: string, message: string): string => {
  const isInternalError = code === 'CONFIG_ERROR' || code === 'NETWORK_ERROR';
  if (isInternalError) {
    console.error(`[${context}] 토스 취소 내부 오류`, { orderNo, code, message });
  }
  return isInternalError ? GENERIC_TOSS_ERROR_MESSAGE : message;
};

/** cancelSessionBooking·cancelMixingOrder가 공유하는 실패 결과 타입. */
type CancelFailure = Extract<CancelOutcome, { ok: false }>;

/**
 * 돈을 움직이고 그 사실을 기록하는 구간 — 세션과 믹싱이 완전히 같다.
 *
 * 다른 것은 앞의 선점 방식(bookings vs work_orders)과 뒤의 후처리(캘린더·메일)뿐이라,
 * 그 사이의 "토스 취소 → 실패면 선점 복구 + failed 기록 → 성공이면 refunds 기록 + orders
 * 상태 전이"만 여기로 모았다. 두 벌로 두면 한쪽만 고치는 사고가 난다(잔액 상한·멱등키가
 * 실제로 그렇게 한쪽씩 들어왔다).
 *
 * 성공하면 null, 실패하면 그대로 돌려줄 CancelOutcome을 반환한다.
 *
 * revertClaim이 null이면 되돌릴 선점이 없다는 뜻이다(관리자 추가 환불 경로).
 *
 * ### 동시성에 대해 (알려진 한계, 수용)
 *
 * 추가 환불 경로는 선점이 없다 — 이미 cancelled인 대상을 다시 붙잡을 방법이 없기 때문이다.
 * 그래서 서로 다른 금액의 추가 환불 2건이 동시에 들어오면 둘 다 잔액 검사를 통과하고, 합이
 * 잔액을 넘을 수 있다. 우리 쪽에 원자적 방어를 넣으려면 주문 단위 잠금이나 환불 합계 제약이
 * 필요한데(구조 변경), 그 대신 **토스의 잔액 초과 거절에 의존한다** — 취소 가능 잔액을 넘는
 * 요청은 토스가 거절하므로 실제로 나가는 돈은 잔액을 넘지 않는다.
 *
 * 그 거절이 왔을 때 상태가 오염되지 않는 것이 중요한데, 아래 구조가 그걸 보장한다:
 * 거절된 요청은 `!toss.ok` 분기에서 refunds에 status='failed' 행만 남기고 즉시 반환하며,
 * nextOrderStatus는 그 아래(성공 경로)에서만 계산·기록된다. 즉 실패한 쪽이 성공한 쪽의
 * orders 상태를 덮어쓰지 않고, remainingRefundable도 done 행만 세므로 잔액 계산도 그대로다.
 */
const settleRefund = async (args: {
  order: Order;
  payment: PaymentWithRefunds;
  refundAmount: number;
  remaining: number;
  input: CancelInput;
  revertClaim: (() => Promise<void>) | null;
  /** 기록 실패 로그 문구 — 세션·믹싱 구분용. */
  recordFailureLog: string;
}): Promise<CancelFailure | null> => {
  const { order, payment, refundAmount, remaining, input, revertClaim } = args;
  const db = getDb();
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
      // 승인한다(50% 티어 275,000원 건에서 137,500원 초과 지급). 키가 (주문번호, 환불액)로
      // 결정적이라 그 재시도가 최초 취소의 응답을 그대로 재사용해 실제 취소는 한 번만 일어난다.
      idempotencyKey: refundIdempotencyKey(order.orderNo, refundAmount),
    });
    if (!toss.ok) {
      // 토스가 거절했으니 선점을 되돌린다 — 안 그러면 환불 한 푼 없이 예약만 취소된 채 남는다.
      // 멱등키 덕에 이 되돌림이 이중 환불로 이어지지 않는다(재시도는 같은 키로 replay된다).
      if (revertClaim) await revertClaim();
      // 실패도 이력이다 — 관리자가 재시도할 근거를 남긴다. orders 상태는 건드리지 않는다
      // (위 동시성 절: 거절된 요청이 성공한 요청의 판정을 덮어쓰면 안 된다).
      await db.insert(refunds).values({
        paymentId: payment.id, amount: refundAmount, reason: input.reason,
        requestedBy: input.requestedBy, status: 'failed',
      });
      return {
        ok: false,
        code: 'toss_failed',
        message: tossFailureMessage('booking-cancel', order.orderNo, toss.code, toss.message),
      };
    }
    tossTransactionKey = toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null;
  }

  // 이번 환불까지 더해 총액에 도달했는지로 판정한다 — 이미 부분환불된 주문의 잔액을 마저
  // 환불하면 refundAmount 자체는 총액에 못 미쳐도 결과는 전액 환불이다.
  const nextOrderStatus = refundAmount >= remaining ? 'refunded'
    : refundAmount > 0 ? 'partially_refunded' : order.status;

  try {
    // 예약·주문은 이미 위 선점에서 cancelled로 넘어갔다 — 여기선 refunds 기록과 orders 상태 전이만 한다.
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
    // 복구는 토스가 보내는 CANCELED 웹훅이 맡는다: 그 시점엔 대상이 이미 cancelled라 선점할 게
    // 없으므로, webhook.ts의 대사 보정(reconcileRefunds)이 토스 취소 합계와 우리 refunds 합계의
    // 차액을 refunds에 채워 넣고 orders 상태를 맞춘다.
    console.error(args.recordFailureLog, { orderNo: order.orderNo, refundAmount, error });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

  return null;
};

/** notificationError 기록은 세 경로가 똑같이 쓴다 — 실패해도 취소 결과를 뒤집지 않는다. */
const recordNotificationError = async (orderId: string, orderNo: string, notifyError: string | null): Promise<void> => {
  try {
    await getDb().update(orders).set({ notificationError: notifyError }).where(eq(orders.id, orderId));
  } catch (error) {
    console.error('[booking-cancel] notificationError 기록 실패', { orderNo, notifyError, error });
  }
};

/**
 * 세션 예약(bookings) 취소 — 이용일 기준 3단계 환불(refund-policy.ts REFUND_TIERS)이고,
 * 고객 셀프 취소는 이용 시작 전에만 가능하다.
 */
const cancelSessionBooking = async (
  order: Order & { bookings: Booking[]; payments: PaymentWithRefunds[] },
  payment: PaymentWithRefunds | undefined,
  input: CancelInput,
): Promise<CancelOutcome> => {
  const booking = order.bookings[0];
  if (!booking || !payment)
    return { ok: false, code: 'invalid_state', message: '취소할 수 있는 상태가 아닙니다.' };

  // 관리자 추가 환불: 이미 취소된 예약에 부분환불만 나간 상태라면 잔액을 더 돌려줄 수 있어야
  // 한다(믹싱 cancelMixingOrder와 대칭). 선점할 대상이 없으므로 claim UPDATE를 건너뛰고,
  // 후처리(캘린더 삭제·취소 메일)도 하지 않는다 — 예약은 이미 취소됐고 고객은 이미 취소
  // 안내를 받았다. 여기서 또 "예약이 취소되었습니다"를 보내면 없는 취소를 다시 알리는 꼴이다.
  const isAdditionalRefund =
    input.requestedBy === 'admin' && booking.status === 'cancelled' && order.status === 'partially_refunded';

  const cancellable =
    isAdditionalRefund ||
    ((order.status === 'paid' || order.status === 'partially_refunded') && booking.status === 'confirmed');
  if (!cancellable)
    return { ok: false, code: 'invalid_state', message: '취소할 수 있는 상태가 아닙니다.' };

  // 고객 셀프 취소는 이용 시작 전에만 — 시작 후 처리는 관리자의 몫(노쇼/완료/임의 환불).
  if (input.requestedBy === 'customer' && booking.startAt.getTime() <= input.now.getTime())
    return { ok: false, code: 'invalid_state', message: '이용 시작 후에는 온라인 취소가 불가합니다.' };

  const remaining = remainingRefundable(order, order.payments);
  if (remaining <= 0) return { ok: false, code: 'invalid_state', message: FULLY_REFUNDED_MESSAGE };

  const overrideError = validateOverrideAmount(remaining, input);
  if (overrideError) return { ok: false, code: 'invalid_state', message: overrideError };

  // 잔액이 상한 — computeRefund는 총액 기준 티어라 부분환불 이력이 있으면 잔액을 넘을 수 있다.
  const refundAmount = Math.min(
    input.requestedBy === 'admin' && typeof input.overrideAmount === 'number'
      ? input.overrideAmount
      : computeRefund(order.totalAmount, booking.startAt, input.now).refundAmount,
    remaining,
  );

  const db = getDb();

  // 원자적 선점 — 돈이 나가기 전에 이 요청만 이 예약을 쥔다. 동시 셀프 취소 2건이 둘 다 위
  // 상태 검사를 통과해도(읽기 시점엔 둘 다 confirmed), UPDATE...WHERE status='confirmed'는
  // 하나만 rowsAffected 1을 받는다. 진 쪽은 토스를 아예 부르지 않는다 — 이렇게 하지 않으면
  // 50% 환불 구간에서 두 요청 모두 검사를 통과해 토스가 둘 다 승인해 버려(합이 잔액과 같음)
  // 이중 환불로 이어진다.
  if (!isAdditionalRefund) {
    const claim = await db.run(
      sql`UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch() WHERE id = ${booking.id} AND status = 'confirmed'`,
    );
    if (Number(claim.rowsAffected) === 0)
      return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 예약입니다.' };
  }

  const failure = await settleRefund({
    order, payment, refundAmount, remaining, input,
    revertClaim: isAdditionalRefund
      ? null
      : async () => {
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
        },
    recordFailureLog: '[booking-cancel] 환불 완료, DB 기록 실패',
  });
  if (failure) return failure;

  // 추가 환불은 이미 취소된 예약에 잔액만 더 돌려주는 것이라 후처리가 없다 — 지울 캘린더
  // 이벤트도(첫 취소에서 이미 지웠다), 다시 보낼 취소 메일도 없다.
  if (isAdditionalRefund) return { ok: true, refundAmount };

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

  await recordNotificationError(order.id, order.orderNo, await sendBookingCancelledEmails(order, booking, refundAmount));

  return { ok: true, refundAmount };
};

/**
 * 믹싱·마스터링 주문(work_orders) 취소.
 *
 * 세션과 달리 날짜 기준 환불 단계가 없다 — "작업 착수" 이전/이후 단 하나의 경계로 나뉜다
 * (계획서 §4, 2026-09-09 사업 판단). 착수 전(received)이면 고객도 관리자도 취소·전액 환불이
 * 가능하고, 착수 후(in_progress·delivered)에는 관리자 임의 환불만 남는다 — 이미 엔지니어
 * 시간이 들어갔기 때문이다.
 */
const cancelMixingOrder = async (
  order: Order & { payments: PaymentWithRefunds[] },
  workOrder: WorkOrder | undefined,
  payment: PaymentWithRefunds | undefined,
  input: CancelInput,
): Promise<CancelOutcome> => {
  if (!workOrder || !payment || !(order.status === 'paid' || order.status === 'partially_refunded'))
    return { ok: false, code: 'invalid_state', message: '취소할 수 있는 상태가 아닙니다.' };

  // 관리자 추가 환불: 이미 취소 처리된 주문(work_order cancelled)에 부분환불만 나간 상태라면
  // 잔액을 더 돌려줄 수 있어야 한다. 이 경우 선점할 대상이 없으므로(이미 cancelled) 아래
  // claim UPDATE를 건너뛴다 — 그대로 두면 rowsAffected 0으로 "이미 취소된 주문"에 막혀
  // 관리자가 잔액을 영영 환불하지 못한다. cancelSessionBooking에 같은 경로가 있다.
  const isAdditionalRefund =
    input.requestedBy === 'admin' && workOrder.status === 'cancelled' && order.status === 'partially_refunded';

  if (input.requestedBy === 'customer') {
    if (workOrder.status === 'in_progress' || workOrder.status === 'delivered')
      return { ok: false, code: 'invalid_state', message: MIXING_STARTED_MESSAGE };
    if (workOrder.status !== 'received')
      return { ok: false, code: 'invalid_state', message: '취소할 수 있는 상태가 아닙니다.' };
  } else if (
    !isAdditionalRefund &&
    workOrder.status !== 'received' &&
    workOrder.status !== 'in_progress' &&
    workOrder.status !== 'delivered'
  ) {
    return { ok: false, code: 'invalid_state', message: '취소할 수 있는 상태가 아닙니다.' };
  }

  const remaining = remainingRefundable(order, order.payments);
  if (remaining <= 0) return { ok: false, code: 'invalid_state', message: FULLY_REFUNDED_MESSAGE };

  const overrideError = validateOverrideAmount(remaining, input);
  if (overrideError) return { ok: false, code: 'invalid_state', message: overrideError };

  // 착수 전 취소는 전액(=잔액), 관리자 임의 환불은 지정액 — 세션의 날짜별 티어 대신 이 상품군은
  // "착수 여부" 하나로만 갈린다(MIXING_REFUND_POLICY_LINES).
  const refundAmount = Math.min(
    input.requestedBy === 'admin' && typeof input.overrideAmount === 'number'
      ? input.overrideAmount
      : order.totalAmount,
    remaining,
  );

  const db = getDb();

  // 원자적 선점 — cancelSessionBooking과 같은 이유. 읽은 시점의 status로 조건을 걸어야
  // received에서 눌렀는데 그 사이 관리자가 착수 처리한 경합도 안전하게 걸러진다.
  if (!isAdditionalRefund) {
    const claim = await db.run(
      sql`UPDATE work_orders SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch() WHERE id = ${workOrder.id} AND status = ${workOrder.status}`,
    );
    if (Number(claim.rowsAffected) === 0)
      return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 주문입니다.' };
  }

  const failure = await settleRefund({
    order, payment, refundAmount, remaining, input,
    revertClaim: isAdditionalRefund
      ? null
      : async () => {
          try {
            await db.run(
              sql`UPDATE work_orders SET status = ${workOrder.status}, cancelled_at = NULL, updated_at = unixepoch() WHERE id = ${workOrder.id} AND status = 'cancelled'`,
            );
          } catch (revertError) {
            console.error('[booking-cancel] 믹싱 선점 revert 실패 — 수동 복구 필요', {
              orderNo: order.orderNo,
              error: revertError,
            });
          }
        },
    recordFailureLog: '[booking-cancel] 믹싱 환불 완료, DB 기록 실패',
  });
  if (failure) return failure;

  // 후처리 — 캘린더 삭제 없음(믹싱은 슬롯이 없다).
  //
  // 세션의 추가 환불 경로는 취소 메일을 생략하는데 여기서는 종전대로 보낸다. 의도적인
  // 비대칭이다: 이 경로의 메일은 환불 금액을 함께 알리므로 "잔액이 얼마 더 나갔다"는
  // 유일한 고객 통지이고, 기존 동작을 이번 정리에서 조용히 바꾸지 않는다. 문구가 "주문이
  // 취소되었습니다"로 시작해 중복 안내처럼 읽히는 건 남은 숙제다(메일 문구 쪽에서 풀 일).
  await recordNotificationError(
    order.id, order.orderNo, await sendMixingOrderCancelledEmails(order, workOrder, refundAmount),
  );

  return { ok: true, refundAmount };
};

export const cancelBookingWithRefund = async (input: CancelInput): Promise<CancelOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  if (order.type === 'mixing') return cancelMixingOrder(order, order.workOrders[0], order.payments[0], input);
  return cancelSessionBooking(order, order.payments[0], input);
};
