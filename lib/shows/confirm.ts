import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import type { Order } from '../../db/schema';
import { refundIdempotencyKey, remainingRefundable } from '../booking/cancel';
import type { TossPayment } from '../booking/toss';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import { SEND_PENDING } from '../ops/notificationSentinel';
import { liveShowtimeCondition, zoneCapacityCondition, ticketTypeQuotaCondition } from './conditions';
import { rowsAffectedOf } from './service';
import { DECLINE_CODE_PATTERN } from './tossCodes';

export type ConfirmOutcome =
  | { status: 'confirmed' }
  | { status: 'already_confirmed' }
  | { status: 'declined'; code: string }
  | { status: 'sold_out' }
  /**
   * payments.payment_key UNIQUE 충돌로 batch가 실패했는데, 그 기존 행을 남긴 쪽이 이
   * confirmShowOrder 실행이 아니라 autoCancelShowApproval이었던 경우. `already_confirmed`와
   * 구별해야 하는 이유: `already_confirmed`는 "이 주문은 이미 paid다, 손댈 것 없다"는 뜻인데
   * 여기서는 주문이 실제로 refunded로 끝났다 — 같은 라벨을 쓰면 호출부가 "결제 확인됨"으로
   * 잘못 읽어 이미 환불된 주문의 티켓을 보여줄 수 있다(Task 15 race 테스트가 발견한 실제
   * 경합 결과 — sold_out과 달리 orders UPDATE의 rowsAffected가 아니라 payments INSERT의
   * UNIQUE 충돌로 드러나므로 별도 분기가 필요했다).
   */
  | { status: 'auto_cancel_conflict' }
  | { status: 'amount_mismatch' }
  | { status: 'error'; code: string };

/** 이미 결론이 난 주문 — 재확인 요청은 재생(replay)으로 처리하고 다시 승인을 부르지 않는다. */
const CONCLUDED_STATUSES: ReadonlyArray<Order['status']> = ['paid', 'partially_refunded', 'refunded'];

/** 토스가 "이미 승인된 결제"에 재승인을 요청받았을 때 돌려주는 코드. 실패가 아니라 지연 신호다.
 * lib/booking/confirm.ts·lib/funding/confirm.ts와 같은 이유로 의도적으로 복제해 둔다(두 모듈의
 * import 그래프를 shows와 섞지 않기 위해). */
const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';

/**
 * `confirmPayment` 호출이 "거절이 아닌" 이유로 결론을 내지 못했을 때 공통으로 쓰는 코드.
 *
 * booking(`lib/booking/confirm.ts`)의 `toss_rejected`와 같은 자리다 — 이름을 다르게 지은
 * 이유는 이 코드가 "토스가 거절했다"가 아니라 "토스에 물어봤는데 확답을 못 받았다"는 뜻이라서다
 * (NETWORK_ERROR·CONFIG_ERROR로 응답 자체를 못 받은 경우, 그리고 ALREADY_PROCESSED_PAYMENT
 * 재조회가 실패하거나 검증에 실패해 "그때 실제로 뭐가 승인됐는지 모르는" 경우가 전부 여기
 * 모인다). booking이 이 전부를 한 코드로 묶는 것과 정확히 같은 이유로 여기서도 한 코드로
 * 묶는다 — `isTransientShowConfirmFailure`(lib/booking/webhook.ts)가 이 코드 하나만 보고
 * "재시도할 가치가 있다"고 판단하려면, 재시도로 회복 가능한 실패가 전부 이 코드로 수렴해야
 * 한다. 흩어져 있으면(raw NETWORK_ERROR/CONFIG_ERROR/ALREADY_PROCESSED_PAYMENT 문자열을
 * 그대로 돌려주면) 웹훅이 그중 일부만 재시도하고 나머지는 200으로 끝내 버려, "토스에서는
 * 승인됐는데 우리 쪽엔 영원히 기록되지 않는" 상태가 남는다 — 이 계획의 전역 제약이 명시적으로
 * 경계하는 실패 형태다.
 *
 * DECLINE_CODE_PATTERN에 걸리는 코드(`declined`)와 `not_found`·`invalid_status`·
 * `amount_mismatch`·`recording_failed`는 이 코드로 묶지 않는다 — 전부 "재시도해도 같은 답이
 * 나오는" 별개의 최종 결론이거나(전자 넷), "우리 쪽 기록 여부를 모른다"는 다른 종류의 불확실성
 * (recording_failed, batch 실패 후 멱등 조회까지 실패한 경우)이다.
 */
const TOSS_UNRESOLVED_CODE = 'toss_unresolved';

