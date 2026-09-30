import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refunds } from '../../db/schema';
import { refundIdempotencyKey, remainingRefundable, type PaymentWithRefunds } from '../booking/cancel';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import type { TossPayment } from '../booking/toss';
import { calcRefundAmount, refundRateForNotice } from './refundPolicy';
import { rowsAffectedOf } from './service';
import { parseLeadingTag } from './tossCodes';

/**
 * 공연 티켓 부분/전량 환불 — 관리자(또는 관리자 대행 셀프 취소 화면)가 특정 티켓들을 지정해
 * 돌려준다. `lib/funding/lineRefund.ts`의 "선점 → 토스 → 기록" 3단계를 그대로 이식한다
 * (아래 각 단계 주석에서 그 파일과의 대응을 밝힌다).
 *
 * 한 주문에 여러 티켓이 담기므로(quantity>1), 취소는 **티켓 단위**로 지정한다 — 펀딩의
 * "줄(리워드) 단위 부분 환불"과 같은 이유다: 회차 취소 시 일부 티켓만 이미 개별 환불됐을 수
 * 있고(§6 불변식 "부분환불 후 회차취소 중복 카운트"), 체크인된 티켓은 환불 대상에서 아예
 * 빼야 한다(§6 E-계열 불변식).
 *
 * 순서:
 * 1. **선점**: 지정된 티켓들을 'refunding'으로 먼저 올린다. WHERE에 "issued 상태" +
 *    "체크인 안 됨"을 걸어 두 관리자가 같은 티켓을 동시에 눌러도 한쪽만 이긴다
 *    (lineRefund.ts의 `funding_pledge_items.refunded_quantity` UPDATE와 같은 자리).
 * 2. **토스 부분 취소**: 금액 = Σ calcRefundAmount(티켓 단가, 공지 시점 요율). 멱등 키에
 *    (주문번호, 환불액)을 넣어 재시도가 replay되게 한다(`refundIdempotencyKey`).
 * 3. **기록**: 환불 행은 웹훅 동기화(`syncShowCancelsFromToss`)와 같은 **델타 INSERT**로
 *    쓴다 — 토스 응답의 누적 취소액에서 이미 기록된 합을 뺀 만큼만. 웹훅이 먼저 기록했어도
 *    이중으로 남지 않는다.
 *
 * 토스가 **확실히 거절**하면(응답이 온 실패) 선점을 되돌린다. 응답을 못 받은 실패
 * (NETWORK_ERROR)는 "취소는 됐는데 응답만 늦었다"일 수 있어 **되돌리지 않는다** — 되돌리면
 * 티켓이 issued로 되살아나 재판매될 수 있는데, 실제로는 돈이 이미 나갔을 수 있다. 그 경우
 * 티켓은 'refunding'에 머물고(§6 "환불 확정 대기" 불변식), 나중에 도착하는 웹훅
 * (`syncShowCancelsFromToss`)이 최종 확정한다 — booking/cancel.ts의 `settleRefund`(잔액
 * 환불 등 일부 경로에서 NETWORK_ERROR도 되돌리는 방식)와 달리 lineRefund.ts와 같은 선택이다.
 */

export type RefundOutcome =
  | { status: 'refunded'; amount: number; orderStatus: 'partially_refunded' | 'refunded' }
  | { status: 'rejected'; reason: string }
  | { status: 'toss_unknown' };

const REFUND_REASON = '공연 티켓 환불(§11.3 취소환불표)';

