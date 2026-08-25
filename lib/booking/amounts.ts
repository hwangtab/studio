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
