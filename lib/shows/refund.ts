import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refunds } from '../../db/schema';
import { remainingRefundable, type PaymentWithRefunds } from '../booking/cancel';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import type { TossPayment } from '../booking/toss';
import { calcRefundAmount, refundRateForNotice } from './refundPolicy';
import { rowsAffectedOf } from './service';
import { parseLeadingTag } from './tossCodes';
import { isBankDepositPayment } from '../payments/bankDeposit';
import {
  deleteRefundAccount,
  encryptRefundAccountNumber,
  loadRefundAccountSummary,
  safeDbErrorSummary,
  saveRefundAccount,
  validateRefundAccount,
} from '../payments/refundAccount';

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
 *    **환불하는 티켓 id들(정렬)**을 넣는다(`ticketRefundIdempotencyKey`) — 주문번호+금액만
 *    쓰면 같은 주문에서 단가가 같은 서로 다른 티켓 두 장을 따로따로 환불할 때 두 호출의
 *    금액이 우연히 같아져 같은 키가 되고, 토스 멱등키 replay가 두 번째 호출에 첫 번째
 *    취소의 응답을 그대로 돌려준다 — 우리 기록은 "티켓 두 장 환불됨(2만원)"인데 토스는
 *    실제로 1만원만 취소한 상태가 남는다(과소 환불). 티켓 id를 키에 넣으면 서로 다른
 *    환불 호출은 금액이 같아도 항상 다른 키가 된다.
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
  /**
   * `refundVia` — `payment`는 토스 결제 취소, `bank_account`는 계좌 입금 주문이라 운영자가 환불 계좌로 송금한다
   * (고객 요청이면 그 계좌를 이 호출이 받아 저장했다).
   */
  | { status: 'refunded'; amount: number; orderStatus: 'partially_refunded' | 'refunded'; refundVia: 'payment' | 'bank_account' }
  /** `message`는 사유 코드 대신 그대로 보여 줄 문구(환불 계좌 형식 오류처럼 입력에 따라 달라지는 것). */
  | { status: 'rejected'; reason: string; message?: string }
  | { status: 'toss_unknown' };

const REFUND_REASON = '공연 티켓 환불(§11.3 취소환불표)';

/**
 * 티켓 환불 전용 멱등 키 — `refundIdempotencyKey(orderNo, amount, prefix)`가 아니라 이 함수를
 * 쓴다. 그 헬퍼는 (주문번호, 금액)만 보므로, 한 주문에서 단가가 같은 두 티켓을 서로 다른
 * 시점에 따로 환불하면 두 호출의 금액이 같아 같은 키가 나온다 — 토스가 두 번째 호출을
 * "이미 처리한 요청"으로 replay해 첫 번째 취소 응답을 그대로 돌려주고, 실제로는 그 금액만
 * 한 번 나갔는데 우리 기록은 두 번 다 성공으로 남는다(과소 환불). 티켓 id들(정렬)을 키에
 * 넣으면 어떤 두 환불 호출도 대상 티켓 집합이 다른 한 항상 다른 키가 된다.
 */
const ticketRefundIdempotencyKey = (orderNo: string, ticketIds: string[]): string =>
  `tkt-refund:${orderNo}:${[...ticketIds].sort().join(',')}`;

