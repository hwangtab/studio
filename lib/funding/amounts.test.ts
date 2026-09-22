import { computeFundingAmounts } from './amounts';
describe('computeFundingAmounts', () => {
  it('VAT 포함가를 공급가·VAT로 분해한다', () => {
    expect(computeFundingAmounts(30000, 2, 0)).toEqual({ itemAmount: 54545, vatAmount: 5455, totalAmount: 60000 });
    expect(computeFundingAmounts(1000, 1, 0)).toEqual({ itemAmount: 909, vatAmount: 91, totalAmount: 1000 });
  });
  it('추가 후원금을 합계에 더한다', () => {
    expect(computeFundingAmounts(30000, 1, 5000).totalAmount).toBe(35000);
  });
});