/**
 * 토스 결제 승인 확인 + 티켓 발급.
 *
 * lib/booking/confirm.ts의 confirmBookingPayment을 이식한 shows 버전이다. booking 모듈과
 * 달리 이 도메인엔 좌석 홀드 만료 재확인·캘린더 충돌 재확인 같은 세션 전용 단계가 없어
 * 그 부분은 가져오지 않았고, 나머지 뼈대(재확인 멱등 판정 → 상태 게이트 → 금액 검증 →
 * 토스 승인 호출 → DECLINE 낙인 vs 내부 오류 구분 → batch 전이 → 0행이면 sold_out)는
 * 그대로 옮겼다.
 *
 * `auto_cancel_pending`(db/schema.ts orderStatusEnum)은 여기 acceptableStatuses에
 * **의도적으로 넣지 않는다** — 그 값은 autoCancelShowApproval이 붙잡은 주문이 지금
 * 자동 취소 처리 중이라는 소유권 표식이다. 여기서 그 상태를 받아 주면(웹훅 신뢰 경로라도)
 * 같은 주문이 "확정됨"과 "취소 중"으로 동시에 진행될 수 있다. lib/booking/confirm.ts에는
 * 대응하는 상태 자체가 없다(그 모듈의 자동 취소는 같은 함수 호출 안에서 동기로 끝나
 * 다른 호출이 끼어들 여지가 없다) — 그래서 "웹훅이 이 상태에서 복구해야 한다"는 마땅히
 * 따를 선례가 없고, 대신 안전한 기본값(거부)을 택했다. 자동 취소가 실패해 선점을
 * 되돌리면(autoCancelShowApproval의 revertClaim) 주문은 pending/expired/failed 중 하나로
 * 돌아가므로, 그 뒤에 온 웹훅 재시도는 정상적으로 acceptableStatuses를 통과한다.
 */