export async function refundShowTickets(
  input: {
    orderNo: string; ticketIds: string[]; noticeAt: Date;
    /** 환불을 요청한 주체 — refunds.requested_by에 남는다. 기본 admin. */ actor?: 'admin' | 'customer';
    /** 계좌 입금 주문의 **고객** 환불에만 — 환불받을 은행·계좌번호·예금주(lib/payments/refundAccount.ts). */
    refundAccount?: unknown;
  },
  toss: Pick<FakeToss, 'cancelPayment'>,
): Promise<RefundOutcome> {
  const db = getDb();
  const requestedBy = input.actor ?? 'admin';

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
  // **회차가 취소됐으면 전액이다.** 토스 결제는 회차 취소(cancelShowtime)가 그 자리에서 전액 환불하므로 여기에
  // 오지 않는다 — 오는 것은 계좌 입금 주문(토스로 돌려줄 수 없어 환불 계좌를 받아야 한다)과 회차 취소 때 토스
  // 환불이 실패해 남은 주문이다. 취소환불표는 고객 사정의 취소에 쓰는 표라 주최 측 취소에 적용하지 않는다.
  const pct = tickets[0].showtime.status === 'cancelled' ? 100 : refundRateForNotice(showtimeStartsAt, input.noticeAt);
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

  /**
   * **계좌 입금 주문**(결제 행 키가 `bank-deposit:`)은 토스를 부르지 않는다. 고객 요청이면 환불 계좌를 받아
   * 암호화해 두고(선점 전 — 키가 없으면 여기서 멈춰 티켓을 건드리지 않는다), 선점에 이긴 뒤 저장한다.
   * 환불 기록·티켓 refunded·주문 상태는 토스 경로와 똑같이 그 자리에서 남기고(좌석이 바로 풀린다), 송금 여부는
   * 환불 계좌 표의 `refunded_at`이 든다(관리자 "송금 완료"). 관리자 요청은 운영자가 이미 송금하고 기록하는 것이다.
   */
  const bank = isBankDepositPayment(payment);
  let bankAccount: { bankName: string; accountHolder: string; accountNumberEnc: string } | null = null;
  if (bank && requestedBy === 'customer') {
    const account = validateRefundAccount(input.refundAccount);
    if (!account.ok) return { status: 'rejected', reason: 'refund_account_invalid', message: account.message };
    try {
      bankAccount = {
        bankName: account.value.bankName, accountHolder: account.value.accountHolder,
        accountNumberEnc: encryptRefundAccountNumber(account.value.accountNumber),
      };
    } catch (error) {
      console.error('[shows-refund] 환불 계좌 암호화 실패 — 접수하지 않는다', { orderNo: input.orderNo, error: error instanceof Error ? error.name : 'unknown' });
      return { status: 'rejected', reason: 'refund_account_unavailable' };
    }
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

  if (bank) {
    // 한 주문에 환불 계좌 행은 하나다(티켓을 여러 번 나눠 환불하면 마지막에 적은 계좌로 덮는다). 앞선 요청의 행이
    // 이미 있었으면 기록 실패 때 지우지 않는다 — 그 요청의 송금처가 사라진다.
    const hadPriorAccount = bankAccount ? (await loadRefundAccountSummary({ kind: 'show', orderNo: input.orderNo })).status === 'present' : false;
    if (bankAccount) {
      try {
        await saveRefundAccount({ kind: 'show', orderNo: input.orderNo }, { ...bankAccount, requestedAt: input.noticeAt });
      } catch (error) {
        // 오류 객체를 통째로 찍지 않는다 — 바인딩 값(계좌번호 암호문·예금주)이 실린다.
        console.error('[shows-refund] 환불 계좌 저장 실패 — 선점을 되돌린다', { orderNo: input.orderNo, error: safeDbErrorSummary(error) });
        await revertClaim();
        return { status: 'rejected', reason: 'refund_account_unavailable' };
      }
    }
    const bankStatements = [
      db.insert(refunds).values({
        paymentId: payment.id, amount: totalAmount, reason: `${REFUND_REASON} — 계좌 입금(환불 계좌로 송금)`,
        requestedBy, status: 'done',
      }),
      db.run(sql`
        UPDATE show_tickets SET status = 'refunded'
        WHERE order_no = ${input.orderNo} AND id IN (${ticketIdList}) AND status = 'refunding'
      `),
    ];
    try {
      await db.batch(bankStatements as [typeof bankStatements[number], ...typeof bankStatements]);
    } catch (error) {
      // 돈은 아직 움직이지 않았고(운영자가 나중에 송금) 메워 줄 웹훅도 없다 — 전부 되돌린다: 티켓 refunding → issued,
      // 방금 받은 환불 계좌 행 삭제. 되돌리지 않으면 티켓이 refunding에 영원히 남아 좌석만 잡고 환불도 안 나간다.
      console.error('[shows-refund] 계좌 입금 환불 기록 실패 — 선점·환불 계좌를 되돌린다', { orderNo: input.orderNo, error: safeDbErrorSummary(error) });
      await revertClaim();
      if (bankAccount && !hadPriorAccount) await deleteRefundAccount({ kind: 'show', orderNo: input.orderNo });
      return { status: 'rejected', reason: 'refund_account_unavailable' };
    }
    // 관리자 기록은 환불 계좌 표를 건드리지 않는다 — '송금 완료'는 그 행에서 명시적으로 누를 때만(mark_refund_sent).
    const orderStatus = await settleOrderStatus(order.id, input.orderNo);
    return { status: 'refunded', amount: totalAmount, orderStatus, refundVia: 'bank_account' };
  }

  // 2) 토스 부분 취소.
  const idempotencyKey = ticketRefundIdempotencyKey(input.orderNo, input.ticketIds);
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
        requestedBy,
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
  const recordStatements = [
    db.run(sql`
      INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
      SELECT lower(hex(randomblob(16))), ${payment.id},
             ${cancelledTotal} - COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0),
             ${REFUND_REASON}, ${requestedBy},
             ${cancelResult.payment.cancels?.[cancelResult.payment.cancels.length - 1]?.transactionKey ?? null}, 'done'
      WHERE ${cancelledTotal} > COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0)
    `),
    db.run(sql`
      UPDATE show_tickets SET status = 'refunded'
      WHERE order_no = ${input.orderNo}
        AND id IN (${ticketIdList})
        AND status = 'refunding'
    `),
  ];
  await db.batch(recordStatements as [typeof recordStatements[number], ...typeof recordStatements]);

  const orderStatus = await settleOrderStatus(order.id, input.orderNo);
  return { status: 'refunded', amount: totalAmount, orderStatus, refundVia: 'payment' };
}

/** 다시 읽어 주문 상태를 정한다 — 이 주문의 모든 티켓이 환불/무효면 전액 환불, 아니면 부분 환불. */
async function settleOrderStatus(orderId: string, orderNo: string): Promise<'refunded' | 'partially_refunded'> {
  const db = getDb();
  const remainingTickets = await db.query.showTickets.findMany({
    where: (t, { eq }) => eq(t.orderNo, orderNo),
  });
  const allSettled = remainingTickets.every((t) => t.status === 'refunded' || t.status === 'void');
  const orderStatus: 'refunded' | 'partially_refunded' = allSettled ? 'refunded' : 'partially_refunded';
  await db.run(sql`
    UPDATE orders SET status = ${orderStatus}, updated_at = unixepoch()
    WHERE id = ${orderId} AND status IN ('paid', 'partially_refunded')
  `);
  return orderStatus;
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
 * - **'refunding' 상태의 티켓**은 이 이벤트가 실제로 정산하는 티켓 집합만 'refunded'로
 *   넘긴다. `refundShowTickets`가 남긴 태그(`tkt-refund:<orderNo>:<ticketId1,ticketId2,…>`)에서
 *   그 집합을 그대로 복원할 수 있다 — 태그 안에 정확히 그 환불이 겨냥한 티켓 id들이 정렬돼
 *   들어 있기 때문이다(`ticketRefundIdempotencyKey`). 이 스코프 없이 주문의 'refunding' 전부를
 *   쓸어 담으면, 같은 주문의 서로 다른 두 티켓을 각각 다른 시점에 환불 중일 때 한쪽 이벤트가
 *   먼저 도착해 **아직 정산되지 않은 다른 티켓**까지 'refunded'로 확정해 버린다 — 그 뒤 그
 *   티켓의 토스 취소가 실제로 거절되면, 실패 경로의 revertClaim이 "이미 'refunded'라
 *   'refunding'이 아니다"로 0행을 매치해 아무 것도 되돌리지 못하고, 돈이 안 돌아간 티켓이
 *   'refunded'로 남는다. `tkt-refund:` 태그가 아닌 경우(자동 취소·회차 취소, 또는 태그
 *   없음)는 원래부터 주문 전체를 대상으로 하는 흐름이라 그대로 넓게 정리한다.
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

  // `tkt-refund:` 태그면 이 이벤트가 정산하는 정확한 티켓 id 집합을 태그에서 복원한다 —
  // 없으면(다른 태그·태그 없음) null로 두고 아래에서 주문 전체를 대상으로 한다.
  const TICKET_REFUND_TAG_PREFIX = 'tkt-refund:';
  let scopedTicketIds: string[] | null = null;
  if (tag && tag.startsWith(TICKET_REFUND_TAG_PREFIX)) {
    const rest = tag.slice(TICKET_REFUND_TAG_PREFIX.length);
    const sepIndex = rest.indexOf(':');
    if (sepIndex !== -1) {
      const tagOrderNo = rest.slice(0, sepIndex);
      const idsPart = rest.slice(sepIndex + 1);
      if (tagOrderNo === orderNo && idsPart.length > 0) {
        scopedTicketIds = idsPart.split(',');
      }
    }
  }

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
  // 확인이 왔다는 것 자체가 그 선점을 확정할 근거다 — 단, scopedTicketIds가 있으면(위에서
  // tkt-refund 태그를 복원했으면) **이 이벤트가 실제로 겨냥한 티켓만** 넘긴다. 주문의
  // 'refunding' 전부를 쓸어 담으면, 같은 주문의 다른 티켓이 별도로 진행 중인 환불까지
  // 이 이벤트가 가로채 확정해 버릴 수 있다(이 파일 상단 함수 설명 참조).
  if (scopedTicketIds) {
    const scopedIdList = sql.join(
      scopedTicketIds.map((id) => sql`${id}`),
      sql`, `,
    );
    await db.run(sql`
      UPDATE show_tickets SET status = 'refunded'
      WHERE order_no = ${orderNo} AND id IN (${scopedIdList}) AND status = 'refunding'
    `);
  } else {
    await db.run(sql`
      UPDATE show_tickets SET status = 'refunded'
      WHERE order_no = ${orderNo} AND status = 'refunding'
    `);
  }

  if (nextStatus === 'refunded') {
    // 전액 취소로 판정될 때만 — 어느 티켓인지 몰라 못 정하는 문제가 없다(전부 다다).
    await db.run(sql`UPDATE show_tickets SET status = 'void' WHERE order_no = ${orderNo} AND status = 'held'`);
    await db.run(sql`UPDATE show_tickets SET status = 'refunded' WHERE order_no = ${orderNo} AND status = 'issued'`);
  }
}
