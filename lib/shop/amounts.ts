import { shopShippingFeeFor } from '../../data/shop/policy';

/**
 * 상점 주문 금액 — 순수 함수. 상품 화면의 미리보기와 주문 API가 **같은 함수**로 계산한다(화면이 보여 준 금액과
 * 결제 금액이 갈리지 않게). 금액은 전부 VAT 포함이다.
 */

export interface ShopLinePrice {
  unitPrice: number;
  quantity: number;
  /** 디지털 상품 줄이면 true. 배송비와 무료 배송 기준은 실물 줄만 본다. */
  digital?: boolean;
}

export interface ShopTotals {
  subtotal: number;
  /** 실물 줄 합계 — 무료 배송 기준이 보는 값. */
  physicalSubtotal: number;
  shippingFee: number;
  total: number;
}

/**
 * 배송비는 실물 줄이 있을 때만, 무료 배송 기준(SHOP_FREE_SHIPPING_FROM)은 **실물 줄 합계**로 본다 — 디지털 상품을 얹어
 * 실물 배송비를 없애지 않게(운영자 결정 2026-10-14).
 */
export const computeShopTotals = (lines: readonly ShopLinePrice[]): ShopTotals => {
  const lineSum = (l: ShopLinePrice) => l.unitPrice * l.quantity;
  const subtotal = lines.reduce((sum, l) => sum + lineSum(l), 0);
  const physical = lines.filter((l) => !l.digital);
  const physicalSubtotal = physical.reduce((sum, l) => sum + lineSum(l), 0);
  const shippingFee = physical.length > 0 && physicalSubtotal > 0 ? shopShippingFeeFor(physicalSubtotal) : 0;
  return { subtotal, physicalSubtotal, shippingFee, total: subtotal + shippingFee };
};