export async function confirmShowOrder(
  input: { orderNo: string; paymentKey: string; amount: number },
  opts: { trustedByWebhook: boolean },
  toss: Pick<FakeToss, 'confirmPayment' | 'fetchPayment' | 'cancelPayment'>,
): Promise<ConfirmOutcome> {
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, input.orderNo) });
  if (!order) return { status: 'error', code: 'not_found' };

  // 재생(새로고침·웹훅 중복 도착) — 이미 결론이 난 주문은 다시 승인을 부르지 않는다.
  if (CONCLUDED_STATUSES.includes(order.status)) {
    return { status: 'already_confirmed' };
  }

  // 웹훅 신뢰 경로는 pending 외에 expired·failed도 받는다(booking과 같은 이유 — 토스가
  // 이미 DONE으로 승인한 결제인데 우리 쪽 만료·거절 처리가 먼저 찍혔을 수 있다).
  // auto_cancel_pending은 위 주석대로 어느 경로에도 넣지 않는다.
  const acceptableStatuses: ReadonlyArray<Order['status']> = opts.trustedByWebhook
    ? ['pending', 'expired', 'failed']
    : ['pending'];
  if (!acceptableStatuses.includes(order.status)) {
    return { status: 'error', code: 'invalid_status' };
  }

  // 서버가 저장한 금액이 유일한 진실 — 토스를 부르기 전에 위변조를 차단한다.
  if (order.totalAmount !== input.amount) {
    return { status: 'amount_mismatch' };
  }

  const result = await toss.confirmPayment({ paymentKey: input.paymentKey, orderId: input.orderNo, amount: input.amount });

  let approved: TossPayment;
  if (result.ok) {
    approved = result.payment;
  } else if (DECLINE_CODE_PATTERN.test(result.code)) {
    // DECLINE_CODE_PATTERN(allowlist)에 걸릴 때만 failed로 낙인한다 — NETWORK_ERROR·
    // CONFIG_ERROR 같은 "물어보지도 못한" 오류는 주문 상태를 건드리지 않는다(booking과 동일
    // 원칙 — 과소 낙인은 스스로 치유되지만 과대 낙인은 아니다).
    await db.run(sql`
      UPDATE orders SET status = 'failed', updated_at = unixepoch()
      WHERE id = ${order.id} AND status = 'pending'
    `);
    return { status: 'declined', code: result.code };
  } else if (result.code === ALREADY_PROCESSED_CODE) {
    // 토스는 이미 승인된 결제의 재승인을 거절한다 — "실패"가 아니라 "우리 DB만 뒤처졌다"는
    // 신호다(lib/booking/confirm.ts의 동일 분기와 같은 뜻). 재조회로 실제 승인 사실을 확인한
    // 뒤 정상 승인과 같은 경로(위 if(result.ok) 분기와 합류)로 기록한다 — 별도 분기로 두지
    // 않는다.
    const refetched = await toss.fetchPayment(input.paymentKey);
    if (!refetched.ok) {
      console.error('[shows-confirm] 이미 처리된 결제의 재조회 실패 — 판정 보류(재시도 대상)', {
        orderNo: input.orderNo,
        paymentKey: input.paymentKey,
        code: refetched.code,
        message: refetched.message,
      });
      return { status: 'error', code: TOSS_UNRESOLVED_CODE };
    }
    // 페이로드가 아니라 재조회 결과만 믿는다 — 주문번호·금액·상태 셋 다 우리 주문과 맞아야 한다.
    const payment = refetched.payment;
    if (payment.status !== 'DONE' || payment.orderId !== order.orderNo || payment.totalAmount !== order.totalAmount) {
      console.error('[shows-confirm] 이미 처리된 결제의 재조회 검증 불일치 — 기록하지 않는다(재시도 대상)', {
        orderNo: input.orderNo,
        paymentKey: input.paymentKey,
        status: payment.status,
        orderId: payment.orderId,
        totalAmount: payment.totalAmount,
      });
      return { status: 'error', code: TOSS_UNRESOLVED_CODE };
    }
    approved = payment;
  } else {
    // NETWORK_ERROR·CONFIG_ERROR, 그리고 거절 패턴에도 ALREADY_PROCESSED_CODE에도 걸리지
    // 않는 그 밖의 모든 코드 — "물어보지도 못했다" 계열이라 failed로 낙인하지 않고, 재시도
    // 가치가 있는 하나의 코드로 정규화한다(위 TOSS_UNRESOLVED_CODE 주석 참조).
    console.error('[shows-confirm] 토스 승인 실패(거절 아님) — 판정 보류(재시도 대상)', {
      orderNo: input.orderNo,
      paymentKey: input.paymentKey,
      tossCode: result.code,
      tossMessage: result.message,
    });
    return { status: 'error', code: TOSS_UNRESOLVED_CODE };
  }

  const approvedAtSec = approved.approvedAt ? Math.floor(new Date(approved.approvedAt).getTime() / 1000) : null;
  const statusList = sql.join(
    acceptableStatuses.map((s) => sql`${s}`),
    sql`, `,
  );

  // Toss 승인을 이미 받은 뒤(approved)에도 이 주문이 실제로 확정될 자격이 있는지 다시
  // 확인한다 — 상태값(acceptableStatuses)만으로는 부족하다(finding #1). 아래 네 조건을
  // orders-UPDATE의 WHERE에 전부 건다:
  //  ① 회차가 아직 살아 있다(취소되지 않았고 아직 시작 전) — liveShowtimeCondition.
  //     이 함수는 db/schema.ts·conditions.ts에 이미 있었지만 지금까지 호출자가 하나도
  //     없었다(grep으로 확인 — 정의만 되고 안 쓰이고 있었다).
  //  ② 이 주문의 티켓 중 하나라도 이미 'held'를 벗어났으면(예: expireStaleShowOrders가
  //     유예를 지나 void 처리한 경우) 확정하지 않는다 — "만료 처리된 뒤 뒤늦게 도착한
  //     웹훅 확인"이 그대로 paid로 넘어가 버리는 사고(§ 재현 시나리오 3)를 막는다.
  //  ③ 이 주문에 대해 자동 취소가 이미 완료됐으면(show_orders.auto_cancelled_at) 확정하지
  //     않는다 — acceptableStatuses가 auto_cancel_pending을 안 받아 들이는 것과 같은 뜻을
  //     한 겹 더 명시적으로 건다(진행 중이 아니라 "완료"까지 끝난 경우의 방어).
  //  ④ 이 주문을 뺀 나머지의 정원·한도가 여전히 이 주문 수량만큼 남아 있다
  //     (zoneCapacityCondition/ticketTypeQuotaCondition의 excludeOrderNo) — 생성 시점의
  //     정원 게이트는 "홀드가 시간상 만료됐으면 세지 않는다"는 규칙이 있어(정상이다, 새
  //     구매자에게 자리를 열어 주는 목적), 홀드가 실제로는 아직 안 지워진 주문 A와 그 뒤
  //     생성된 주문 B가 동시에 같은 자리를 붙들고 있을 수 있다(재현 시나리오 1의 오버셀).
  //     확정 시점에 "나를 뺀 나머지"로 다시 재는 것이 그 이중 확정을 막는 유일한 지점이다
  //     — excludeOrderNo 매개변수는 이 재사용을 위해 이미 있었지만(정의 이후 호출자 0건)
  //     지금까지 아무도 부르지 않고 있었다.
  const showOrderRow = await db.query.showOrders.findFirst({ where: (so, { eq }) => eq(so.orderNo, input.orderNo) });
  const orderTicketRows = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, input.orderNo) });
  const now = new Date();
  let extraGate = sql`1 = 1`;
  if (showOrderRow && orderTicketRows.length > 0) {
    const showtimeId = showOrderRow.showtimeId;
    const ticketTypeId = orderTicketRows[0].ticketTypeId;
    const quantity = orderTicketRows.length;
    const ticketType = await db.query.showTicketTypes.findFirst({ where: (t, { eq }) => eq(t.id, ticketTypeId) });
    extraGate = sql`
      ${liveShowtimeCondition(showtimeId, now)}
      AND NOT EXISTS (SELECT 1 FROM show_tickets WHERE order_no = ${input.orderNo} AND status <> 'held')
      AND NOT EXISTS (SELECT 1 FROM show_orders WHERE order_no = ${input.orderNo} AND auto_cancelled_at IS NOT NULL)
      ${
        ticketType
          ? sql`AND ${zoneCapacityCondition(showtimeId, ticketType.zoneId, quantity, now, input.orderNo)}
                AND ${ticketTypeQuotaCondition(showtimeId, ticketTypeId, quantity, now, input.orderNo)}`
          : sql``
      }
    `;
  }

  let batchResults: unknown[];
  try {
    // payments INSERT가 맨 앞 — payment_key unique 위반이 동시 확정(중복 웹훅 도착, 또는
    // 이 실행과 경합하는 다른 실행)의 두 번째 시도를 batch 전체 실패로 만든다(절반만
    // 쓰인 상태가 남지 않는다). lib/booking/confirm.ts:593-663과 같은 이유·같은 위치다.
    const confirmStatements = [
      db.run(sql`
        INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
        VALUES (
          ${randomUUID().replace(/-/g, '')},
          ${order.id},
          ${approved.paymentKey},
          ${approved.method ?? null},
          ${approvedAtSec},
          ${approved.receipt?.url ?? null},
          ${JSON.stringify(approved)}
        )
      `),
      db.run(sql`
        UPDATE orders SET status = 'paid', updated_at = unixepoch(), notification_error = ${SEND_PENDING}
        WHERE id = ${order.id} AND status IN (${statusList}) AND ${extraGate}
      `),
      // 하위 전이(show_tickets)는 **주문이 실제로 paid가 됐을 때만** 한다(lib/booking/confirm.ts:
      // 618-636과 같은 EXISTS 가드). batch는 한 트랜잭션이라 바로 위 UPDATE의 결과를 여기서
      // 읽을 수 있다 — 이 가드가 없으면, orders 전이가 0행이 되는 경합(다른 실행이 먼저
      // auto_cancel_pending으로 붙잡은 경우 등)에서도 이 시점의 티켓은 아직 'held'라서
      // WHERE order_no=? AND status='held'가 그대로 매치돼 orders는 paid가 아닌데 티켓만
      // issued로 바뀐다 — 곧 refunded될 주문의 티켓이 발권된 것처럼 보이는 유령 발권이다.
      db.run(sql`
        UPDATE show_tickets SET status = 'issued'
        WHERE order_no = ${input.orderNo} AND status = 'held'
          AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')
      `),
    ];
    batchResults = await db.batch(confirmStatements as [typeof confirmStatements[number], ...typeof confirmStatements]);
  } catch (error) {
    // 토스 승인은 이미 끝났다 — 이 실패가 "동시 확정에서 다른 쪽이 이겼다"(멱등, payment_key
    // unique 위반)인지 "진짜 DB 장애"인지는 payments에 이 paymentKey가 이미 있는지로 가른다
    // (lib/booking/confirm.ts:638-663과 동일 판정).
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({
        where: (t, { eq }) => eq(t.paymentKey, approved.paymentKey),
      });
    } catch (lookupError) {
      console.error('[shows-confirm] 멱등 판정 조회 실패', {
        orderNo: input.orderNo,
        paymentKey: approved.paymentKey,
        error: lookupError,
      });
    }
    if (existing) {
      // 다른 실행이 이미 이 paymentKey로 payments 행을 남겼다 — 하지만 그게 "진짜 재생"(다른
      // confirmShowOrder 실행이 이겨서 주문이 paid)인지, "autoCancelShowApproval이 먼저 완주해
      // 주문이 refunded로 끝났는데 그 행이 이 paymentKey를 선점한 것"인지는 payments 행의
      // 존재만으로 알 수 없다 — 주문의 현재 상태를 다시 읽어야 가른다(Task 15 race 테스트가
      // 실제로 후자를 재현해 이 구분 없이는 refunded 주문을 already_confirmed로 잘못
      // 보고한다는 것을 확인했다).
      let current: Order | undefined;
      try {
        current = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, order.id) });
      } catch (statusLookupError) {
        console.error('[shows-confirm] 경합 판정을 위한 주문 상태 재조회 실패', {
          orderNo: input.orderNo,
          paymentKey: approved.paymentKey,
          error: statusLookupError,
        });
      }
      if (current && current.status !== 'paid' && current.status !== 'partially_refunded') {
        // 주문이 paid(또는 이미 그 위에서 부분환불이 시작된) 상태가 아니다 — 이 confirm
        // 시도는 진짜 재생이 아니라 auto-cancel과의 경합에서 졌다. 호출부가 "결제
        // 확인됨"으로 오독하지 않도록 별도 결과로 보고한다.
        return { status: 'auto_cancel_conflict' };
      }
      // 주문이 paid/partially_refunded다 — 다른 confirmShowOrder 실행(또는 그 재생)이 이미
      // 이 결제를 정상 기록했다는 뜻이다. 재생으로 처리하고 다시 예외를 던지지 않는다.
      return { status: 'already_confirmed' };
    }
    console.error('[shows-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', {
      orderNo: input.orderNo,
      paymentKey: approved.paymentKey,
      error,
    });
    return { status: 'error', code: 'recording_failed' };
  }

  // orders 전이가 0행 — 승인 왕복 사이에 이 주문이 acceptableStatuses를 벗어났거나(다른
  // 실행이 먼저 처리했거나 auto_cancel_pending으로 붙잡혔거나) 위 extraGate(회차 생존·
  // 자기 티켓 held 유지·자동취소 미완료·정원)에 걸렸다. 이 시점에 토스는 이미 승인을
  // 끝냈고, 위 payments INSERT는 (게이트와 무관하게 무조건 실행되므로) 이미 커밋됐다 —
  // 즉 "결제는 캡처됐는데 표는 못 내주는" 상태다(finding #1, "money captured, no ticket").
  // 조용히 sold_out만 반환하면 그 돈이 그대로 우리 쪽에 남는다 — 주문의 현재 상태를 다시
  // 읽어 이미 다른 실행이 결론을 냈는지부터 가른다.
  if (rowsAffectedOf(batchResults[1]) === 0) {
    const current = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, order.id) });
    if (current?.status === 'paid' || current?.status === 'partially_refunded') {
      // 다른 confirmShowOrder 실행이 이미 이 주문을 확정했다 — 재생으로 처리한다.
      return { status: 'already_confirmed' };
    }
    if (current?.status === 'refunded') {
      // auto-cancel이 이미 이 주문을 끝까지 처리했다 — 위 catch 분기의 auto_cancel_conflict와
      // 같은 뜻으로 통일해 호출부가 "결제 확인됨"으로 오독하지 않게 한다.
      return { status: 'auto_cancel_conflict' };
    }
    // 그 밖(여전히 pending/expired/failed/auto_cancel_pending)이면, 이 confirm 시도 자신이
    // 방금 캡처한 결제를 우리가 대신 정리해야 한다 — autoCancelShowApproval과 같은 대사
    // 경로로 즉시 돌려보낸다. 그 함수는 이미 커밋된 payments 행을 자기 배치의 idempotent
    // INSERT(NOT EXISTS 가드, finding #4)로 그대로 재사용하고 취소·환불만 마무리한다.
    // 이 주문이 애초에 auto_cancel_pending 등 claimable하지 않은 상태라면 그 함수는 그저
    // not_eligible로 안전하게 끝난다(아무 것도 건드리지 않는다).
    const reconciled = await autoCancelShowApproval(order.orderNo, toss, approved.paymentKey);
    if (reconciled.status !== 'cancelled') {
      console.error('[shows-confirm] 확정 게이트 실패 후 자동 대사 미완료 — 수동 확인 필요(healthCheck 대상)', {
        orderNo: input.orderNo,
        paymentKey: approved.paymentKey,
        reconcileOutcome: reconciled.status,
      });
    }
    return { status: 'sold_out' };
  }

  if (rowsAffectedOf(batchResults[2]) === 0) {
    console.error('[shows-confirm] show_tickets 전이 0행 — orders는 전이됨(멱등 재생 등)', {
      orderNo: input.orderNo,
      paymentKey: input.paymentKey,
    });
  }

  await assignEntryNumbers(input.orderNo);
  return { status: 'confirmed' };
}

