import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refundIdempotencyKey, remainingRefundable, type PaymentWithRefunds } from '../booking/cancel';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import { rowsAffectedOf } from './service';
import { salesCloseAt } from './time';

const SHOWTIME_CANCEL_REFUND_REASON = '공연 회차 취소 환불';

/**
 * 회차 취소 — 살아 있는(paid/partially_refunded) 주문 전부를 **잔액 기준**으로 전액 환불한다.
 *
 * `refund.ts`의 `refundShowTickets`(티켓 단위 부분 환불)를 재사용하지 않고 별도 배치로 둔다
 * (progress.md T10->T14 ruling, 플랜 §7.10 근거) — 회차 취소는 주문 전체가 대상이라
 * refundShowTickets의 티켓 지정·환불률(refundRateForNotice)·재고 게이트가 맞지 않는다.
 *
 * **이미 일부 환불된 주문의 이중 환불을 막는 것이 이 함수의 핵심이다.** `order.totalAmount`를
 * 그대로 취소하면, 회차 취소 전에 `refundShowTickets`로 일부 티켓만 먼저 환불된 주문에서
 * 그 부분을 또 취소하려 들어 토스가 거절하거나(잔액 초과) 우리 쪽 기록이 실제보다 부풀려진다.
 * `lib/booking/cancel.ts`의 `remainingRefundable(order, payments)` — settleRefund·
 * refundShowTickets·funding lineRefund가 공유하는 바로 그 헬퍼 — 로 "이미 done으로 기록된
 * 환불 총액을 뺀 잔액"을 구해 그 금액만 취소한다.
 *
 * 체크인된 티켓은 **건드리지 않는다** — `refundShowTickets`가 체크인된 티켓을 환불 대상에서
 * 아예 제외하는 것과 같은 판단이다(§6 E-계열 불변식). 이미 입장한 관객의 입장 기록을
 * 회차 취소가 지워 버리면 안 되고, 그 티켓은 이미 관객이 실물로 사용을 마친 것이라 "취소해
 * 돌려줄 대상"이 아니다 — 환불도 하지 않고(현장에서 이미 서비스를 제공받았다) 상태도
 * 그대로 둔다. 남은(아직 발권/보류 상태이고 체크인 안 된) 티켓만 'void'로 넘긴다.
 */
