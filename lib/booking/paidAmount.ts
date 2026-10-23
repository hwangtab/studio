import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isBankDepositPayment } from '../payments/bankDeposit';
import { splitInclusiveAmount } from './amounts';
import { MIN_AMOUNT } from './manualEntry';

/**
 * **입금 확인이 끝난 예약·믹싱·예약금 링크 주문의 금액 정정**(관리자). 입금 확인 전에는 `updateAwaitingOrderDetails`로 고치고(manualEdit.ts),
 * 확인한 뒤에는 이 함수로 고친다 — 협의가를 잘못 넣었거나 받은 돈과 기록이 다를 때.
 *
 * 대상은 **계좌 입금으로 확정된 주문** — 세션 예약·믹싱·예약금 링크(금액 칸은 `orders`뿐), 공연 티켓, 상점 주문.
 * - **공연 티켓**: 장당 금액(`show_tickets.unit_amount`)이 환불 계산의 기준이라, 새 총액을 **장당 금액에 비례 배분**한다(할인·일부 감면 모두 이 한 방식으로 —
 *   환불률×장당 금액의 합이 실제로 받은 돈과 맞는다). 입장 기록·QR은 건드리지 않는다.
 * - **상점**: `orders` 총액만 고친다. 주문 줄(`shop_order_items`)은 주문 당시 정가 기록으로 남기고, 그래서 **아티스트 정산은 정가 기준 그대로**다
 *   — 할인은 스튜디오 부담이다. 아티스트와 나누려면 정산의 "조정"(partner_payout_adjustments)으로 따로 반영한다. 계좌 입금의 결제 행(`bank-deposit:…`)에는 금액 칸이 없고 금액의 정본이 `orders`
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
  /** 공연 티켓 — 장당 금액이 어떻게 바뀌었는지. */
  tickets?: { id: string; from: number; to: number }[];
}

const ADJUSTABLE_TYPES: readonly string[] = ['session', 'mixing', 'deposit', 'ticket', 'merch'];

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

/**
 * 총액을 장당 금액에 비례해 나눈다(합이 총액과 정확히 같게 — 나머지 원은 소수부가 큰 장부터 1원씩).
 * 장당 금액이 전부 0이면 똑같이 나눈다. 순수 함수.
 */
export const allocateProportionally = (total: number, weights: readonly number[]): number[] => {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const base = sum > 0 ? weights : weights.map(() => 1);
  const baseSum = base.reduce((a, b) => a + b, 0);
  const exact = base.map((w) => (total * w) / baseSum);
  const floors = exact.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  return floors;
};

