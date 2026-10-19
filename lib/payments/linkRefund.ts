import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isBankDepositPayment } from './bankDeposit';

/**
 * 예약금 결제 링크 주문(`orders.type = 'deposit'`)의 **계좌 직접 입금분 환불 기록**.
 *
 * 링크 주문은 예약·작업 행이 없어 `cancelBookingWithRefund`를 탈 수 없다. 계좌 입금은 토스 결제가 아니라
 * 운영자가 고객 계좌로 손으로 송금하므로(토스 호출 없음) 여기서는 **송금을 마친 뒤의 기록**만 남긴다:
 * `refunds` 행(done) + 주문 상태(partially_refunded/refunded) — 예약·믹싱·공연·상점 계좌 환불과 같은 모양이라
 * 매출 장부·매출 현황이 그대로 읽는다. 환불 계좌 표(`refund_accounts`)는 링크 주문에 접수 화면이 없어 건드리지 않는다.
 *
 * **토스 결제 링크 주문은 받지 않는다**(`not_bank_deposit`) — 그 환불은 `cancelBookingWithRefund`의 예약금 경로(lib/booking/cancel.ts `refundDepositOrder`)가 토스 취소와 함께 기록한다.
 * 여기서 기록만 남기면 돈은 그대로인데 장부만 환불로 바뀐다.
 */
export type LinkRefundResult =
  | { ok: true; refundAmount: number; /** 이번 환불 뒤 남은 결제 금액 — 고객 안내 메일이 부분 환불을 설명할 때 쓴다. */ remainingAfter: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'not_bank_deposit' | 'invalid_amount'; message: string };

export const recordLinkBankRefund = async (input: {
  orderId: string;
  amount: number;
  reason: string;
  now: Date;
}): Promise<LinkRefundResult> => {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, input.orderId),
    with: { payments: { with: { refunds: true } } },
  });
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  if (order.type !== 'deposit') return { ok: false, code: 'invalid_state', message: '결제 링크 주문이 아닙니다.' };
  const payment = order.payments.find(isBankDepositPayment);
  if (!payment) {
    return { ok: false, code: 'not_bank_deposit', message: '계좌로 직접 입금한 주문만 여기서 기록할 수 있어요. 카드 결제는 “예약금 환불”로 토스 취소를 부르세요.' };
  }
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    return { ok: false, code: 'invalid_state', message: '입금이 확인된 주문만 환불을 기록할 수 있어요.' };
  }
  const refunded = order.payments.reduce((sum, p) => sum + p.refunds.filter((r) => r.status === 'done').reduce((s, r) => s + r.amount, 0), 0);
  const remaining = Math.max(0, order.totalAmount - refunded);
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > remaining) {
    return {
      ok: false,
      code: 'invalid_amount',
      message: remaining <= 0 ? '이미 전액 환불된 주문이에요.' : `환불 금액은 1~${remaining.toLocaleString('ko-KR')}원 사이의 정수여야 합니다.`,
    };
  }

  const nowSec = Math.floor(input.now.getTime() / 1000);
  // 잔액 확인과 기록을 한 문장에 묶는다 — 더블클릭·두 탭이 위 읽기를 같이 통과해도 합이 결제액을 넘는 행은 들어가지 않는다.
  const [inserted] = await db.batch([
    db.run(sql`
      INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status, created_at)
      SELECT lower(hex(randomblob(16))), ${payment.id}, ${input.amount}, ${input.reason}, 'admin', NULL, 'done', ${nowSec}
      WHERE (SELECT total_amount FROM orders WHERE id = ${order.id})
            - COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.order_id = ${order.id} AND r.status = 'done'), 0)
            >= ${input.amount}`),
    // 상태는 기록된 환불 합계에서 다시 정한다 — 위 삽입이 걸러졌어도 현재 장부와 어긋나지 않는다.
    db.run(sql`
      UPDATE orders SET updated_at = ${nowSec}, status = CASE
        WHEN total_amount - COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.order_id = orders.id AND r.status = 'done'), 0) <= 0 THEN 'refunded'
        ELSE 'partially_refunded' END
      WHERE id = ${order.id} AND status IN ('paid', 'partially_refunded')`),
  ]);
  if ((inserted.rowsAffected ?? 0) === 0) {
    return { ok: false, code: 'invalid_amount', message: '환불 가능 잔액이 바뀌었어요. 새로고침 후 다시 확인해 주세요.' };
  }
  return { ok: true, refundAmount: input.amount, remainingAfter: remaining - input.amount };
};
