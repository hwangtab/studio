import { computeShopTotals } from './amounts';
import { SHOP_SHIPPING_FEE } from '../../data/shop/policy';

describe('computeShopTotals', () => {
  const lines = [{ unitPrice: 5000, quantity: 2 }];
  it('실물이 있으면 배송비가 붙는다(기본)', () => {
    expect(computeShopTotals(lines)).toEqual({ subtotal: 10000, shippingFee: SHOP_SHIPPING_FEE, total: 10000 + SHOP_SHIPPING_FEE });
  });
  it('배송이 없는 주문(디지털만)은 배송비 0', () => {
    expect(computeShopTotals(lines, false)).toEqual({ subtotal: 10000, shippingFee: 0, total: 10000 });
  });
});