/**
 * 회차 내 이미 배정된 최대 정리번호 다음부터 순번을 매긴다(스펙 §7.6, 순번은 발권 순서 그대로).
 *
 * `entry_number IS NULL`인 티켓만 배정 대상으로 삼는다 — 이미 번호가 있는 티켓(멱등 재생으로
 * 이 함수가 다시 불려도)을 건드리지 않아야, 재실행이 같은 회차에 중복 번호를 매기지 않는다.
 *
 * **티켓 한 장씩 원자적으로 배정한다** — `SELECT MAX(entry_number)`를 먼저 읽고 그 값 +1을
 * 순서대로 UPDATE에 흘려보내면, 같은 회차의 서로 다른 두 주문이 동시에 확정될 때(고객 둘이
 * 거의 동시에 결제하는 흔한 경우이지 예외적 경합이 아니다) 둘 다 같은 MAX를 읽어 같은 정리
 * 번호를 배정할 수 있다. 그래서 UPDATE 자신의 서브쿼리 안에서 `MAX(entry_number)+1`을
 * 계산한다 — 서브쿼리는 그 UPDATE가 실제로 커밋되는 순간의 값을 보므로, SQLite의 단일
 * writer 직렬화가 두 동시 실행을 자동으로 순서대로 세워 준다(이 계획 전체에서 쓰는 "조건부
 * INSERT/UPDATE로 원자성을 얻는다"는 패턴과 같은 원리). 티켓마다 별도 문장으로 실행해야
 * 한 번의 UPDATE가 커밋된 뒤 다음 UPDATE의 서브쿼리가 그 값을 반영한다 — 여러 티켓을
 * 하나의 batch(=하나의 트랜잭션)에 넣으면 그 안에서는 아직 서로의 커밋을 볼 수 없어
 * 같은 문제가 재발한다.
 */
