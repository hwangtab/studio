import { computeBusinessIncomeWithholding } from './withholdingTax';
import { ARTIST_SUPPORT_WITHHOLDING_PERCENT, FUNDING_WITHHOLDING_PERCENT } from '../data/pricing';

describe('computeBusinessIncomeWithholding — 소득세 3% 절사, 지방소득세 = 소득세 10% 절사', () => {
  it('딱 떨어지는 금액은 3.3%와 같다 — 100만원 30,000 + 3,000, 20만원 6,000 + 600', () => {
    expect(computeBusinessIncomeWithholding(1_000_000)).toEqual({ incomeTax: 30_000, localIncomeTax: 3_000, total: 33_000 });
    expect(computeBusinessIncomeWithholding(200_000)).toEqual({ incomeTax: 6_000, localIncomeTax: 600, total: 6_600 });
  });

  it('829,091원 — 24,872 + 2,487 = 27,359 (3.3% 한 번에 반올림하면 27,360)', () => {
    expect(computeBusinessIncomeWithholding(829_091)).toEqual({ incomeTax: 24_872, localIncomeTax: 2_487, total: 27_359 });
  });

  it('원 단위 경계 — 각 단계에서 올리지 않고 버린다', () => {
    // 33 × 3% = 0.99 → 0
    expect(computeBusinessIncomeWithholding(33)).toEqual({ incomeTax: 0, localIncomeTax: 0, total: 0 });
    // 34 × 3% = 1.02 → 1, 지방소득세 0.1 → 0
    expect(computeBusinessIncomeWithholding(34)).toEqual({ incomeTax: 1, localIncomeTax: 0, total: 1 });
    // 333 × 3% = 9.99 → 9, 지방 0.9 → 0 / 334 → 10.02 → 10, 지방 1
    expect(computeBusinessIncomeWithholding(333)).toEqual({ incomeTax: 9, localIncomeTax: 0, total: 9 });
    expect(computeBusinessIncomeWithholding(334)).toEqual({ incomeTax: 10, localIncomeTax: 1, total: 11 });
    expect(computeBusinessIncomeWithholding(0)).toEqual({ incomeTax: 0, localIncomeTax: 0, total: 0 });
    expect(computeBusinessIncomeWithholding(-100)).toEqual({ incomeTax: 0, localIncomeTax: 0, total: 0 });
  });

  it('화면 문구의 요율(3.3%)이 이 식과 같은 뜻이다 — 요율 상수가 바뀌면 이 식도 함께 봐야 한다', () => {
    const { total } = computeBusinessIncomeWithholding(1_000_000);
    expect((total / 1_000_000) * 100).toBeCloseTo(FUNDING_WITHHOLDING_PERCENT, 10);
    expect((total / 1_000_000) * 100).toBeCloseTo(ARTIST_SUPPORT_WITHHOLDING_PERCENT, 10);
  });
});
