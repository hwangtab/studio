import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, refunds, webhookEvents, type Order, type Payment } from '../../db/schema';
import { reconcileSubscriptionPaymentFromToss } from '../billing/service';
import { confirmFundingPledge, syncFundingCancelledFromToss, type FundingConfirmOutcome } from '../funding/confirm';
import { confirmShowOrder, type ConfirmOutcome as ShowConfirmOutcome } from '../shows/confirm';
import { sendShowTicketEmail } from '../shows/email';
import { syncShowCancelsFromToss } from '../shows/refund';
import { confirmBookingPayment, type ConfirmOutcome } from './confirm';
import { confirmDepositPayment } from './confirmDeposit';
import { findOrderByOrderNo } from './service';
import { cancelPayment, confirmPayment, fetchPayment, type TossPayment } from './toss';

/**
 * 취소 합계로 주문 상태를 정한다.
 *
 * 0이면(재조회 응답에 cancels 부재) 부분환불로 오기록하지 않고 기존 상태를 유지한다.
 */
const nextOrderStatus = (order: Order, cancelledTotal: number): Order['status'] =>
  cancelledTotal >= order.totalAmount ? 'refunded' : cancelledTotal > 0 ? 'partially_refunded' : order.status;

/** 재조회 응답의 누적 취소 합계. cancels 부재는 0(반영할 취소 없음). */
const cancelledTotalOf = (payment: TossPayment): number =>
  payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? 0;

/** 취소 계열 상태 — 한 결제에 여러 번 도착할 수 있는 유일한 이벤트군이다. */
const CANCEL_STATUSES = new Set(['CANCELED', 'PARTIAL_CANCELED']);

/**
 * 멱등 키. DONE은 `paymentKey:status`면 충분하지만 **취소 계열은 누적 취소 합계까지 넣는다.**
 *
 * 한 결제에 부분취소를 두 번 걸면 재조회 status가 두 번 다 PARTIAL_CANCELED다 —
 * `paymentKey:status`로는 두 이벤트의 키가 같아져, 두 번째가 unique 위반으로 "중복"
 * 처리되어 통째로 스킵됐다. 두 번째 환불액이 refunds에 영영 안 들어가고 주문도
 * partially_refunded에 머문다 → 원장이 과대 계상되고(환불 기록이 실제보다 적다),
 * 그 뒤 관리자 환불은 remainingRefundable이 실제보다 크게 나와 토스에서 초과취소로
 * 계속 거절된다. 합계를 키에 넣으면 취소 1회차(2,500)와 2회차(누적 5,000)가 서로 다른
 * 이벤트가 되어 둘 다 대사 경로를 탄다.
 *
 * 같은 이벤트가 재도착하면 합계도 같으므로 키가 같다 — 멱등성은 그대로다.
 */
const eventKeyFor = (paymentKey: string, payment: TossPayment): string =>
  CANCEL_STATUSES.has(payment.status)
    ? `${paymentKey}:${payment.status}:${cancelledTotalOf(payment)}`
    : `${paymentKey}:${payment.status}`;

/**
 * 토스가 취소한 금액과 우리가 기록한 환불 합계를 맞춘다.
 *
 * booking이 이미 cancelled라 선점할 게 없는 경우에 탄다. 그때 조용히 물러나면
 * cancel.ts의 recording_failed(토스 환불은 끝났는데 refunds INSERT가 실패해 예약만
 * 취소된 상태)가 영구 미기록으로 남는다 — 관리자 화면엔 취소된 예약에 환불 0원.
 * 여기서 델타를 채워 넣어야 CANCELED 웹훅 재도착이 그 구멍을 메운다.
 */