async function assignEntryNumbers(orderNo: string): Promise<void> {
  const db = getDb();
  const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
  const unassigned = tickets.filter((t) => t.entryNumber == null);
  if (unassigned.length === 0) return;

  const showtimeId = unassigned[0].showtimeId;
  for (const t of unassigned) {
    await db.run(sql`
      UPDATE show_tickets
      SET entry_number = (SELECT COALESCE(MAX(entry_number), 0) + 1 FROM show_tickets WHERE showtime_id = ${showtimeId})
      WHERE id = ${t.id} AND entry_number IS NULL
    `);
  }
}

export type AutoCancelOutcome =
  | { status: 'cancelled' }
  | { status: 'not_eligible' }
  | { status: 'pending_retry' }
  /**
   * 토스 취소는 성공했는데(돈은 이미 돌아갔다) 우리 원장 기록(payments/refunds/orders/
   * show_tickets 전이)이 실패한 경우. `pending_retry`와 달리 **재시도해서는 안 된다** —
   * 재시도하려면 claim을 되돌려 order.status를 claimableStatuses로 되돌려야 하는데, 그러면
   * 다음 실행이 이 주문을 또 붙잡아 **이미 취소된 결제를 다시 취소**하려 든다(토스 멱등키가
   * 있어 두 번째 호출 자체는 안전하지만, 우리 쪽 기록은 여전히 없다 — 문제가 재발할 뿐이다).
   * 그래서 이 결과는 사람이 직접 봐야 하는 영구 실패다(healthCheck·수동 대사 대상).
   */
  | { status: 'ledger_write_failed' };

