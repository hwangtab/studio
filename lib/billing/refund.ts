import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, payments, refunds, subscriptionPayments } from '../../db/schema';
import { remainingRefundable, settleRefund, type CancelFailure } from '../booking/cancel';

/**
 * 구독 회차 환불.
 *
 * 회차마다 orders 1건 + payments 1건이 남으므로(chargeCycle) 돈을 되돌리는 구간은 예약·믹싱과
 * 완전히 같다 — 토스 취소 → refunds 기록 → orders 상태 전이. 그래서 cancel.ts의 settleRefund를
 * 그대로 쓴다. 다른 점은 **되돌릴 선점이 없다**는 것뿐이다: 구독 자체(subscriptions)와 회차
 * (subscriptionPayments)의 상태는 환불의 부작용으로 바꾸지 않는다. 정지·해지는 관리자 화면의
 * 별도 조작이고, 웹훅의 CANCELED 처리(lib/booking/webhook.ts)도 같은 판단을 이미 하고 있다.
 *
 * 예전엔 이 경로가 없어 화면이 "토스 콘솔에서 직접 취소하라"고 안내했다. 콘솔에서 취소하면
 * 웹훅이 refunds를 채우긴 하지만, 사유가 남지 않고(refunds.reason이 웹훅 문구가 된다) 운영자가
 * 두 화면을 오가야 했다. 건강 점검의 "구독이 끝난 뒤에 들어온 결제"도 여기서 풀린다 —
 * 환불하면 orders.status가 refunded로 바뀌어 그 점검에서 빠진다.
 */
export type RefundSubscriptionPaymentInput = {
  subscriptionId: string;
  subscriptionPaymentId: string;
  reason: string;
  /** 생략하면 잔액 전액. 0 < amount ≤ 잔액의 정수만 허용한다. */
  amount?: number;
  now: Date;
};

export type RefundSubscriptionPaymentOutcome =
  | { ok: true; refundAmount: number; orderNo: string; cycleYm: string; isFull: boolean }
  | CancelFailure;

export const refundSubscriptionPayment = async (
  input: RefundSubscriptionPaymentInput,
): Promise<RefundSubscriptionPaymentOutcome> => {
  const db = getDb();

  const cycle = await db.query.subscriptionPayments.findFirst({
    where: (t, { eq: is, and: both }) =>
      both(is(t.id, input.subscriptionPaymentId), is(t.subscriptionId, input.subscriptionId)),
    with: { order: { with: { payments: { with: { refunds: true } } } } },
  });
  if (!cycle || !cycle.order) return { ok: false, code: 'not_found', message: '회차를 찾을 수 없습니다.' };
  if (cycle.status !== 'paid') {
    return { ok: false, code: 'invalid_state', message: '결제가 완료된 회차만 환불할 수 있습니다.' };
  }

  const order = cycle.order;
  const payment = order.payments[0];
  if (!payment) {
    // 회차는 paid인데 승인 기록이 없다 — 결제 기록과 주문 상태가 어긋난 건이라 토스 콘솔 대조가 먼저다.
    return { ok: false, code: 'invalid_state', message: '결제 기록이 없어 환불할 수 없습니다. 토스 콘솔에서 확인해 주세요.' };
  }

  const remaining = remainingRefundable(order, order.payments);
  if (remaining <= 0) return { ok: false, code: 'invalid_state', message: '이미 전액 환불된 회차입니다.' };

  const refundAmount = input.amount ?? remaining;
  if (!Number.isInteger(refundAmount) || refundAmount <= 0 || refundAmount > remaining) {
    return { ok: false, code: 'invalid_state', message: `환불 금액은 1원 이상 ${remaining.toLocaleString('ko-KR')}원 이하의 정수여야 합니다.` };
  }

  const failure = await settleRefund({
    order,
    payment,
    refundAmount,
    remaining,
    input: { orderNo: order.orderNo, requestedBy: 'admin', reason: input.reason, now: input.now },
    // 회차·구독 상태는 환불로 바꾸지 않는다 — 되돌릴 선점이 없다(잔액 환불 경로와 같은 형태).
    revertClaim: null,
    recordFailureLog: '[billing-refund] 토스 취소는 끝났으나 refunds 기록 실패',
  });
  if (failure) return failure;

  return { ok: true, refundAmount, orderNo: order.orderNo, cycleYm: cycle.cycleYm, isFull: refundAmount >= remaining };
};

/** 관리자 상세의 회차 표에 붙는 환불 요약 — 회차 id → 환불 합계·주문 상태. */
export type SubscriptionRefundSummary = {
  subscriptionPaymentId: string;
  orderNo: string;
  orderStatus: string;
  refundedAmount: number;
  remainingAmount: number;
};

export const listSubscriptionRefundSummary = async (subscriptionId: string): Promise<SubscriptionRefundSummary[]> => {
  const db = getDb();
  const rows = await db
    .select({
      subscriptionPaymentId: subscriptionPayments.id,
      orderNo: orders.orderNo,
      orderStatus: orders.status,
      totalAmount: orders.totalAmount,
      refundAmount: refunds.amount,
      refundStatus: refunds.status,
    })
    .from(subscriptionPayments)
    .innerJoin(orders, eq(orders.id, subscriptionPayments.orderId))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .leftJoin(refunds, eq(refunds.paymentId, payments.id))
    .where(and(eq(subscriptionPayments.subscriptionId, subscriptionId), inArray(subscriptionPayments.status, ['paid'])));

  const byCycle = new Map<string, SubscriptionRefundSummary>();
  for (const row of rows) {
    const entry = byCycle.get(row.subscriptionPaymentId) ?? {
      subscriptionPaymentId: row.subscriptionPaymentId,
      orderNo: row.orderNo,
      orderStatus: row.orderStatus,
      refundedAmount: 0,
      remainingAmount: row.totalAmount,
    };
    if (row.refundStatus === 'done' && row.refundAmount) {
      entry.refundedAmount += row.refundAmount;
      entry.remainingAmount = Math.max(0, entry.remainingAmount - row.refundAmount);
    }
    byCycle.set(row.subscriptionPaymentId, entry);
  }
  return [...byCycle.values()];
};
