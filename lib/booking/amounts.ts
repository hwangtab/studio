import type { SessionProduct } from './products';

export const VAT_RATE = 0.1;

export interface OrderAmounts {
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
}

/** 사이트 표기는 VAT 별도 — 온라인 청구는 포함액. 상품가가 만원 단위라 VAT는 항상 정수. */
export const computeAmounts = (product: SessionProduct, hours: number): OrderAmounts => {
  const itemAmount = product.kind === 'package' ? product.unitAmount : product.unitAmount * hours;
  const vatAmount = Math.round(itemAmount * VAT_RATE);
  return { itemAmount, vatAmount, totalAmount: itemAmount + vatAmount };
};

/**
 * VAT 포함액 → 공급가·VAT. 아티스트 구독처럼 소비자 표기가 포함액인 상품용.
 * 공급가를 반올림하고 VAT를 나머지로 두어 합이 정확히 포함액과 같게 한다.
 */
export const splitInclusiveAmount = (totalAmount: number): OrderAmounts => {
  const itemAmount = Math.round(totalAmount / (1 + VAT_RATE));
  return { itemAmount, vatAmount: totalAmount - itemAmount, totalAmount };
};