export async function refundShowTickets(
  input: { orderNo: string; ticketIds: string[]; noticeAt: Date },
  toss: Pick<FakeToss, 'cancelPayment'>,
): Promise<RefundOutcome> {
  const db = getDb();

  if (input.ticketIds.length === 0) {
    return { status: 'rejected', reason: 'no_tickets' };
  }

  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, input.orderNo) });
  if (!order) return { status: 'rejected', reason: 'not_found' };
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    return { status: 'rejected', reason: 'invalid_order_status' };
  }

  // 지정된 티켓들이 실제로 이 주문에 속하는지, 발권 상태인지, 체크인 여부를 확인한다.
  // showtime 관계는 showTicketsRelations에 명시적으로 선언돼 있어(불명확한 show_orders.tickets
  // 관계와 달리) 안전하게 with-쿼리할 수 있다.
  const tickets = await db.query.showTickets.findMany({
    where: (t, { and, eq, inArray }) => and(eq(t.orderNo, input.orderNo), inArray(t.id, input.ticketIds)),
    with: { showtime: true },
  });
  if (tickets.length !== input.ticketIds.length) {
    return { status: 'rejected', reason: 'ticket_not_found' };
  }
  // §6 E-계열 불변식 — 이미 체크인된 티켓은 환불 대상에서 제외(거부)한다. checked_in_at은
  // 이 도메인에서 유일하게 "입장 완료"를 표시하는 컬럼이라 이 검사가 그 불변식의 전부다.
  if (tickets.some((t) => t.checkedInAt != null)) {
    return { status: 'rejected', reason: 'checked_in' };
  }
  if (tickets.some((t) => t.status !== 'issued')) {
    return { status: 'rejected', reason: 'not_issued' };
  }

  const showtimeStartsAt = new Date(tickets[0].showtime.startsAt * 1000);
  const pct = refundRateForNotice(showtimeStartsAt, input.noticeAt);
  if (pct === 0) {
    return { status: 'rejected', reason: 'after_showtime_start' };
  }

  const totalAmount = tickets.reduce((sum, t) => sum + calcRefundAmount(t.unitAmount, pct), 0);
  if (totalAmount <= 0) {
    return { status: 'rejected', reason: 'zero_amount' };
  }

  // cancel.ts(booking)·lineRefund.ts와 같은 규칙으로 취소를 걸 결제 행을 고른다 — 잔액이
  // 남아 있는 결제(보통 이 도메인은 결제가 하나뿐이다, confirmShowOrder가 주문당 1건만
  // 남긴다). remainingRefundable로 이 환불이 잔액을 넘지 않는지도 함께 확인한다.
  const payments = await db.query.payments.findMany({
    where: (p, { eq }) => eq(p.orderId, order.id),
    with: { refunds: true },
  });
  const doneRefundedOn = (p: PaymentWithRefunds): number =>
    p.refunds.filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
  const payment = payments.find((p) => doneRefundedOn(p) < order.totalAmount) ?? payments[payments.length - 1];
  if (!payment) return { status: 'rejected', reason: 'no_payment' };

  const remaining = remainingRefundable(order, payments);
  if (totalAmount > remaining) {
    return { status: 'rejected', reason: 'exceeds_remaining' };
  }

  // 1) 선점 — lineRefund.ts의 `funding_pledge_items.refunded_quantity` UPDATE에 대응.
  const ticketIdList = sql.join(
    input.ticketIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const claim = await db.run(sql`
    UPDATE show_tickets SET status = 'refunding'
    WHERE order_no = ${input.orderNo}
      AND id IN (${ticketIdList})
      AND status = 'issued' AND checked_in_at IS NULL
  `);
  if (rowsAffectedOf(claim) !== input.ticketIds.length) {
    // 경합(다른 요청이 먼저 붙잡았거나, 그 사이 체크인됨) — 토스를 아예 부르지 않는다.
    return { status: 'rejected', reason: 'concurrent_change' };
  }

  const revertClaim = async (): Promise<void> => {
    try {
      await db.run(sql`
        UPDATE show_tickets SET status = 'issued'
        WHERE order_no = ${input.orderNo}
          AND id IN (${ticketIdList})
          AND status = 'refunding'
      `);
    } catch (error) {
      console.error('[shows-refund] 선점 되돌리기 실패 — 수동 복구 필요', {
        orderNo: input.orderNo,
        ticketIds: input.ticketIds,
        error,
      });
    }
  };

  // 2) 토스 부분 취소.
  const idempotencyKey = refundIdempotencyKey(input.orderNo, totalAmount, 'tkt-refund');
  const cancelResult = await toss.cancelPayment({
    paymentKey: payment.paymentKey,
    cancelReason: `[#${idempotencyKey}] 공연 티켓 환불`,
    cancelAmount: totalAmount,
    idempotencyKey,
    paymentMethod: payment.method,
  });

  if (!cancelResult.ok) {
    if (cancelResult.code === 'NETWORK_ERROR') {
      // 응답을 못 받았다 — 취소가 됐을 수 있다. 선점(티켓 'refunding')을 유지하고 운영자
      // 확인/웹훅 대사를 기다린다(위 주석의 lineRefund.ts와 동일 선택).
      console.error('[shows-refund] 토스 응답 없음 — 선점 유지, 확인 필요', {
        orderNo: input.orderNo,
        ticketIds: input.ticketIds,
        amount: totalAmount,
      });
      return { status: 'toss_unknown' };
    }
    // 확정 거절 — 선점을 되돌리고 실패 기록만 남긴다(cancel.ts의 settleRefund와 동일 원칙).
    await revertClaim();
    try {
      await db.insert(refunds).values({
        paymentId: payment.id,
        amount: totalAmount,
        reason: cancelResult.message || REFUND_REASON,
        requestedBy: 'admin',
        status: 'failed',
      });
    } catch (error) {
      console.error('[shows-refund] 거절 기록 실패', { orderNo: input.orderNo, error });
    }
    console.error('[shows-refund] 토스 취소 거절', {
      orderNo: input.orderNo,
      code: cancelResult.code,
      message: cancelResult.message,
    });
    return { status: 'rejected', reason: 'toss_failed' };
  }

  // 3) 기록 — 토스가 말한 누적 취소액 − 이미 기록된 합. 웹훅이 먼저 기록했으면 0행이다
  // (lineRefund.ts·syncFundingCancelledFromToss와 동일한 델타 INSERT).
  const cancelledTotal = cancelResult.payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? totalAmount;
  await db.batch([
    db.run(sql`
      INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
      SELECT lower(hex(randomblob(16))), ${payment.id},
             ${cancelledTotal} - COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0),
             ${REFUND_REASON}, 'admin',
             ${cancelResult.payment.cancels?.[cancelResult.payment.cancels.length - 1]?.transactionKey ?? null}, 'done'
      WHERE ${cancelledTotal} > COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0)
    `),
    db.run(sql`
      UPDATE show_tickets SET status = 'refunded'
      WHERE order_no = ${input.orderNo}
        AND id IN (${ticketIdList})
        AND status = 'refunding'
    `),
  ] as [any, any]);

  // 다시 읽어 상태를 정한다 — 이 회차의 모든 티켓이 환불/무효면 전액 환불, 아니면 부분 환불.
  const remainingTickets = await db.query.showTickets.findMany({
    where: (t, { eq }) => eq(t.orderNo, input.orderNo),
  });
  const allSettled = remainingTickets.every((t) => t.status === 'refunded' || t.status === 'void');
  const orderStatus: 'refunded' | 'partially_refunded' = allSettled ? 'refunded' : 'partially_refunded';
  await db.run(sql`
    UPDATE orders SET status = ${orderStatus}, updated_at = unixepoch()
    WHERE id = ${order.id} AND status IN ('paid', 'partially_refunded')
  `);

  return { status: 'refunded', amount: totalAmount, orderStatus };
}

