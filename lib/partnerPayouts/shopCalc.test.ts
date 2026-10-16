import { computeShopArtistPayout } from '../shop/artistPayout';
import { computeShopPayoutCalc } from './shopCalc';

describe('computeShopPayoutCalc — computeShopArtistPayout 위에 이월 조정만 얹는다', () => {
  it('조정이 없으면 순수 계산과 같다(두 세금 유형, 배송비 포함)', () => {
    for (const taxType of ['withholding', 'invoice'] as const) {
      const base = computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType, shippingAmount: 4000 });
      expect(computeShopPayoutCalc({ salesAmount: 40000, shippingAmount: 4000, taxType, adjustmentAmount: 0 })).toEqual({
        ...base, adjustmentAmount: 0, carryOverAmount: 0,
      });
    }
  });

  it('조정은 부가세 상당액·원천징수를 계산하기 전 몫(VAT 포함)에 더해진다', () => {
    // 20,000원 CD 2장: 몫 22,000 → 조정 −5,500 → 16,500. 사업자는 그대로, 개인은 /1.1 = 15,000에서 3.3%.
    const inv = computeShopPayoutCalc({ salesAmount: 40000, shippingAmount: 0, taxType: 'invoice', adjustmentAmount: -5500 });
    expect(inv).toMatchObject({ shareAmount: 16500, vatDeductionAmount: 0, withholdingAmount: 0, netAmount: 16500, carryOverAmount: 0 });
    const wh = computeShopPayoutCalc({ salesAmount: 40000, shippingAmount: 0, taxType: 'withholding', adjustmentAmount: -5500 });
    expect(wh).toMatchObject({ shareAmount: 15000, vatDeductionAmount: 1500 });
    expect(wh.netAmount).toBe(15000 - wh.withholdingAmount);
    expect(wh.shareAmount + wh.vatDeductionAmount).toBe(16500);
  });

  it('양수 조정(수기 가산)도 더한다', () => {
    expect(computeShopPayoutCalc({ salesAmount: 40000, shippingAmount: 0, taxType: 'invoice', adjustmentAmount: 1000 }).netAmount).toBe(23000);
  });

  it('조정이 몫을 넘으면 몫과 실이체액은 0이고, 모자란 음수가 이월 값으로 남는다', () => {
    const c = computeShopPayoutCalc({ salesAmount: 40000, shippingAmount: 0, taxType: 'withholding', adjustmentAmount: -30000 });
    expect(c).toMatchObject({ shareAmount: 0, vatDeductionAmount: 0, withholdingAmount: 0, netAmount: 0, carryOverAmount: -8000, adjustmentAmount: -30000 });
  });

  it('몫이 딱 0이면 이월은 없다', () => {
    expect(computeShopPayoutCalc({ salesAmount: 40000, shippingAmount: 0, taxType: 'invoice', adjustmentAmount: -22000 })).toMatchObject({ netAmount: 0, carryOverAmount: 0 });
  });

  it('판매가 0인 달에 음수 조정만 있으면 전부 이월', () => {
    expect(computeShopPayoutCalc({ salesAmount: 0, shippingAmount: 0, taxType: 'invoice', adjustmentAmount: -22000 })).toMatchObject({ netAmount: 0, carryOverAmount: -22000 });
  });
});