const reconcileRefunds = async (order: Order, paymentRow: Payment, payment: TossPayment): Promise<void> => {
  const db = getDb();
  const cancelledTotal = cancelledTotalOf(payment);
  const recorded = await db.query.refunds.findMany({
    where: (t, { eq: equals }) => and(equals(t.paymentId, paymentRow.id), equals(t.status, 'done')),
  });
  const refundedSum = recorded.reduce((sum, r) => sum + r.amount, 0);
  // 기록이 토스를 따라잡았다면 할 일이 없다. 우리 쪽이 더 많은 경우(부분환불 두 건이 한
  // 이벤트로 합쳐 보이는 등)도 델타를 만들지 않는다 — 없는 환불을 지어내지 않는다.
  if (cancelledTotal <= refundedSum) return;

  const delta = cancelledTotal - refundedSum;
  console.error('[booking-webhook] 취소 대사 불일치 — 누락된 환불 기록을 보정한다', {
    orderNo: order.orderNo,
    paymentKey: payment.paymentKey,
    cancelledTotal,
    refundedSum,
    delta,
  });
  await db.batch([
    db.insert(refunds).values({
      paymentId: paymentRow.id,
      amount: delta,
      reason: '토스 취소 대사 보정',
      requestedBy: 'webhook',
      tossTransactionKey: payment.cancels?.[payment.cancels.length - 1]?.transactionKey ?? null,
      status: 'done',
    }),
    db.update(orders)
      .set({ status: nextOrderStatus(order, cancelledTotal), updatedAt: new Date() })
      .where(eq(orders.id, order.id)),
  ]);
};

/** 외부(토스 콘솔 등)에서 이미 취소된 결제를 DB에 반영만 한다 — 취소 API를 다시 부르지 않는다. */
const syncCancelledFromToss = async (payment: TossPayment): Promise<void> => {
  const order = await findOrderByOrderNo(payment.orderId);
  if (!order) return;
  const booking = order.bookings[0];
  const workOrder = order.workOrders[0];
  // 세션은 bookings, 믹싱은 work_orders — 둘 다 없으면 반영할 대상이 없다.
  if (!booking && !workOrder) return;

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

  // 취소 합계를 선점보다 **먼저** 본다. 0이면(재조회 응답에 cancels가 없다) 반영할 취소가
  // 없는 것이므로 아무것도 바꾸지 않고 물러난다 — 그대로 진행하면 booking·work_order를
  // cancelled로 선점해 놓고 환불 0원 행만 남겨, 취소되지 않은 예약을 취소된 것으로 만든다.
  // lib/funding/confirm.ts의 syncFundingCancelledFromToss와 같은 방어다.
  const cancelled = cancelledTotalOf(payment);
  if (cancelled <= 0) {
    console.error('[booking-webhook] CANCELED 동기화 스킵 — 취소 합계 0(cancels 부재)', {
      orderNo: order.orderNo,
      paymentKey: payment.paymentKey,
      status: payment.status,
    });
    return;
  }

  // 원자적 선점 — cancel.ts의 claim 패턴을 그대로 미러링한다. 멱등 키가 상태(+취소 합계)를
  // 포함하므로 PARTIAL_CANCELED와 CANCELED는 서로 다른 이벤트로 취급되어 둘 다 webhookEvents
  // INSERT를 통과할 수 있다. 두 이벤트가 동시에 여기 도달하면 위 읽기 시점엔 둘 다 booking을
  // confirmed로 보지만, UPDATE...WHERE status='confirmed'는 하나만 rowsAffected 1을 받는다
  // — 진 쪽은 전액 refunds를 중복 INSERT하지 않고 아래 대사 경로로만 넘어간다.
  let claimed = false;
  if (booking && booking.status === 'confirmed') {
    const claim = await db.run(
      sql`UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch() WHERE id = ${booking.id} AND status = 'confirmed'`,
    );
    claimed = Number(claim.rowsAffected) > 0;
  } else if (
    workOrder &&
    (workOrder.status === 'received' || workOrder.status === 'in_progress' || workOrder.status === 'delivered')
  ) {
    // 믹싱은 세 상태 어디서든(cancel.ts의 고객/관리자 취소 조건과 동일 범위) 선점 대상이다 —
    // 읽은 시점의 status로 조건을 걸어 다른 요청이 먼저 가져간 경우를 걸러낸다.
    const claim = await db.run(
      sql`UPDATE work_orders SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch() WHERE id = ${workOrder.id} AND status = ${workOrder.status}`,
    );
    claimed = Number(claim.rowsAffected) > 0;
  }

  // 선점하지 못했다 = 이 예약은 이미 취소됐다(읽는 시점에 이미 cancelled였거나, 형제 이벤트가
  // 방금 가져갔거나). 여기서 조용히 물러나면 "취소는 됐는데 환불 기록이 없는" 상태
  // (cancel.ts recording_failed)가 영구히 남는다 — 금액 대사로 델타만 채운다.
  //
  // 남는 좁은 경합: 형제 이벤트가 선점 직후 batch 커밋 전이면 대사가 그 행을 아직 못 봐서
  // 같은 금액을 한 번 더 기록할 수 있다. 돈이 두 번 나가지는 않고(이 경로는 토스 취소 API를
  // 부르지 않는다) 관리자 화면에 환불 행이 하나 더 보일 뿐이라, 복구 불가 상태를 영구히
  // 남기는 쪽보다 낫다고 판단해 감수한다.
  if (!claimed) {
    await reconcileRefunds(order, paymentRow, payment);
    return;
  }

  const now = new Date();
  await db.batch([
    db.insert(refunds).values({
      paymentId: paymentRow.id,
      amount: cancelled, reason: '토스 외부 취소 동기화', requestedBy: 'webhook',
      tossTransactionKey: payment.cancels?.[payment.cancels.length - 1]?.transactionKey ?? null,
      status: 'done',
    }),
    db.update(orders)
      .set({ status: nextOrderStatus(order, cancelled), updatedAt: now })
      .where(eq(orders.id, order.id)),
  ]);
};

