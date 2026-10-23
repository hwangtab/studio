import type { ProductionContractEvent } from '../../../db/schema';
import { activeEvents, parseEventData } from './ledger';

/**
 * 해지 환불을 **어느 입금에서 얼마씩** 돌려줄지 나눈다.
 *
 * 정산(ledger.ts refund)은 돌려줄 총액만 정한다. 실제 돈은 받은 길로 돌려준다 — 다른 결제(예약·믹싱·예약금 링크)와 같다:
 * - 결제 링크로 **카드·간편결제** 받은 몫 → 토스 부분취소(결제 수단으로, lib/booking/cancel.ts refundContractLinkOrder).
 * - 결제 링크로 **계좌 입금** 받은 몫과, 운영자가 **직접 기록한** 입금 → 의뢰인이 적은 환불 계좌로 운영자가 송금.
 *
 * 나누는 규칙은 **늦은 입금부터**다(먼저 받은 계약금이 작업분에 먼저 들어간다고 본다 — 매출 계산 productionRevenue.ts와 같은 순서).
 * 이 함수는 입금 기록만 보고 정한다 — 그 입금이 카드인지 계좌인지는 호출부가 주문으로 가른다. 그래서 매출 계산(주문을 읽지 않는다)과
 * 해지 처리(주문을 읽는다)가 같은 배분을 얻는다.
 */
export interface RefundAllocation {
  /** 입금 기록 id. */
  eventId: string;
  /** 결제 링크로 받은 입금이면 그 주문번호(data.orderNo). 직접 기록한 입금은 null. */
  orderNo: string | null;
  /** 그 입금에서 돌려줄 금액. */
  amount: number;
}

export const allocateContractRefund = (events: readonly ProductionContractEvent[], refundable: number): RefundAllocation[] => {
  const payments = activeEvents(events).filter((e) => e.type === 'payment_received' && (e.amount ?? 0) > 0);
  const out: RefundAllocation[] = [];
  let left = Math.max(0, Math.round(refundable));
  for (const event of [...payments].reverse()) {
    if (left <= 0) break;
    const amount = Math.min(left, event.amount ?? 0);
    out.push({ eventId: event.id, orderNo: parseEventData(event).orderNo ?? null, amount });
    left -= amount;
  }
  return out;
};

/** 결제 수단별로 묶은 환불 계획 — 화면·메일·실행이 같은 값을 쓴다. */
export interface ContractRefundPlan {
  refundable: number;
  /** 토스 부분취소로 돌려줄 몫(결제 링크 카드·간편결제 주문). `refunded`는 그 주문에 이미 기록된 환불(재시도에서 뺀다). */
  card: Array<{ orderNo: string; amount: number; refunded: number }>;
  /** 결제 링크 계좌 입금 주문의 몫 — 송금 완료를 기록할 때 그 주문에도 환불을 남긴다(매출이 결제 행으로 세므로). */
  bankLink: Array<{ orderNo: string; amount: number }>;
  /** 직접 기록한 입금의 몫 — 매출은 productionRevenue.ts가 송금 완료 뒤 이만큼 뺀다. */
  direct: number;
  /** 환불 계좌로 송금할 총액 = 계좌 입금 링크 몫 + 직접 기록 몫. 0이면 의뢰인에게 계좌를 묻지 않는다. */
  bankTotal: number;
  /** 카드 몫 중 아직 취소되지 않은 금액. */
  cardPending: number;
}

/**
 * 배분을 결제 수단별로 묶는다. `orderOf`는 주문번호 → (계좌 입금인가, 그 주문에 이미 기록된 환불 합계). 주문을 찾지 못하면
 * 계좌 송금으로 둔다 — 토스를 부를 근거(결제 키)가 없는 돈을 카드 취소로 보내지 않는다.
 */
export const groupRefundPlan = (
  allocations: readonly RefundAllocation[],
  refundable: number,
  orderOf: (orderNo: string) => { bankDeposit: boolean; refunded: number } | null,
): ContractRefundPlan => {
  const plan: ContractRefundPlan = { refundable, card: [], bankLink: [], direct: 0, bankTotal: 0, cardPending: 0 };
  for (const allocation of allocations) {
    if (!allocation.orderNo) {
      plan.direct += allocation.amount;
      continue;
    }
    const order = orderOf(allocation.orderNo);
    if (order && !order.bankDeposit) {
      plan.card.push({ orderNo: allocation.orderNo, amount: allocation.amount, refunded: order.refunded });
      plan.cardPending += Math.max(0, allocation.amount - order.refunded);
    } else {
      plan.bankLink.push({ orderNo: allocation.orderNo, amount: allocation.amount });
    }
  }
  plan.bankTotal = plan.direct + plan.bankLink.reduce((sum, b) => sum + b.amount, 0);
  return plan;
};
