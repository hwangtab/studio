import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, refunds, webhookEvents } from '../../db/schema';
import { confirmBookingPayment } from './confirm';
import { findOrderByOrderNo } from './service';
import { fetchPayment, type TossPayment } from './toss';

/** 외부(토스 콘솔 등)에서 이미 취소된 결제를 DB에 반영만 한다 — 취소 API를 다시 부르지 않는다. */
const syncCancelledFromToss = async (payment: TossPayment): Promise<void> => {
  const order = await findOrderByOrderNo(payment.orderId);
  if (!order) return;
  const booking = order.bookings[0];
  if (!booking || booking.status !== 'confirmed') return; // 이미 반영됨

  const db = getDb();
  let paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey);
  if (!paymentRow) {
    // paymentKey가 정확히 일치하는 행을 못 찾았다. payments가 아예 비어 있으면 fallback으로
    // 쓸 행 자체가 없다 — order.payments[0]에 접근하면 crash → 웹훅 500 → 토스 무한 재시도로
    // 이어진다. 조용히 스킵하고 로그만 남긴다(관리자 화면에서 발견 가능). payments가 있는데
    // paymentKey만 안 맞는 경우엔 브리프 의도대로 첫 번째 행으로 폴백한다.
    if (order.payments.length === 0) {
      console.error('[booking-webhook] CANCELED 동기화 스킵 — 주문에 payments 행이 없음', {
        orderNo: order.orderNo,
        paymentKey: payment.paymentKey,
      });
      return;
    }
    paymentRow = order.payments[0];
  }

  const cancelled = payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? 0;
  const now = new Date();
  await db.batch([
    db.insert(refunds).values({
      paymentId: paymentRow.id,
      amount: cancelled, reason: '토스 외부 취소 동기화', requestedBy: 'webhook',
      tossTransactionKey: payment.cancels?.[payment.cancels.length - 1]?.transactionKey ?? null,
      status: 'done',
    }),
    db.update(bookings)
      .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'confirmed'))),
    db.update(orders)
      .set({ status: cancelled >= order.totalAmount ? 'refunded' : 'partially_refunded', updatedAt: now })
      .where(eq(orders.id, order.id)),
  ]);
};

export const processTossWebhook = async (payload: unknown): Promise<{ status: number }> => {
  const body = payload as { data?: { paymentKey?: unknown; status?: unknown } } | null;
  const paymentKey = body?.data?.paymentKey;
  const status = body?.data?.status;
  // 형식이 어긋난 요청은 재시도해도 소용없다 — 200으로 종료.
  if (typeof paymentKey !== 'string' || typeof status !== 'string') return { status: 200 };

  // 처리보다 기록을 먼저 — PK 충돌이 "이미 처리했다"는 신호다.
  const db = getDb();
  try {
    await db.insert(webhookEvents).values({ eventKey: `${paymentKey}:${status}`, payload: JSON.stringify(payload) });
  } catch {
    return { status: 200 }; // 중복 이벤트
  }

  // 페이로드는 신뢰하지 않는다 — 토스에 재조회한 상태만 쓴다 (스펙 §5).
  const result = await fetchPayment(paymentKey);
  if (!result.ok) return { status: 500 }; // 일시 실패 — 토스가 재시도하게 한다

  const payment = result.payment;
  if (payment.status === 'DONE') {
    // 승인 경로(success SSR)가 죽었을 때의 복구 — 금액은 토스 재조회값으로 검증된다.
    await confirmBookingPayment({ orderNo: payment.orderId, paymentKey, amount: payment.totalAmount });
  } else if (payment.status === 'CANCELED' || payment.status === 'PARTIAL_CANCELED') {
    await syncCancelledFromToss(payment);
  }
  return { status: 200 };
};