export async function cancelShowtime(
  showtimeId: string,
  now: Date,
  toss: Pick<FakeToss, 'cancelPayment'>
): Promise<{ refundedOrders: number; failedOrders: string[] }> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);

  await db.run(sql`
    UPDATE showtimes SET status = 'cancelled', cancelled_at = ${nowSec}
    WHERE id = ${showtimeId} AND status = 'scheduled'
  `);

  const rows = await db.all(sql`
    SELECT DISTINCT so.order_no as orderNo FROM show_orders so
    JOIN orders o ON o.order_no = so.order_no
    WHERE so.showtime_id = ${showtimeId} AND o.status IN ('paid', 'partially_refunded')
  `);

  let refundedOrders = 0;
  const failedOrders: string[] = [];

  for (const row of rows as Array<{ orderNo: string }>) {
    const orderNo = row.orderNo;
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    if (!order) {
      failedOrders.push(orderNo);
      continue;
    }

    const payments = await db.query.payments.findMany({
      where: (p, { eq }) => eq(p.orderId, order.id),
      with: { refunds: true },
    });

    // 잔액 — 이미 refundShowTickets 등으로 done 기록된 환불을 뺀 금액. 0이면(부분환불이
    // 이미 전액을 처리한 경우) 취소할 것이 없어 건너뛴다 — 토스도 우리 기록도 건드리지 않는다.
    const remaining = remainingRefundable(order, payments);
    if (remaining <= 0) continue;

    const doneRefundedOn = (p: PaymentWithRefunds): number =>
      p.refunds.filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
    const payment = payments.find((p) => doneRefundedOn(p) < order.totalAmount) ?? payments[payments.length - 1];
    if (!payment) {
      failedOrders.push(orderNo);
      continue;
    }

    const key = refundIdempotencyKey(orderNo, remaining, 'showtime-cancel');
    const cancelResult = await toss.cancelPayment({
      paymentKey: payment.paymentKey,
      cancelReason: `[#${key}] 회차 취소`,
      cancelAmount: remaining,
      idempotencyKey: key,
      paymentMethod: payment.method,
    });

    if (!cancelResult.ok) {
      console.error('[shows-showtimeOps] 회차 취소 환불 실패', {
        orderNo, code: cancelResult.code, message: cancelResult.message,
      });
      failedOrders.push(orderNo);
      continue;
    }

    // 델타 INSERT — refund.ts(refundShowTickets)·funding lineRefund와 같은 패턴. 웹훅이
    // 먼저 대사(reconcile)했어도 이중으로 기록되지 않는다.
    const cancelledTotal = cancelResult.payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? remaining;
    const lastTransactionKey = cancelResult.payment.cancels?.[cancelResult.payment.cancels.length - 1]?.transactionKey ?? null;

    await db.batch([
      db.run(sql`
        INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
        SELECT lower(hex(randomblob(16))), ${payment.id},
               ${cancelledTotal} - COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0),
               ${SHOWTIME_CANCEL_REFUND_REASON}, 'admin', ${lastTransactionKey}, 'done'
        WHERE ${cancelledTotal} > COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0)
      `),
      // 이 환불이 잔액 전부를 처리하므로(remaining을 그대로 취소액으로 넣었다) 주문은 항상
      // 'refunded'로 넘어간다 — settleRefund의 "refundAmount >= remaining → refunded"와 같은 판정.
      db.run(sql`
        UPDATE orders SET status = 'refunded', updated_at = unixepoch()
        WHERE id = ${order.id} AND status IN ('paid', 'partially_refunded')
      `),
      // 아직 살아 있고(held/issued) 체크인되지 않은 티켓만 무효화한다. 체크인된 티켓은 위
      // 주석대로 그대로 둔다 — 이미 입장을 마쳐 취소·환불 대상이 아니다. 'refunding'(다른
      // 요청이 부분 환불을 진행 중) 상태는 여기서 손대지 않는다 — 그 요청의 확정/롤백에 맡긴다.
      db.run(sql`
        UPDATE show_tickets SET status = 'void'
        WHERE order_no = ${orderNo} AND status IN ('held', 'issued') AND checked_in_at IS NULL
      `),
    ] as [any, any, any]);

    refundedOrders++;
  }

  return { refundedOrders, failedOrders };
}

/**
 * 회차 시각 변경 — `previous_starts_at`을 보존하고(최초 변경분만, 재변경은 그대로 유지),
 * 판매마감을 새 시각 기준으로 재계산한다. 스캔 링크 만료도 새 시각 이후로 늦춘다(입장 확인
 * 요원이 옛 시각 기준 만료로 새 공연일에 스캔을 못 하게 되는 것을 막는다).
 *
 * `notice_key`는 `showtimes`가 아니라 `shows` 테이블의 컬럼이다(브리핑 초안이 착오로
 * showtimes에 있다고 가정했다 — db/schema.ts 확인 결과 showtimes에는 그런 컬럼이 없다).
 * 이 태스크 범위에서 그 값을 쓰는 코드가 아직 없어(리포지토리 전체에서 참조 0건)
 * 여기서 건드리지 않는다.
 */
export async function changeShowtime(showtimeId: string, newStartsAt: Date, now: Date): Promise<void> {
  const db = getDb();
  const newStartsAtSec = Math.floor(newStartsAt.getTime() / 1000);
  const newSalesCloseAtSec = Math.floor(salesCloseAt(newStartsAt).getTime() / 1000);
  const nowSec = Math.floor(now.getTime() / 1000);

  await db.run(sql`
    UPDATE showtimes SET
      previous_starts_at = COALESCE(previous_starts_at, starts_at),
      starts_at = ${newStartsAtSec},
      sales_close_at = ${newSalesCloseAtSec},
      changed_at = ${nowSec}
    WHERE id = ${showtimeId} AND status = 'scheduled'
  `);

  await db.run(sql`
    UPDATE show_scan_links SET expires_at = MAX(expires_at, ${newStartsAtSec} + 86400)
    WHERE showtime_id = ${showtimeId}
  `);
}
