import { computeFundingPayoutForProject, type FundingCreatorTaxType } from '../funding/payout';

/**
 * 공연 주최자 정산 한 건의 계산 — **순수**. 새 식을 만들지 않고 펀딩 정산(`computeFundingPayoutForProject`)을 그대로 쓴다.
 * 주최자 약관 제6조가 펀딩과 같은 상수(`FUNDING_PLATFORM_FEE_PERCENT`·`FUNDING_PAYMENT_FEE_PERCENT`)를 보간하고, 개인(원천징수)·사업자 처리도 같은 문장이다.
 *
 *   순판매액 = 판매액 − 환불(완료)             ← 약관: "환불된 금액을 먼저 뺀 뒤"
 *   수수료   = round(순판매액×5.5%) + round(결제 수수료 과세표준×3.3%)
 *   개인     = 부가세 상당액(10/110)과 원천징수 3.3%를 뺀다 / 사업자 = 그대로
 *   조정(회차 취소 결제 수수료) = **원천징수까지 뺀 금액에서** 뺀다 — 펀딩의 설계비·제작비 공제(`applyServiceCharges`)와 같은 자리다. 스튜디오가
 *     떠안은 비용을 주최자에게 물리는 것이라 수수료·원천징수의 계산 기준에는 들어가지 않는다. 모자라는 몫은 `shortfallAmount`(청구 협의).
 *
 * **결제 수수료 과세표준에서 계좌 입금 몫은 뺀다** — 토스를 지나지 않은 돈에는 PG 수수료가 발생한 적이 없다(펀딩의 `manualGrossAmount`와 같은 이유,
 * `computeFundingPayoutForProject` 주석). 공연은 계좌 입금 환불도 기록되므로 계좌 입금 몫은 판매액에서 그 환불을 뺀 값이다.
 */
export interface ShowPayoutCalc {
  grossAmount: number;
  refundAmount: number;
  /** max(0, 판매액 − 환불). */
  netSalesAmount: number;
  platformFeeAmount: number;
  paymentFeeAmount: number;
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  /** 정산금에서 실제로 뺀 조정(회차 취소 결제 수수료 합, 양수). */
  adjustmentOffsetAmount: number;
  /** 조정이 정산금을 넘어 못 뺀 금액 — 주최자에게 청구 협의(약관 제7조). */
  shortfallAmount: number;
  netAmount: number;
}

export const computeShowPayoutCalc = (input: {
  grossAmount: number;
  refundAmount: number;
  /** 판매액 중 토스를 지나지 않은 몫(계좌 입금)에서 그 환불을 뺀 값. */
  bankNetAmount: number;
  taxType: FundingCreatorTaxType;
  /** 이번 정산에 싣는 조정의 합(부호 있음 — 회차 취소 수수료는 음수, 면제 상쇄는 양수). */
  adjustmentAmount: number;
}): ShowPayoutCalc => {
  const chargeAmount = Math.max(0, -Math.trunc(input.adjustmentAmount));
  const netSales = Math.max(0, input.grossAmount - input.refundAmount);
  const r = computeFundingPayoutForProject({
    grossAmount: input.grossAmount,
    refundAmount: input.refundAmount,
    manualGrossAmount: Math.min(Math.max(0, input.bankNetAmount), netSales),
    taxType: input.taxType,
    charges: { designFee: chargeAmount, productionFee: 0 },
  });
  return {
    grossAmount: r.grossAmount,
    refundAmount: r.refundAmount,
    netSalesAmount: netSales,
    platformFeeAmount: r.platformFeeAmount,
    paymentFeeAmount: r.paymentFeeAmount,
    vatDeductionAmount: r.vatDeductionAmount,
    shareAmount: r.shareAmount,
    withholdingAmount: r.withholdingAmount,
    adjustmentOffsetAmount: r.designFeeOffsetAmount + r.productionFeeOffsetAmount,
    shortfallAmount: r.shortfallAmount,
    netAmount: r.netAmount,
  };
};
