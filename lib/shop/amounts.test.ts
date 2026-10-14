import { computeShopTotals } from './amounts';
import { SHOP_FREE_SHIPPING_FROM, SHOP_SHIPPING_FEE } from '../../data/shop/policy';

describe('computeShopTotals', () => {
  const lines = [{ unitPrice: 5000, quantity: 2 }];
  it('실물이 있으면 배송비가 붙는다(기본)', () => {
    expect(computeShopTotals(lines)).toEqual({ subtotal: 10000, physicalSubtotal: 10000, shippingFee: SHOP_SHIPPING_FEE, total: 10000 + SHOP_SHIPPING_FEE });
  });
  it('배송이 없는 주문(디지털만)은 배송비 0', () => {
    expect(computeShopTotals([{ unitPrice: 5000, quantity: 2, digital: true }])).toEqual({ subtotal: 10000, physicalSubtotal: 0, shippingFee: 0, total: 10000 });
  });
  it('무료 배송 기준은 실물 줄 합계로 본다 — 디지털을 얹어도 실물 배송비는 그대로', () => {
    const totals = computeShopTotals([
      { unitPrice: SHOP_FREE_SHIPPING_FROM - 1, quantity: 1 },
      { unitPrice: 10000, quantity: 1, digital: true },
    ]);
    expect(totals.shippingFee).toBe(SHOP_SHIPPING_FEE);
    expect(computeShopTotals([{ unitPrice: SHOP_FREE_SHIPPING_FROM, quantity: 1 }]).shippingFee).toBe(0);
  });
});
