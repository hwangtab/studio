import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import type { Order } from '../../db/schema';
import { refundIdempotencyKey } from '../booking/cancel';
import type { TossPayment } from '../booking/toss';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import { rowsAffectedOf } from './service';
import { DECLINE_CODE_PATTERN } from './tossCodes';

export type ConfirmOutcome =
  | { status: 'confirmed' }
  | { status: 'already_confirmed' }
  | { status: 'declined'; code: string }
  | { status: 'sold_out' }
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
  toss: Pick<FakeToss, 'confirmPayment' | 'fetchPayment'>,
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

  let batchResults: unknown[];
  try {
    // payments INSERT가 맨 앞 — payment_key unique 위반이 동시 확정(중복 웹훅 도착, 또는
    // 이 실행과 경합하는 다른 실행)의 두 번째 시도를 batch 전체 실패로 만든다(절반만
    // 쓰인 상태가 남지 않는다). lib/booking/confirm.ts:593-663과 같은 이유·같은 위치다.
    batchResults = await db.batch([
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
        UPDATE orders SET status = 'paid', updated_at = unixepoch()
        WHERE id = ${order.id} AND status IN (${statusList})
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
    ] as [any, any, any]);
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
      // 다른 실행이 이미 이 결제를 기록했다 — 재생으로 처리하고 다시 예외를 던지지 않는다.
      return { status: 'already_confirmed' };
    }
    console.error('[shows-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', {
      orderNo: input.orderNo,
      paymentKey: approved.paymentKey,
      error,
    });
    return { status: 'error', code: 'recording_failed' };
  }

  // orders 전이가 0행 — 승인 왕복 사이에 이 주문이 acceptableStatuses를 벗어났다(다른 실행이
  // 먼저 처리했거나 auto_cancel_pending으로 붙잡혔거나). booking 모듈은 이 경우 전액 자동
  // 환불(autoCancelStaleApproval)로 이어지지만, 그 함수는 이 도메인에서 별도로 호출되는
  // 독립 진입점(autoCancelShowApproval, 아래)이라 여기서 직접 부르지 않는다 — 두 경로가
  // 같은 주문을 동시에 취소 시도하면 토스 취소 API가 중복 호출된다. 여기서는 "이 확인
  // 시도는 성사되지 않았다"만 보고한다.
  if (rowsAffectedOf(batchResults[1]) === 0) {
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
 * 반대로 **독립된 진입점**이다(크론 등이 orderNo만 들고 부른다) — "토스는 승인했다고 하는데
 * 우리 결제 기록(`payments`)은 없는" 주문을 나중에 찾아서 돈을 돌려주는 별도 배치이므로,
 * 두 실행(크론 중복 기동, 또는 이 실행과 그 사이 뒤늦게 도착한 confirmShowOrder 웹훅 재시도)이
 * 동시에 같은 주문을 붙잡지 못하게 소유권 CAS가 필요하다. 그래서 db/schema.ts에
 * `auto_cancel_pending`을 추가해 "지금 이 실행이 취소를 처리 중"이라는 표식으로 쓴다.
 *
 * 순서: ① 읽은 시점의 status로 정확히 일치하는 CAS 선점 → ② 토스 재조회(fetchPayment)로
 * paymentKey·금액 확인 → ③ 전액 취소 호출 → ④ 실패하면 선점을 원래 상태로 되돌리고
 * pending_retry(다음 크론 실행이 다시 시도할 수 있게) → ⑤ 성공하면 payments 기록(이 주문은
 * 애초에 confirmShowOrder를 거치지 않았으므로 payments 행이 아직 없다 — booking 쪽처럼
 * "이미 있는 행을 조회해 되찾는" 것이 아니라 여기서 새로 남긴다) + refunds 기록 +
 * orders→refunded + show_tickets→void + show_orders.auto_cancelled_at을 한 batch로 커밋한다.
 */
export async function autoCancelShowApproval(
  orderNo: string,
  toss: Pick<FakeToss, 'cancelPayment' | 'fetchPayment'>,
): Promise<AutoCancelOutcome> {
  const db = getDb();

  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (!order) return { status: 'not_eligible' };

  const claimableStatuses: ReadonlyArray<Order['status']> = ['pending', 'expired', 'failed'];
  if (!claimableStatuses.includes(order.status)) return { status: 'not_eligible' };

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

  const fetched = await toss.fetchPayment(orderNo);
  if (!fetched.ok) {
    await revertClaim();
    return { status: 'pending_retry' };
  }
  const approved = fetched.payment;

  const idempotencyKey = refundIdempotencyKey(orderNo, approved.totalAmount, 'autocancel');
  const cancelled = await toss.cancelPayment({
    paymentKey: approved.paymentKey,
    cancelReason: `[#${idempotencyKey}] ${AUTO_CANCEL_REASON}`,
    cancelAmount: approved.totalAmount,
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

  try {
    await db.batch([
      // 이 주문은 confirmShowOrder를 거친 적이 없으므로 payments 행이 아직 없다 — 여기서
      // 처음이자 마지막으로 남긴다(승인·취소가 함께 있었다는 사실 자체를 기록으로 남긴다).
      db.run(sql`
        INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
        VALUES (
          ${paymentId}, ${order.id}, ${cancelledPayment.paymentKey}, ${cancelledPayment.method ?? null},
          ${approvedAtSec}, ${cancelledPayment.receipt?.url ?? null}, ${JSON.stringify(cancelledPayment)}
        )
      `),
      db.run(sql`
        INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
        VALUES (
          ${randomUUID().replace(/-/g, '')}, ${paymentId}, ${approved.totalAmount}, ${AUTO_CANCEL_REASON},
          'admin', ${transactionKey}, 'done'
        )
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
    ] as [any, any, any, any, any]);
  } catch (error) {
    // 토스 취소는 이미 끝났다(돈은 돌아갔다) — 여기서 claim을 되돌리면 안 된다. 되돌리면
    // order.status가 다시 claimableStatuses로 들어가 다음 크론 실행이 이 주문을 또 붙잡아
    // 토스에 두 번째 취소를 요청한다(멱등키 덕분에 그 호출 자체는 안전하지만, 우리 원장에는
    // 여전히 기록이 없어 이 실패가 그대로 반복된다). 대신 영구 실패로 끝내고 사람이 보게 한다.
    console.error('[shows-confirm] 토스 취소는 성공했으나 원장 기록 실패 — 수동 대사 필요(claim을 되돌리지 않음)', {
      orderNo,
      paymentKey: cancelledPayment.paymentKey,
      transactionKey,
      amount: approved.totalAmount,
      error,
    });
    return { status: 'ledger_write_failed' };
  }

  return { status: 'cancelled' };
}