export const adjustPaidBankDepositAmount = async (input: {
  /** 주문 id 또는 주문번호 중 하나. */
  orderId?: string;
  orderNo?: string;
  totalAmount: unknown;
  reason: unknown;
  actor: string;
  now?: Date;
}): Promise<PaidAmountResult> => {
  const amount = Number(input.totalAmount);
  // 0원(완전 무료)은 허용한다 — 전액 할인·초대에 가까운 경우(운영자 요청 2026-10-20). 1~999원은 "250000"을 "250"으로 적는 식의 오입력이라 막는다.
  if (input.totalAmount === null || input.totalAmount === '' || !Number.isInteger(amount) || amount < 0 || (amount > 0 && amount < MIN_AMOUNT) || amount > 100_000_000) {
    return { ok: false, message: `금액을 확인해 주세요(부가세 포함 총액, 0원 또는 ${MIN_AMOUNT.toLocaleString('ko-KR')}원 이상 원 단위).` };
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 2 || reason.length > 200) return { ok: false, message: '정정 사유를 2~200자로 적어 주세요.' };

  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (t, { eq }) => (input.orderNo ? eq(t.orderNo, input.orderNo) : eq(t.id, String(input.orderId))),
    with: { payments: { with: { refunds: true } } },
  });
  if (!order) return { ok: false, message: '주문을 찾을 수 없어요.' };
  if (!ADJUSTABLE_TYPES.includes(order.type)) return { ok: false, message: '예약·믹싱·예약금 링크·공연 티켓·상점 주문만 정정할 수 있어요.' };
  if (order.status !== 'paid') return { ok: false, message: '입금 확인이 끝난 주문만 정정할 수 있어요. 입금 대기 중이면 대기 상태의 수정 기능을 써 주세요.' };
  const bankPayment = order.payments.find(isBankDepositPayment);
  if (!bankPayment) return { ok: false, message: '카드(토스) 결제는 금액을 바꿀 수 없어요 — 승인 금액과 어긋나요. 차액은 환불로 처리해 주세요.' };
  if (order.payments.some((p) => p.refunds.length > 0)) return { ok: false, message: '환불 기록이 있는 주문은 금액을 정정할 수 없어요.' };
  if (amount === order.totalAmount) return { ok: false, message: '지금 금액과 같아요.' };

  // 공연 티켓 — 장당 금액을 새 총액에 비례 배분한다. 환불 중·환불된 티켓이나 보상 기록이 있으면 장당 금액이 이미 돈의 흐름에 쓰였으므로 거절.
  let ticketUpdates: { id: string; from: number; to: number }[] = [];
  if (order.type === 'ticket') {
    const rows = await db.all<{ id: string; unit_amount: number; status: string; issued_by: string; compensated_amount: number }>(
      sql`SELECT id, unit_amount, status, issued_by, compensated_amount FROM show_tickets WHERE order_no = ${order.orderNo} ORDER BY created_at, id`,
    );
    if (rows.some((t) => t.status === 'refunding' || t.status === 'refunded' || Number(t.compensated_amount) > 0)) {
      return { ok: false, message: '환불·보상이 진행됐거나 끝난 티켓이 있는 주문은 금액을 정정할 수 없어요.' };
    }
    const live = rows.filter((t) => (t.status === 'held' || t.status === 'issued') && t.issued_by === 'customer');
    if (live.length === 0) return { ok: false, message: '정정할 티켓이 없어요.' };
    const shares = allocateProportionally(amount, live.map((t) => Number(t.unit_amount)));
    ticketUpdates = live.map((t, i) => ({ id: t.id, from: Number(t.unit_amount), to: shares[i] }));
  }

  const split = splitInclusiveAmount(amount);
  const audit = parseAudit(bankPayment.rawResponse);
  const entry: Adjustment = {
    at: (input.now ?? new Date()).toISOString(), by: input.actor, from: order.totalAmount, to: split.totalAmount, reason,
    ...(ticketUpdates.length ? { tickets: ticketUpdates } : {}),
  };
  const auditJson = JSON.stringify({ ...(audit.previous ? { previous: audit.previous } : {}), amountAdjustments: [...audit.adjustments, entry] });

  // 금액이 읽은 값 그대로일 때만(동시 정정·환불 방지), 환불 행이 생기지 않았을 때만 바꾼다.
  const [claim, , ...ticketResults] = await db.batch([
    db.run(sql`
      UPDATE orders SET item_amount = ${split.itemAmount}, vat_amount = ${split.vatAmount}, total_amount = ${split.totalAmount}, updated_at = unixepoch()
      WHERE id = ${order.id} AND status = 'paid' AND total_amount = ${order.totalAmount}
        AND NOT EXISTS (SELECT 1 FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.order_id = ${order.id})
    `),
    db.run(sql`
      UPDATE payments SET raw_response = ${auditJson}
      WHERE id = ${bankPayment.id}
        AND raw_response IS ${bankPayment.rawResponse ?? null}
        AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND total_amount = ${split.totalAmount})
    `),
    ...ticketUpdates.map((t) => db.run(sql`
      UPDATE show_tickets SET unit_amount = ${t.to}
      WHERE id = ${t.id} AND unit_amount = ${t.from} AND status IN ('held', 'issued')
        AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND total_amount = ${split.totalAmount})
    `)),
  ]);
  if (Number(claim.rowsAffected) === 0) return { ok: false, message: '방금 상태가 바뀌었어요. 새로고침 후 다시 시도해 주세요.' };
  if (ticketResults.some((r) => Number(r.rowsAffected) !== 1)) {
    // 읽은 뒤 티켓 상태가 바뀐 드문 경우 — 주문 총액은 이미 바뀌었으니 숨기지 않고 알린다(장당 금액을 확인해 다시 정정).
    console.error('[paid-amount] 티켓 장당 금액 일부를 바꾸지 못함', { orderNo: order.orderNo });
    return { ok: false, message: '주문 금액은 바뀌었지만 일부 티켓의 장당 금액을 맞추지 못했어요. 새로고침해서 확인한 뒤 같은 금액으로 한 번 더 정정해 주세요.' };
  }
  return { ok: true, from: order.totalAmount, to: split.totalAmount };
};