/** 자동 전액 취소 사유 — refunds.reason(NOT NULL)과 토스 cancelReason에 함께 쓴다. */
const AUTO_CANCEL_REASON = '주문 만료 후 승인 — 자동 전액 취소';

/**
 * 승인은 됐는데(토스 쪽 DONE) 우리 쪽 확정 기록이 없는 주문을 찾아 전액 자동 취소한다.
 *
 * lib/booking/confirm.ts의 autoCancelStaleApproval을 이식하되, 호출 형태가 다르다 — booking
 * 쪽은 confirmBookingPayment 안에서 **이미 승인 응답을 손에 쥔 채로** 호출되는 내부 헬퍼라
 * 별도 소유권 보호가 필요 없다(그 승인을 부른 요청 자신이 유일한 소유자다). 이 함수는
 * **독립된 진입점**으로도 쓸 수 있게 설계됐지만(크론 등이 orderNo만 들고 부르는 것도
 * 지원한다), **paymentKey를 얻는 방법은 booking과 다르다**(finding #3) — 실제
 * `lib/booking/toss.ts`의 `fetchPayment`는 paymentKey로만 결제를 조회한다(orderId 조회는
 * 프로덕션 토스 API에 없다). 그래서 이 함수는:
 *   - `knownPaymentKey`가 주어지면(confirmShowOrder의 대사 분기처럼 호출자가 이미 승인
 *     응답에서 paymentKey를 쥐고 있는 경우) 그대로 쓰고,
 *   - 없으면 `payments` 테이블에서 이 주문의 결제 행을 찾아 paymentKey를 얻는다(이 주문에
 *     대해 이미 한 번이라도 승인·기록 시도가 있었던 경우).
 *   - 어느 쪽도 없으면(토스가 승인했다는 사실 자체를 우리 DB 어디에도 기록한 적이 없는
 *     고아 승인) 이 함수가 안전하게 할 수 있는 일이 없다 — `not_eligible`로 끝낸다. 그런
 *     고아를 orderNo만으로 찾아내는 별도 발견 경로(예: 토스 정산 내역과 대사)는 이 플랜
 *     범위 밖(크론·화면은 후속 PR)이다.
 *
 * 순서: ① 읽은 시점의 status로 정확히 일치하는 CAS 선점 → ② paymentKey 확보(위) → ③ 토스
 * 재조회(fetchPayment)로 실제 이 주문의 결제인지 검증(ALREADY_PROCESSED_PAYMENT 재조회와
 * 같은 판정 — paymentKey·orderId·status가 전부 일치해야 한다) → ④ 이미 done으로 기록된
 * 환불을 뺀 **잔액**만 취소(`remainingRefundable`, 이 주문에 이미 부분환불이 있었을 수
 * 있는 경우를 대비) → ⑤ 실패하면 선점을 원래 상태로 되돌리고 pending_retry(다음 실행이
 * 다시 시도할 수 있게) → ⑥ 성공하면 payments 기록(이미 있으면 건드리지 않는다 —
 * finding #4, confirmShowOrder 자신의 batch가 먼저 남겼을 수 있다) + refunds 기록(역시
 * 같은 토스 거래키로 이미 있으면 건드리지 않는다) + orders→refunded + show_tickets→void +
 * show_orders.auto_cancelled_at을 한 batch로 커밋한다.
 */