/**
 * 500을 돌려주기 전에 방금 남긴 멱등 키를 회수한다.
 *
 * 기록을 처리보다 먼저 하는 설계라, 처리에 실패한 채 키만 남으면 토스의 다음 재시도가
 * "이미 처리한 이벤트"로 오인돼 200으로 흘러간다 — 재시도가 통째로 무력화되고 복구
 * 기회가 영영 사라진다. 지운 뒤 500을 주면 다음 재시도가 INSERT부터 다시 성공한다.
 */
const releaseEventKey = async (eventKey: string): Promise<void> => {
  try {
    await getDb().delete(webhookEvents).where(eq(webhookEvents.eventKey, eventKey));
  } catch (error) {
    // 회수까지 실패하면 이 이벤트 1건은 재시도되지 않는다(현행과 같은 최악값) — 로그로 남긴다.
    console.error('[booking-webhook] 멱등 키 회수 실패 — 이 이벤트는 재시도되지 않는다', { eventKey, error });
  }
};

/**
 * 재시도하면 결과가 달라질 수 있는 실패인가.
 *
 * recording_failed(승인은 됐고 DB 기록만 실패)·toss_rejected(재조회 실패 등 판정 보류)는
 * 일시성이라 재시도해야 한다. not_found·invalid_state·amount_mismatch·hold_expired는 몇 번을
 * 다시 보내도 같은 답이 나오는 영구 상태라 기록을 남긴 채 200으로 끝낸다(hold_expired는
 * 웹훅 경로에서 애초에 건너뛰므로 여기 도달하지 않지만, 유니온 완전성을 위해 포함한다).
 */
const isTransientConfirmFailure = (
  code: Extract<ConfirmOutcome | FundingConfirmOutcome, { ok: false }>['code'],
): boolean => code === 'recording_failed' || code === 'toss_rejected';

