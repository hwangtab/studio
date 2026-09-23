/**
 * 펀딩 정산 순수 계산 — computeFundingPayout(Task 1). 돈이 걸린 숫자라 예시 값을 고정한다.
 */
import { computeFundingPayout } from './payout';

describe('computeFundingPayout', () => {
  it('100만원 모금·환불 0·원천징수 개설자 — 전 항목', () => {
    expect(computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' })).toEqual({
      grossAmount: 1_000_000,
      refundAmount: 0,
      supplyAmount: 909_091,
      feeAmount: 89_000,
      platformFeeAmount: 55_000,
      paymentFeeAmount: 34_000,
      shareAmount: 911_000,
      withholdingAmount: 30_063,
      netAmount: 880_937,
    });
  });

  it('사업자(invoice)는 원천징수 0 — 실수령액이 shareAmount와 같다', () => {
    const p = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'invoice' });
    expect(p.withholdingAmount).toBe(0);
    expect(p.netAmount).toBe(p.shareAmount);
    expect(p.netAmount).toBe(911_000);
  });

  it('환불이 모금액을 넘으면 전 항목이 0', () => {
    const p = computeFundingPayout({ grossAmount: 5000, refundAmount: 9000, taxType: 'withholding' });
    expect(p).toEqual({
      grossAmount: 5000,
      refundAmount: 9000,
      supplyAmount: 0,
      feeAmount: 0,
      platformFeeAmount: 0,
      paymentFeeAmount: 0,
      shareAmount: 0,
      withholdingAmount: 0,
      netAmount: 0,
    });
  });

  it('환불은 모금액에서 먼저 뺀다 — 환불분에도 수수료를 매기지 않는다', () => {
    const p = computeFundingPayout({ grossAmount: 2_000_000, refundAmount: 1_000_000, taxType: 'withholding' });
    expect(p.grossAmount).toBe(2_000_000);
    expect(p.refundAmount).toBe(1_000_000);
    // netGross는 1,000,000 — 위 첫 케이스와 같은 수수료·정산액이 나와야 한다.
    expect(p.feeAmount).toBe(89_000);
    expect(p.netAmount).toBe(880_937);
  });

  it('반올림이 음수를 만들지 않는다 — 작은 금액도 전 항목이 0 이상', () => {
    for (const gross of [0, 1, 10, 100, 999]) {
      const p = computeFundingPayout({ grossAmount: gross, refundAmount: 0, taxType: 'withholding' });
      expect(p.feeAmount).toBeGreaterThanOrEqual(0);
      expect(p.shareAmount).toBeGreaterThanOrEqual(0);
      expect(p.withholdingAmount).toBeGreaterThanOrEqual(0);
      expect(p.netAmount).toBeGreaterThanOrEqual(0);
    }
  });

  it('shareAmount + feeAmount === netGross — 원 단위가 새지 않는다', () => {
    for (const gross of [0, 999, 12_345, 1_000_000, 3_333_333, 9_999_999]) {
      for (const taxType of ['withholding', 'invoice'] as const) {
        const p = computeFundingPayout({ grossAmount: gross, refundAmount: 0, taxType });
        const netGross = Math.max(0, p.grossAmount - p.refundAmount);
        expect(p.shareAmount + p.feeAmount).toBe(netGross);
        expect(p.platformFeeAmount + p.paymentFeeAmount).toBe(p.feeAmount);
      }
    }
  });
});
