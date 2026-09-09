import type { FundingOrder } from './service';

/**
 * 아직 환불하지 않고 남은 금액 = totalAmount − Σ(done 환불, **모든 payments 행**).
 *
 * 결제 행이 하나뿐이라는 가정은 깨진다 — 웹훅 대사(syncFundingCancelledFromToss)는
 * paymentKey로 행을 골라 환불을 기록하고, 관리자 상세 화면은 전 행의 환불을 합산한다.
 * 그래서 payments[0]만 보고 계산하면 payments[1]에 기록된 환불이 통째로 빠져, 이미
 * 환불된 금액을 다시 토스에 요청하게 된다(초과 취소 거절 또는 이중 환불).
 *
 * refunds 관계가 로딩되지 않은 행은 0으로 다룬다 — 관계 없이 만든 픽스처 방어.
 */
export const remainingRefundable = (order: FundingOrder): number => {
  const refunded = order.payments.reduce(
    (sum, p) => sum + (p.refunds ?? []).filter((r) => r.status === 'done').reduce((s, r) => s + r.amount, 0),
    0,
  );
  return Math.max(0, order.totalAmount - refunded);
};
