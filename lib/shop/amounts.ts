import { shopShippingFeeFor } from '../../data/shop/policy';

/**
 * 상점 주문 금액 — 순수 함수. 상품 화면의 미리보기와 주문 API가 **같은 함수**로 계산한다(화면이 보여 준 금액과
 * 결제 금액이 갈리지 않게). 금액은 전부 VAT 포함이다.
 */

export interface ShopLinePrice {
  unitPrice: number;
  quantity: number;
}

export interface ShopTotals {
  subtotal: number;
  shippingFee: number;
  total: number;
}

export const computeShopTotals = (lines: readonly ShopLinePrice[]): ShopTotals => {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const shippingFee = subtotal > 0 ? shopShippingFeeFor(subtotal) : 0;
  return { subtotal, shippingFee, total: subtotal + shippingFee };
};
