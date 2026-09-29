import { computeFundingGoal, netPayoutForGross } from './goal';
import { computeFundingPayout } from './payout';

describe('펀딩 목표액 역산 (lib/funding/goal)', () => {
  it('netPayoutForGross가 정산 정본 computeFundingPayout과 원 단위까지 같다', () => {
    const grosses = [0, 1, 99, 1000000, 1234567, 3530000, 8101000, 16106000, 45678901];
    for (const gross of grosses) {
      for (const withholding of [true, false]) {
        const canonical = computeFundingPayout({
          grossAmount: gross,
          refundAmount: 0,
          taxType: withholding ? 'withholding' : 'invoice',
        });
        expect(netPayoutForGross(gross, withholding)).toBe(canonical.netAmount);
      }
    }
  });

  it('목표액은 정산 후 비용을 덮는 가장 작은 1만원 단위다', () => {
    for (const cost of [0, 2530000, 4030000, 9990000]) {
      for (const withholding of [true, false]) {
        const { goal, net } = computeFundingGoal({ productionCost: cost, otherCost: 0, withholding });
        expect(goal % 10000).toBe(0);
        expect(net).toBeGreaterThanOrEqual(cost);
        if (goal > 0) expect(netPayoutForGross(goal - 10000, withholding)).toBeLessThan(cost);
      }
    }
  });

  it('100만원이면 개인 801,731원 · 사업자 912,000원 — 개인은 부가세 상당액을 빼고 원천징수한다', () => {
    expect(netPayoutForGross(1_000_000, true)).toBe(801_731);
    expect(netPayoutForGross(1_000_000, false)).toBe(912_000);
  });

  it('내역이 목표액과 맞아떨어진다', () => {
    for (const withholding of [true, false]) {
      const r = computeFundingGoal({ productionCost: 2530000, otherCost: 1500000, withholding });
      expect(r.platformFee + r.paymentFee + r.vatDeduction + r.withheld + r.net).toBe(r.goal);
      expect(r.totalCost).toBe(4030000);
      if (!withholding) expect(r.vatDeduction).toBe(0);
    }
  });
});