/**
 * confirmShowOrder(shows 모듈)의 실패 중 재시도 가치가 있는 것 — 위 isTransientConfirmFailure의
 * shows 버전. 두 함수를 하나로 합치지 않는 이유는 outcome 모양 자체가 다르기 때문이다
 * (booking/funding은 `{ok:false, code}` 유니온, shows는 `{status:'error', code}` 하나로
 * declined·sold_out·amount_mismatch 같은 최종 결론과 `error`를 status 레벨에서 이미 가른다).
 *
 * 재시도 대상은 두 코드뿐이다.
 * - `recording_failed` — batch(payments INSERT + orders 전이) 실패 후 멱등 판정(payment_key로
 *   기존 결제 재조회)마저 실패하거나 "아직 없다"로 나온 경우. 토스 승인은 이미 끝났는데 우리가
 *   그 사실을 기록했는지조차 모르는 상태다 — booking/funding의 `recording_failed`와 같은 뜻이다.
 * - `toss_unresolved` — lib/shows/confirm.ts의 TOSS_UNRESOLVED_CODE. confirmPayment 호출이
 *   거절이 아닌 이유로 결론을 못 낸 경우 전부(NETWORK_ERROR·CONFIG_ERROR로 응답을 못 받은 경우,
 *   그리고 ALREADY_PROCESSED_PAYMENT 재조회가 실패하거나 검증에 실패한 경우)가 이 코드 하나로
 *   수렴한다 — booking의 `toss_rejected`와 같은 자리다. 예전엔 이 경로가 raw 토스 코드를
 *   그대로 돌려줘서 여기서 재시도되지 않았는데, confirmShowOrder에 booking과 같은
 *   ALREADY_PROCESSED_PAYMENT 재조회 분기가 없던 시절엔 그게 의도였다(재조회 없이 재시도하면
 *   같은 코드로 무한히 실패할 뿐이었다). 그 분기가 생긴 지금은 재시도해야 한다 — 안 하면
 *   "토스에서는 승인됐는데 우리 쪽 주문이 pending에 영원히 남는" 사고가 그대로 남는다.
 *
 * `not_found`(주문 부재)·`invalid_status`(주문이 확정 가능 상태를 벗어남)는 몇 번을 다시
 * 보내도 같은 답이 나오는 영구 상태다. `declined`·`sold_out`·`amount_mismatch`는 status
 * 자체가 `error`가 아니라 이미 최종 결론이 난 것이라 이 판정에 들어오지도 않는다.
 */
const isTransientShowConfirmFailure = (code: string): boolean =>
  code === 'recording_failed' || code === 'toss_unresolved';

/** unique 위반(PK 충돌 = 이미 처리한 이벤트)인지, 그 외 DB 장애인지를 가른다. */
const isUniqueViolation = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
  return /unique|sqlite_constraint/i.test(message) || /unique|sqlite_constraint/i.test(code);
};

