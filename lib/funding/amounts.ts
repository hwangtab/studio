export interface FundingAmounts { itemAmount: number; vatAmount: number; totalAmount: number }

/** 리워드가는 VAT 포함가. orders 규약(item + vat = total)에 맞춰 분해한다. */
export const computeFundingAmounts = (unitAmount: number, quantity: number, additionalAmount: number): FundingAmounts => {
  const totalAmount = unitAmount * quantity + additionalAmount;
  const itemAmount = Math.round(totalAmount / 1.1);
  return { itemAmount, vatAmount: totalAmount - itemAmount, totalAmount };
};