/**
 * 토스 콘솔 등 외부(또는 위 `refundShowTickets`가 NETWORK_ERROR로 응답을 못 받은 뒤 실제로는
 * 성사된 취소)에서 이미 취소된 티켓 결제를 DB에 반영만 한다(취소 API 재호출 없음) — 스펙 §7.9.
 *
 * `lib/funding/confirm.ts`의 `syncFundingCancelledFromToss`와 같은 대사(reconciliation)
 * 로직이다: cancels 부재는 0으로 취급해 전액 환불을 날조하지 않고, 이미 기록된 done 환불
 * 합계와 대사해 **델타만 INSERT**한다 — 같은 이벤트가 두 번 와도 델타가 0이라 아무것도
 * 쓰지 않고, 부분 취소 뒤 전액 취소가 오면 차액만 채운다.
 *
 * 티켓 상태 정리는 두 갈래로만 한다(어느 티켓이 이번 취소에 해당하는지 웹훅 페이로드만으로는
 * 알 수 없어, 알 수 있는 범위로 제한한다):
 * - **'refunding' 상태의 티켓**은 무조건 'refunded'로 넘긴다 — 이 상태는 오직
 *   `refundShowTickets`의 자기 선점으로만 생기므로, 이 결제에 대한 취소 확인이 도착했다는
 *   것 자체가 그 선점을 확정할 근거다(§7.9 NETWORK_ERROR 재확인 경로).
 * - **주문이 전액 환불로 판정될 때만** 남은 held/issued 티켓까지 함께 정리한다(held→void,
 *   issued→refunded) — 이 경우는 "어느 티켓인지 몰라 못 정한다"는 문제가 없다(전부 다다).
 *   부분 취소는 이 정리를 하지 않는다 — 관리자 콘솔에서 직접 부분 취소하면 금액은 맞아도
 *   어느 티켓인지는 남지 않는다는 것이 이 저장소의 기존 규칙(펀딩 §"줄 환불" 절)과 같다.
 */