export const processTossWebhook = async (payload: unknown): Promise<{ status: number }> => {
  const body = payload as { data?: { paymentKey?: unknown; status?: unknown } } | null;
  const paymentKey = body?.data?.paymentKey;
  const status = body?.data?.status;
  // 형식이 어긋난 요청은 재시도해도 소용없다 — 200으로 종료.
  if (typeof paymentKey !== 'string' || typeof status !== 'string') return { status: 200 };

  // 페이로드는 신뢰하지 않는다 — 토스에 재조회한 상태만 쓴다 (스펙 §5). 멱등 키를 만들기
  // 전에 재조회한다: 이 엔드포인트는 무인증이고 고객은 success URL에서 자기 paymentKey를
  // 안다. 키를 payload의 status로 만들면 승인 확정 전에 {paymentKey, status:'DONE'}을 위조
  // POST해 `pk:DONE` 키를 선점할 수 있고(그 요청은 재조회 상태가 IN_PROGRESS라 아무 처리 없이
  // 200), 뒤이어 온 진짜 DONE 웹훅이 unique 위반으로 "중복"으로 스킵된다 — success SSR까지
  // 실패했다면 승인된 결제가 payments·confirmed booking 없이 만료된다. 재조회 상태로 키를
  // 만들면 위조가 선점할 키 자체가 없다(위조 요청은 `pk:IN_PROGRESS`를 쓴다).
  // 대가는 키 검사 전에 토스 API를 부르는 것 — 남용은 라우트의 IP당 120회/시간이 막는다.
  const result = await fetchPayment(paymentKey);
  if (!result.ok) {
    // 일시 실패 — 아직 아무 키도 남기지 않았으므로 회수할 것도 없다. 500으로 재시도를 유도한다.
    console.error('[booking-webhook] 결제 재조회 실패 — 재시도 유도', {
      paymentKey,
      code: result.code,
      message: result.message,
    });
    return { status: 500 };
  }

  const payment = result.payment;

  // 처리보다 기록을 먼저 — PK 충돌이 "이미 처리했다"는 신호다.
  const db = getDb();
  const eventKey = eventKeyFor(paymentKey, payment);
  try {
    await db.insert(webhookEvents).values({ eventKey, payload: JSON.stringify(payload) });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: 200 }; // 중복 이벤트
    // unique 위반이 아니면 진짜 DB 장애 — 여기서 200을 주면 토스가 재시도를 멈추고 이벤트가
    // 영구히 유실된다. 500으로 재시도를 유도한다: 어차피 같은 DB라 이번 요청에서 후속 처리
    // (확정·동기화)도 불가능한 상태고, DB가 복구된 뒤 재시도가 오면 INSERT가 성공해
    // 정상 경로로 들어간다 — 멱등성은 그대로 유지된다.
    console.error('[booking-webhook] 멱등 기록 실패 — 재시도 유도', { eventKey, error });
    return { status: 500 };
  }

  try {
    if (payment.status === 'DONE') {
      // 승인 경로(success SSR)가 죽었을 때의 복구 — 금액은 토스 재조회값으로 검증된다.
      // order.type을 알아야 분기하므로 여기서 조회한다 — READY 등 무관 상태 이벤트에는 이
      // DB 읽기가 없어야 한다(예전 동작 유지, 브랜치 밖에서 매번 부르지 않는다).
      const order = await findOrderByOrderNo(payment.orderId);
      const orderType = order?.type ?? 'session';
      if (orderType === 'subscription') {
        // 구독 회차는 bookings/work_orders 같은 하위 엔티티가 없어 confirmBookingPayment를
        // 재사용할 수 없다 — chargeCycle 성공 경로와 같은 계산을 쓰는 전용 함수로 반영한다.
        // 이 함수는 실패해도 던지지 않고 로그만 남긴다(멱등 대사이지 신규 승인 확정이 아니므로
        // 재시도 유도가 없어도 다음 cron이나 다음 웹훅 재도착이 같은 경로로 다시 정리한다).
        await reconcileSubscriptionPaymentFromToss(payment);
      } else if (orderType === 'ticket') {
        // shows 도메인 확정 — booking/funding과 outcome 모양이 달라(status/code) 별도 분기로
        // 둔다. toss는 이 파일이 이미 쓰는 실제 구현(confirmPayment·fetchPayment)을 그대로 주입한다.
        const outcome: ShowConfirmOutcome = await confirmShowOrder(
          { orderNo: payment.orderId, paymentKey, amount: payment.totalAmount },
          { trustedByWebhook: true },
          { confirmPayment, fetchPayment, cancelPayment },
        );
        if (outcome.status === 'error' && isTransientShowConfirmFailure(outcome.code)) {
          console.error('[booking-webhook] 공연 확정 처리 일시 실패 — 멱등 키 회수 후 재시도 유도', {
            eventKey,
            code: outcome.code,
          });
          await releaseEventKey(eventKey);
          return { status: 500 };
        }
        if (outcome.status === 'confirmed' || outcome.status === 'already_confirmed') {
          // 브라우저를 닫아 success 페이지가 확정하지 못한 주문도 여기서 메일이 나간다.
          // send_pending 선점 CAS가 있어 이미 나갔다면 {sent:false}로 끝난다(중복 발송 없음).
          try {
            await sendShowTicketEmail(payment.orderId);
          } catch (error) {
            console.error('[booking-webhook] 공연 티켓 메일 실패', { orderNo: payment.orderId, error });
          }
        }
      } else if (orderType === 'deposit') {
        // 예약금 결제 링크 — 하위 테이블이 없는 전용 승인 경로. 재조회로 DONE + 금액이 확인된 돈이다.
        const outcome = await confirmDepositPayment(
          { orderNo: payment.orderId, paymentKey, amount: payment.totalAmount },
          { trustedByWebhook: true },
        );
        if (!outcome.ok && isTransientConfirmFailure(outcome.code)) {
          console.error('[booking-webhook] 예약금 확정 처리 일시 실패 — 멱등 키 회수 후 재시도 유도', {
            eventKey,
            code: outcome.code,
          });
          await releaseEventKey(eventKey);
          return { status: 500 };
        }
      } else {
        const outcome =
          orderType === 'funding'
            ? await confirmFundingPledge(
                { orderNo: payment.orderId, paymentKey, amount: payment.totalAmount },
                // 여기까지 온 결제는 토스 재조회로 DONE + 금액이 확인된 돈이다 — 홀드가 지났다는
                // 이유로 거절하면 승인된 결제가 영구 미기록으로 남는다.
                { trustedByWebhook: true },
              )
            : await confirmBookingPayment(
                { orderNo: payment.orderId, paymentKey, amount: payment.totalAmount },
                // 펀딩과 같은 신뢰 경로 — 재조회로 DONE + 금액이 확인된 돈이라, 과거에 찍힌
                // failed/expired 때문에 승인된 결제를 영구 미기록으로 버리지 않는다.
                { trustedByWebhook: true },
              );
        if (!outcome.ok && isTransientConfirmFailure(outcome.code)) {
          console.error('[booking-webhook] 확정 처리 일시 실패 — 멱등 키 회수 후 재시도 유도', {
            eventKey,
            code: outcome.code,
          });
          await releaseEventKey(eventKey);
          return { status: 500 };
        }
      }
    } else if (payment.status === 'CANCELED' || payment.status === 'PARTIAL_CANCELED') {
      const order = await findOrderByOrderNo(payment.orderId);
      const orderType = order?.type ?? 'session';
      if (orderType === 'funding') {
        await syncFundingCancelledFromToss(payment);
      } else if (orderType === 'ticket') {
        // 티켓 전용 대사 — bookings/work_orders 선점이 아니라 show_tickets를 직접 정리한다
        // (lib/shows/refund.ts). payment.orderId(=주문번호)만 있으면 되고, order 객체는 여기서
        // 다시 조회하지 않는다(orderType이 이미 order?.type을 거쳐 나온 값이므로 order는 존재한다).
        await syncShowCancelsFromToss(payment.orderId, payment);
      } else if (orderType === 'deposit') {
        // 예약금 — 선점할 하위 엔티티가 없다. 취소 금액만 refunds와 대사하고 주문 상태를 환불 계열로 옮긴다.
        // syncCancelledFromToss는 bookings/work_orders 전제라 쓰지 않고(조용히 return하면 취소가 영영 기록되지 않는다)
        // reconcileRefunds를 재사용한다.
        if (order) {
          const paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey) ?? order.payments[0];
          if (paymentRow) await reconcileRefunds(order, paymentRow, payment);
          else console.error('[booking-webhook] 예약금 취소 대사 스킵 — payments 행 없음', { orderNo: order.orderNo });
        }
      } else if (orderType === 'subscription') {
        // 관리자가 토스 콘솔에서 회차 하나를 취소해도 구독 자체는 유지한다(스펙 §6 관리자 절 —
        // 정지·해지는 관리자 화면의 별도 조작이지 결제 취소의 부작용이 아니다). 환불 금액만
        // 대사하고 subscriptions·subscriptionPayments 상태는 건드리지 않는다. syncCancelledFromToss는
        // bookings/work_orders 선점을 전제하므로 여기서는 쓰지 않고 reconcileRefunds만 재사용한다.
        if (order) {
          const paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey) ?? order.payments[0];
          if (paymentRow) await reconcileRefunds(order, paymentRow, payment);
        }
      } else {
        await syncCancelledFromToss(payment);
      }
    }
  } catch (error) {
    // DB 장애로 처리가 통째로 실패했다 — 기록만 남고 처리는 안 된 상태를 만들지 않는다.
    console.error('[booking-webhook] 이벤트 처리 실패 — 멱등 키 회수 후 재시도 유도', { eventKey, error });
    await releaseEventKey(eventKey);
    return { status: 500 };
  }
  return { status: 200 };
};
