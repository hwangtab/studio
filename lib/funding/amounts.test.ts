import { MAX_MANUAL_ACTUAL_AMOUNT } from './policy';

import { computeFundingAmounts, splitFundingAmount } from './amounts';
describe('computeFundingAmounts', () => {
  it('VAT 포함가를 공급가·VAT로 분해한다', () => {
    expect(computeFundingAmounts(30000, 2, 0)).toEqual({ itemAmount: 54545, vatAmount: 5455, totalAmount: 60000 });
    expect(computeFundingAmounts(1000, 1, 0)).toEqual({ itemAmount: 909, vatAmount: 91, totalAmount: 1000 });
  });
  it('추가 펀딩 금액을 합계에 더한다', () => {
    expect(computeFundingAmounts(30000, 1, 5000).totalAmount).toBe(35000);
  });
});

describe('splitFundingAmount', () => {
  it('언제나 item + vat === total', () => {
    for (const total of [1, 2, 10, 999, 1000, 1001, 30000, 35000, 1_234_567, MAX_MANUAL_ACTUAL_AMOUNT]) {
      const a = splitFundingAmount(total);
      expect(a.itemAmount + a.vatAmount).toBe(total);
      expect(a.totalAmount).toBe(total);
    }
  });
  it('경계값 — 1원과 상한', () => {
    expect(splitFundingAmount(1)).toEqual({ itemAmount: 1, vatAmount: 0, totalAmount: 1 });
    expect(splitFundingAmount(MAX_MANUAL_ACTUAL_AMOUNT)).toEqual({
      itemAmount: 45_454_545, vatAmount: 4_545_455, totalAmount: 50_000_000,
    });
  });
  it('computeFundingAmounts와 같은 분해를 쓴다', () => {
    expect(computeFundingAmounts(30000, 2, 5000)).toEqual(splitFundingAmount(65000));
  });
});
