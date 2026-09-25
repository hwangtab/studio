export interface FundingAmounts { itemAmount: number; vatAmount: number; totalAmount: number }

/**
 * VAT 포함 총액을 orders 규약(item + vat = total)에 맞춰 분해한다.
 *
 * 총액이 이미 정해진 경로(수기 등록의 실수령액)와 리워드가에서 계산하는 경로가 같은
 * 반올림을 써야 한다 — 두 곳에 `Math.round(total / 1.1)`을 각각 적으면 한쪽만 고쳤을 때
 * 같은 금액이 다른 공급가로 기록된다.
 */
export const splitFundingAmount = (totalAmount: number): FundingAmounts => {
  const itemAmount = Math.round(totalAmount / 1.1);
  return { itemAmount, vatAmount: totalAmount - itemAmount, totalAmount };
};

/** 리워드가는 VAT 포함가. 수량·추가 펀딩을 더한 총액을 위 규약대로 분해한다. */
export const computeFundingAmounts = (unitAmount: number, quantity: number, additionalAmount: number): FundingAmounts =>
  splitFundingAmount(unitAmount * quantity + additionalAmount);