export async function syncShowCancelsFromToss(orderNo: string, tossPayment: TossPayment): Promise<void> {
  const db = getDb();

  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (!order) {
    console.error('[shows-refund] 취소 동기화 스킵 — 주문을 찾지 못함', {
      orderNo,
      paymentKey: tossPayment.paymentKey,
    });
    return;
  }

  const paymentRows = await db.query.payments.findMany({ where: (p, { eq }) => eq(p.orderId, order.id) });
  const paymentRow = paymentRows.find((p) => p.paymentKey === tossPayment.paymentKey) ?? paymentRows[0];
  if (!paymentRow) {
    console.error('[shows-refund] 취소 동기화 스킵 — 주문에 payments 행이 없음', {
      orderNo,
      paymentKey: tossPayment.paymentKey,
    });
    return;
  }

  const cancelledTotal = tossPayment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? 0;
  if (cancelledTotal <= 0) {
    // cancels 부재 — 전액 환불로 오기록하지 않는다(syncFundingCancelledFromToss와 동일 방어).
    console.error('[shows-refund] 취소 동기화 스킵 — 취소 합계 0(cancels 부재)', {
      orderNo,
      paymentKey: tossPayment.paymentKey,
      status: tossPayment.status,
    });
    return;
  }

  const lastCancel = tossPayment.cancels?.[tossPayment.cancels.length - 1];
  // 우리 쪽(refundShowTickets/autoCancelShowApproval)이 남긴 태그가 있으면 이 취소는 우리가
  // 이미 시작한 것의 확정이다(§7.9) — 그 태그의 유무로 admin/webhook 출처를 가른다. 태그가
  // 없으면 토스 콘솔 등에서 순수 외부로 걸린 취소다.
  const tag = parseLeadingTag(lastCancel?.cancelReason);
  const nextStatus = cancelledTotal >= order.totalAmount ? 'refunded' : 'partially_refunded';

  const inserted = await db.run(sql`
    INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
    SELECT lower(hex(randomblob(16))), ${paymentRow.id},
           ${cancelledTotal} - COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${paymentRow.id} AND status = 'done'), 0),
           ${tag ? `토스 취소 대사(${tag})` : '토스 외부 취소 동기화'}, ${tag ? 'admin' : 'webhook'},
           ${lastCancel?.transactionKey ?? null}, 'done'
    WHERE ${cancelledTotal} > COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${paymentRow.id} AND status = 'done'), 0)
  `);
  if (rowsAffectedOf(inserted) === 0) {
    // 기록이 토스를 이미 따라잡았다 — 같은 이벤트 재도착이거나 우리 쪽이 더 많이 기록한
    // 경우(있어선 안 되지만 있어도 없는 환불을 지어내지 않는다). 그래도 주문·티켓 상태
    // 정리는 계속한다 — 웹훅이 두 번 와도 상태 갱신은 멱등해야 한다.
  }

  await db.run(sql`
    UPDATE orders SET status = ${nextStatus}, updated_at = unixepoch()
    WHERE id = ${order.id} AND status IN ('paid', 'partially_refunded')
  `);

  // 'refunding'은 오직 refundShowTickets의 자기 선점으로만 생기므로, 이 결제에 대한 취소
  // 확인이 왔다는 것 자체가 그 선점을 확정할 근거다 — 무조건 'refunded'로 넘긴다.
  await db.run(sql`
    UPDATE show_tickets SET status = 'refunded'
    WHERE order_no = ${orderNo} AND status = 'refunding'
  `);

  if (nextStatus === 'refunded') {
    // 전액 취소로 판정될 때만 — 어느 티켓인지 몰라 못 정하는 문제가 없다(전부 다다).
    await db.run(sql`UPDATE show_tickets SET status = 'void' WHERE order_no = ${orderNo} AND status = 'held'`);
    await db.run(sql`UPDATE show_tickets SET status = 'refunded' WHERE order_no = ${orderNo} AND status = 'issued'`);
  }
}
