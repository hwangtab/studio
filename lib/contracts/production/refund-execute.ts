import { getDb } from '../../../db/client';
import { refundContractLinkOrder } from '../../booking/cancel';
import { isBankDepositPayment } from '../../payments/bankDeposit';
import { recordLinkBankRefund } from '../../payments/linkRefund';
import { loadProgressContext, type ProgressContext } from './progress';
import { allocateContractRefund, groupRefundPlan, type ContractRefundPlan } from './refund-plan';

/**
 * 해지 환불 실행 — 받은 길로 돌려준다(refund-plan.ts). 카드·간편결제 몫은 해지하는 순간 토스 부분취소로, 계좌 몫은 운영자가
 * 환불 계좌로 송금한 뒤 "송금 완료"로 기록한다. 토스 취소는 (주문번호, 금액) 멱등키라 재시도해도 두 번 나가지 않는다.
 */

/** 카드 몫 취소가 남았을 때 계약의 알림 오류(notification_error)에 남기는 문구 — 운영 점검이 "메일·PDF 처리 실패"로 알린다. */
export const CARD_REFUND_PENDING_PREFIX = '카드 환불 미처리';

export const cardRefundPendingMessage = (plan: Pick<ContractRefundPlan, 'cardPending'>): string | null =>
  plan.cardPending > 0
    ? `${CARD_REFUND_PENDING_PREFIX} ${plan.cardPending.toLocaleString('ko-KR')}원 — 계약 상세 "환불"에서 다시 시도해 주세요.`
    : null;

/** 계약의 환불 계획. 해지 전이면 지금 해지한다고 가정한 값이다(관리자 미리보기와 같은 정산). */
export const loadContractRefundPlan = async (contextOrId: ProgressContext | string): Promise<ContractRefundPlan | null> => {
  const context = typeof contextOrId === 'string' ? await loadProgressContext(contextOrId) : contextOrId;
  if (!context) return null;
  const refundable = Math.max(0, context.ledger.refund.refundable);
  const allocations = allocateContractRefund(context.events, refundable);
  const orderNos = [...new Set(allocations.map((a) => a.orderNo).filter((n): n is string => n !== null))];
  const orders =
    orderNos.length === 0
      ? []
      : await getDb().query.orders.findMany({
          where: (t, { inArray }) => inArray(t.orderNo, orderNos),
          with: { payments: { with: { refunds: true } } },
        });
  const byNo = new Map(
    orders.map((order) => [
      order.orderNo,
      {
        bankDeposit: order.payments.length > 0 && order.payments.every(isBankDepositPayment),
        refunded: order.payments.reduce((sum, p) => sum + p.refunds.filter((r) => r.status === 'done').reduce((s, r) => s + r.amount, 0), 0),
      },
    ]),
  );
  // 결제 행이 없는 주문(기록이 어긋난 경우)은 토스를 부를 결제 키가 없다 — 계좌 송금으로 둔다(groupRefundPlan이 null을 그렇게 읽는다).
  const withPayments = new Set(orders.filter((o) => o.payments.length > 0).map((o) => o.orderNo));
  return groupRefundPlan(allocations, refundable, (orderNo) => (withPayments.has(orderNo) ? (byNo.get(orderNo) ?? null) : null));
};

export interface CardRefundRun {
  refunded: number;
  failures: Array<{ orderNo: string; amount: number; message: string }>;
  plan: ContractRefundPlan;
}

/** 해지한 계약의 카드 몫을 토스로 취소한다. 이미 취소한 만큼은 건너뛴다(재시도·두 번 누름). */
export const runContractCardRefunds = async (contractId: string, now: Date = new Date()): Promise<CardRefundRun | null> => {
  const context = await loadProgressContext(contractId, now);
  if (!context || context.contract.status !== 'terminated') return null;
  const plan = await loadContractRefundPlan(context);
  if (!plan) return null;
  let refunded = 0;
  const failures: CardRefundRun['failures'] = [];
  for (const item of plan.card) {
    const amount = item.amount - item.refunded;
    if (amount <= 0) continue;
    const result = await refundContractLinkOrder({
      orderNo: item.orderNo,
      amount,
      reason: `계약 해지 환불 (${context.contract.title})`.slice(0, 200),
      now,
    });
    if (result.ok) refunded += result.refundAmount;
    else failures.push({ orderNo: item.orderNo, amount, message: result.message });
  }
  if (failures.length > 0) {
    console.error('[contracts/production/refund] 카드 환불 실패', { contractId, failures: failures.map((f) => ({ orderNo: f.orderNo, amount: f.amount })) });
  }
  return { refunded, failures, plan: (await loadContractRefundPlan(contractId)) ?? plan };
};

/**
 * 환불 계좌로 송금을 마쳤을 때 — 결제 링크 계좌 입금 주문의 몫을 그 주문의 환불로도 남긴다(매출이 결제 행으로 세는 돈이라,
 * 안 남기면 돌려준 돈이 매출에 그대로 남는다). 직접 기록한 입금의 몫은 productionRevenue.ts가 송금 완료 표시를 보고 뺀다.
 * 이미 기록한 만큼은 건너뛴다.
 */
export const recordContractBankLinkRefunds = async (contractId: string, now: Date = new Date()): Promise<{ failed: string[] }> => {
  const plan = await loadContractRefundPlan(contractId);
  const failed: string[] = [];
  if (!plan) return { failed };
  for (const item of plan.bankLink) {
    const order = await getDb().query.orders.findFirst({
      where: (t, { eq }) => eq(t.orderNo, item.orderNo),
      with: { payments: { with: { refunds: true } } },
    });
    if (!order) continue;
    const already = order.payments.reduce((sum, p) => sum + p.refunds.filter((r) => r.status === 'done').reduce((s, r) => s + r.amount, 0), 0);
    const amount = item.amount - already;
    if (amount <= 0) continue;
    const result = await recordLinkBankRefund({ orderId: order.id, amount, reason: '계약 해지 환불(계좌 송금)', now });
    if (!result.ok) failed.push(item.orderNo);
  }
  return { failed };
};
