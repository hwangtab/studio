/**
 * 펀딩 정산 순수 계산 — computeFundingPayout(Task 1). 돈이 걸린 숫자라 예시 값을 고정한다.
 */
import { computeFundingPayout, applyServiceCharges } from './payout';

describe('설계비·제작비 공제 (개설자 약관 제6조, 2026-09-28)', () => {
  it('원천징수까지 뺀 금액에서 설계비 → 제작비 순으로 뺀다 — 수수료·원천징수 계산에는 들어가지 않는다', () => {
    const p = computeFundingPayout({
      grossAmount: 3_000_000, refundAmount: 0, taxType: 'withholding',
      charges: { designFee: 550_000, productionFee: 1_980_000 },
    });
    // 수수료·원천징수는 공제가 없을 때와 같다
    const base = computeFundingPayout({ grossAmount: 3_000_000, refundAmount: 0, taxType: 'withholding' });
    expect(p.feeAmount).toBe(base.feeAmount);
    expect(p.withholdingAmount).toBe(base.withholdingAmount);
    expect(p.designFeeOffsetAmount).toBe(550_000);
    expect(p.productionFeeOffsetAmount).toBe(1_980_000);
    expect(p.shortfallAmount).toBe(0);
    expect(p.netAmount).toBe(base.netAmount - 550_000 - 1_980_000);
  });

  it('대금이 정산금을 넘으면 실지급 0원, 넘는 부분은 차액으로 남긴다(음수로 가지 않는다)', () => {
    const p = computeFundingPayout({
      grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding',
      charges: { designFee: 550_000, productionFee: 1_980_000 },
    });
    // 이체 가능액 881,904 → 설계비 550,000 전부, 제작비 331,904만 빠지고 나머지는 차액
    expect(p.designFeeOffsetAmount).toBe(550_000);
    expect(p.productionFeeOffsetAmount).toBe(331_904);
    expect(p.shortfallAmount).toBe(550_000 + 1_980_000 - 881_904);
    expect(p.netAmount).toBe(0);
  });

  it('applyServiceCharges — 이체 가능액이 음수여도 0으로 본다', () => {
    expect(applyServiceCharges(-100, { designFee: 1000, productionFee: 0 })).toEqual({
      designFeeOffsetAmount: 0, productionFeeOffsetAmount: 0, shortfallAmount: 1000, netAmount: 0,
    });
  });
});

describe('computeFundingPayout', () => {
  it('100만원 모금·환불 0·원천징수 개설자 — 전 항목', () => {
    expect(computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' })).toEqual({
      grossAmount: 1_000_000,
      refundAmount: 0,
      supplyAmount: 909_091,
      feeAmount: 88_000,
      platformFeeAmount: 55_000,
      paymentFeeAmount: 33_000,
      shareAmount: 912_000,
      withholdingAmount: 30_096,
      designFeeOffsetAmount: 0,
      productionFeeOffsetAmount: 0,
      shortfallAmount: 0,
      netAmount: 881_904,
    });
  });

  it('사업자(invoice)는 원천징수 0 — 실수령액이 shareAmount와 같다', () => {
    const p = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'invoice' });
    expect(p.withholdingAmount).toBe(0);
    expect(p.netAmount).toBe(p.shareAmount);
    expect(p.netAmount).toBe(912_000);
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
      designFeeOffsetAmount: 0,
      productionFeeOffsetAmount: 0,
      shortfallAmount: 0,
      netAmount: 0,
    });
  });

  it('환불은 모금액에서 먼저 뺀다 — 환불분에도 수수료를 매기지 않는다', () => {
    const p = computeFundingPayout({ grossAmount: 2_000_000, refundAmount: 1_000_000, taxType: 'withholding' });
    expect(p.grossAmount).toBe(2_000_000);
    expect(p.refundAmount).toBe(1_000_000);
    // netGross는 1,000,000 — 위 첫 케이스와 같은 수수료·정산액이 나와야 한다.
    expect(p.feeAmount).toBe(88_000);
    expect(p.netAmount).toBe(881_904);
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
