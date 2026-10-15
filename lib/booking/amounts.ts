import type { SessionProduct } from './products';

export const VAT_RATE = 0.1;

export interface OrderAmounts {
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * 세션 상품 금액. 사이트 표기가 곧 청구액이다 — **표기가는 VAT 포함**(운영자 확정 2026-10-15,
 * 연습실 월 이용료·레슨만 예외로 별도). 포함액을 splitInclusiveAmount로 공급가·VAT에 나눠 저장한다.
 */
export const computeAmounts = (product: SessionProduct, hours: number): OrderAmounts => {
  const totalAmount = product.kind === 'package' ? product.unitAmount : product.unitAmount * hours;
  return splitInclusiveAmount(totalAmount);
};

/**
 * 공급가(VAT 별도) → 공급가·VAT·합계. **표기가 별도인 상품 전용** — 연습실 월 이용료·레슨(카드 결제)뿐이다.
 * 현금 입금은 부가세를 받지 않으므로 이 함수를 거치지 않는다.
 */
export const addVatToSupply = (itemAmount: number): OrderAmounts => {
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