export async function autoCancelShowApproval(
  orderNo: string,
  toss: Pick<FakeToss, 'cancelPayment' | 'fetchPayment'>,
  knownPaymentKey?: string,
): Promise<AutoCancelOutcome> {
  const db = getDb();

  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (!order) return { status: 'not_eligible' };

  const claimableStatuses: ReadonlyArray<Order['status']> = ['pending', 'expired', 'failed'];
  if (!claimableStatuses.includes(order.status)) return { status: 'not_eligible' };

  // paymentKey 확보 — 위 docstring 참조. 못 찾으면 여기서 더 할 수 있는 일이 없다(claim도
  // 아직 걸지 않았으니 되돌릴 것도 없다).
  let paymentKey = knownPaymentKey;
  if (!paymentKey) {
    const paymentRow = await db.query.payments.findFirst({ where: (p, { eq }) => eq(p.orderId, order.id) });
    if (!paymentRow) return { status: 'not_eligible' };
    paymentKey = paymentRow.paymentKey;
  }

  const priorStatus = order.status;

  // 소유권 CAS — 읽은 시점의 정확한 상태와 일치할 때만 넘겨받는다. 이미 다른 실행이 붙잡아
  // auto_cancel_pending으로 바뀐 뒤라면(또는 그 사이 확정·만료 처리로 상태가 또 바뀌었다면)
  // 이 UPDATE는 0행이 되어 진 쪽은 토스를 아예 부르지 않는다.
  const claim = await db.run(sql`
    UPDATE orders SET status = 'auto_cancel_pending', updated_at = unixepoch()
    WHERE id = ${order.id} AND status = ${priorStatus}
  `);
  if (rowsAffectedOf(claim) === 0) return { status: 'not_eligible' };

  const revertClaim = async (): Promise<void> => {
    try {
      await db.run(sql`
        UPDATE orders SET status = ${priorStatus}, updated_at = unixepoch()
        WHERE id = ${order.id} AND status = 'auto_cancel_pending'
      `);
    } catch (error) {
      console.error('[shows-confirm] 자동 취소 선점 revert 실패 — 수동 복구 필요', { orderNo, error });
    }
  };

  const fetched = await toss.fetchPayment(paymentKey);
  if (!fetched.ok) {
    await revertClaim();
    return { status: 'pending_retry' };
  }
  const approved = fetched.payment;
  // 재조회 결과가 실제로 이 주문·이 paymentKey의 것인지 확인한다 — confirmShowOrder의
  // ALREADY_PROCESSED_PAYMENT 재조회 검증과 같은 판정이다. 페이로드나 호출자 주장을
  // 그대로 믿지 않는다.
  if (approved.paymentKey !== paymentKey || approved.orderId !== order.orderNo || approved.status !== 'DONE') {
    console.error('[shows-confirm] 자동 취소 재조회 검증 불일치 — 취소하지 않는다(재시도 대상)', {
      orderNo,
      paymentKey,
      fetchedOrderId: approved.orderId,
      fetchedStatus: approved.status,
    });
    await revertClaim();
    return { status: 'pending_retry' };
  }

  // 이 주문에 이미(부분) 환불이 기록돼 있을 수 있으므로 approved.totalAmount를 그대로
  // 취소하지 않고 잔액만 취소한다. claimableStatuses(pending/expired/failed)인 주문은
  // 지금 설계상 refundShowTickets를 거친 적이 없어 실제로는 항상 잔액=totalAmount지만,
  // 방어적으로 항상 재계산한다(booking·funding 전역에서 remainingRefundable을 쓰는 것과
  // 같은 원칙 — "이 주문에 얼마나 남았는지"를 매번 다시 묻는다).
  const existingPaymentRow = await db.query.payments.findFirst({ where: (p, { eq }) => eq(p.paymentKey, paymentKey!) });
  let remaining = approved.totalAmount;
  if (existingPaymentRow) {
    const existingRefunds = await db.query.refunds.findMany({ where: (r, { eq }) => eq(r.paymentId, existingPaymentRow.id) });
    remaining = remainingRefundable(order, [{ ...existingPaymentRow, refunds: existingRefunds }]);
  }
  if (remaining <= 0) {
    await revertClaim();
    return { status: 'not_eligible' };
  }

  const idempotencyKey = refundIdempotencyKey(orderNo, remaining, 'autocancel');
  const cancelled = await toss.cancelPayment({
    paymentKey,
    cancelReason: `[#${idempotencyKey}] ${AUTO_CANCEL_REASON}`,
    cancelAmount: remaining,
    idempotencyKey,
  });
  if (!cancelled.ok) {
    await revertClaim();
    return { status: 'pending_retry' };
  }

  const cancelledPayment = cancelled.payment;
  const transactionKey = cancelledPayment.cancels?.[cancelledPayment.cancels.length - 1]?.transactionKey ?? null;
  const paymentId = randomUUID().replace(/-/g, '');
  const approvedAtSec = cancelledPayment.approvedAt ? Math.floor(new Date(cancelledPayment.approvedAt).getTime() / 1000) : null;
  const nowSec = Math.floor(Date.now() / 1000);

  const autoCancelStatements = [
    // 이 주문에 대해 confirmShowOrder(또는 이전 실행)가 이미 payments 행을 남겼을 수 있다
    // (finding #1의 대사 분기가 바로 이 경로를 탄다, finding #4). WHERE NOT EXISTS로
    // 있으면 건드리지 않는다 — payment_key UNIQUE 위반으로 이 batch 전체가 실패해
    // "토스 취소는 성공했는데 우리 기록만 실패한" 상태(ledger_write_failed)가 되는 것을
    // 막는다. 스펙 §7.5 4단계와 같은 패턴.
    db.run(sql`
      INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
      SELECT ${paymentId}, ${order.id}, ${cancelledPayment.paymentKey}, ${cancelledPayment.method ?? null},
             ${approvedAtSec}, ${cancelledPayment.receipt?.url ?? null}, ${JSON.stringify(cancelledPayment)}
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE payment_key = ${cancelledPayment.paymentKey})
    `),
    // payment_id는 위 INSERT가 실제로 쓴 값이 아니라 payment_key로 다시 찾은 행의 id를
    // 쓴다 — 위 INSERT가 NOT EXISTS로 건너뛰어졌을 때도(이미 있던 행) 그 행의 진짜 id를
    // 가리켜야 한다. 같은 토스 거래키의 환불이 이미 있으면(다른 실행이 먼저 기록) 역시
    // 건드리지 않는다.
    db.run(sql`
      INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
      SELECT lower(hex(randomblob(16))), p.id, ${remaining}, ${AUTO_CANCEL_REASON}, 'admin', ${transactionKey}, 'done'
      FROM payments p
      WHERE p.payment_key = ${cancelledPayment.paymentKey}
        AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.payment_id = p.id AND r.toss_transaction_key = ${transactionKey})
    `),
    db.run(sql`
      UPDATE orders SET status = 'refunded', updated_at = unixepoch()
      WHERE id = ${order.id} AND status = 'auto_cancel_pending'
    `),
    db.run(sql`
      UPDATE show_tickets SET status = 'void'
      WHERE order_no = ${orderNo} AND status = 'held'
    `),
    db.run(sql`
      UPDATE show_orders SET auto_cancelled_at = ${nowSec}
      WHERE order_no = ${orderNo}
    `),
  ];

  try {
    await db.batch(autoCancelStatements as [typeof autoCancelStatements[number], ...typeof autoCancelStatements]);
  } catch (error) {
    // 토스 취소는 이미 끝났다(돈은 돌아갔다) — 여기서 claim을 되돌리면 안 된다. 되돌리면
    // order.status가 다시 claimableStatuses로 들어가 다음 실행이 이 주문을 또 붙잡아
    // 토스에 두 번째 취소를 요청한다(멱등키 덕분에 그 호출 자체는 안전하지만, 우리 원장에는
    // 여전히 기록이 없어 이 실패가 그대로 반복된다). 대신 영구 실패로 끝내고 사람이 보게 한다.
    console.error('[shows-confirm] 토스 취소는 성공했으나 원장 기록 실패 — 수동 대사 필요(claim을 되돌리지 않음)', {
      orderNo,
      paymentKey: cancelledPayment.paymentKey,
      transactionKey,
      amount: remaining,
      error,
    });
    return { status: 'ledger_write_failed' };
  }

  return { status: 'cancelled' };
}
