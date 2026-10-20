import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isBankDepositPayment } from '../payments/bankDeposit';
import { splitInclusiveAmount } from './amounts';
import { MIN_AMOUNT } from './manualEntry';

/**
 * **입금 확인이 끝난 예약·믹싱·예약금 링크 주문의 금액 정정**(관리자). 입금 확인 전에는 `updateAwaitingOrderDetails`로 고치고(manualEdit.ts),
 * 확인한 뒤에는 이 함수로 고친다 — 협의가를 잘못 넣었거나 받은 돈과 기록이 다를 때.
 *
 * 대상은 **계좌 입금으로 확정된 세션 예약·믹싱 주문·예약금 링크 주문**이다(믹싱 작업 주문·링크 기록에는 금액 칸이 없다 — 금액은 `orders`뿐). 계좌 입금의 결제 행(`bank-deposit:…`)에는 금액 칸이 없고 금액의 정본이 `orders`
 * 한 곳이라 그 값을 고치면 매출·환불 잔액이 함께 맞는다. 다음은 거절한다:
 * - 토스(카드) 결제 — 승인 금액이 토스에 있어 주문만 고치면 둘이 어긋난다. 차액은 환불로 푼다.
 * - 환불 기록이 있는 주문 — 이미 돌려준 금액과 새 총액의 관계가 모호해진다.
 *
 * 누가·언제·얼마→얼마·왜를 결제 행의 `raw_response`(계좌 입금에서는 비어 있는 칸)에 JSON으로 쌓는다 — 소급 변경이라 흔적이 남아야 한다.
 * 확정 메일은 다시 보내지 않는다.
 */

export type PaidAmountResult = { ok: true; from: number; to: number } | { ok: false; message: string };

interface Adjustment {
  at: string;
  by: string;
  from: number;
  to: number;
  reason: string;
}

const parseAudit = (raw: string | null): { adjustments: Adjustment[]; previous?: string } => {
  if (!raw) return { adjustments: [] };
  try {
    const parsed = JSON.parse(raw) as { amountAdjustments?: Adjustment[] };
    if (parsed && Array.isArray(parsed.amountAdjustments)) return { adjustments: parsed.amountAdjustments };
  } catch {
    // 계좌 입금 행은 원래 비어 있다 — 다른 내용이 있으면 버리지 않고 같이 둔다.
  }
  return { adjustments: [], previous: raw };
};

export const adjustPaidBankDepositAmount = async (input: {
  orderId: string;
  totalAmount: unknown;
  reason: unknown;
  actor: string;
  now?: Date;
}): Promise<PaidAmountResult> => {
  const amount = Number(input.totalAmount);
  if (input.totalAmount === null || input.totalAmount === '' || !Number.isInteger(amount) || amount < MIN_AMOUNT || amount > 100_000_000) {
    return { ok: false, message: `금액을 확인해 주세요(부가세 포함 총액, ${MIN_AMOUNT.toLocaleString('ko-KR')}원 이상 원 단위).` };
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 2 || reason.length > 200) return { ok: false, message: '정정 사유를 2~200자로 적어 주세요.' };

  const db = getDb();
  const order = await db.query.orders.findFirst({ where: (t, { eq }) => eq(t.id, input.orderId), with: { payments: { with: { refunds: true } } } });
  if (!order) return { ok: false, message: '예약을 찾을 수 없어요.' };
  if (order.type !== 'session' && order.type !== 'mixing' && order.type !== 'deposit') return { ok: false, message: '예약·믹싱·예약금 링크 주문만 정정할 수 있어요.' };
  if (order.status !== 'paid') return { ok: false, message: '입금 확인이 끝난 예약만 정정할 수 있어요. 입금 대기 중이면 "고객 정보·금액 수정"을 써 주세요.' };
  const bankPayment = order.payments.find(isBankDepositPayment);
  if (!bankPayment) return { ok: false, message: '카드(토스) 결제는 금액을 바꿀 수 없어요 — 승인 금액과 어긋나요. 차액은 환불로 처리해 주세요.' };
  if (order.payments.some((p) => p.refunds.length > 0)) return { ok: false, message: '환불 기록이 있는 예약은 금액을 정정할 수 없어요.' };
  if (amount === order.totalAmount) return { ok: false, message: '지금 금액과 같아요.' };

  const split = splitInclusiveAmount(amount);
  const audit = parseAudit(bankPayment.rawResponse);
  const entry: Adjustment = { at: (input.now ?? new Date()).toISOString(), by: input.actor, from: order.totalAmount, to: split.totalAmount, reason };
  const auditJson = JSON.stringify({ ...(audit.previous ? { previous: audit.previous } : {}), amountAdjustments: [...audit.adjustments, entry] });

  // 금액이 읽은 값 그대로일 때만(동시 정정·환불 방지), 환불 행이 생기지 않았을 때만 바꾼다.
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET item_amount = ${split.itemAmount}, vat_amount = ${split.vatAmount}, total_amount = ${split.totalAmount}, updated_at = unixepoch()
      WHERE id = ${order.id} AND status = 'paid' AND total_amount = ${order.totalAmount}
        AND NOT EXISTS (SELECT 1 FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.order_id = ${order.id})
    `),
    db.run(sql`
      UPDATE payments SET raw_response = ${auditJson}
      WHERE id = ${bankPayment.id}
        AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND total_amount = ${split.totalAmount})
    `),
  ]);
  if (Number(claim.rowsAffected) === 0) return { ok: false, message: '방금 상태가 바뀌었어요. 새로고침 후 다시 시도해 주세요.' };
  return { ok: true, from: order.totalAmount, to: split.totalAmount };
};
