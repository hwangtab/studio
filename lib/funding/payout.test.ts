/**
 * 펀딩 정산 순수 계산 — computeFundingPayout(Task 1). 돈이 걸린 숫자라 예시 값을 고정한다.
 */
import { computeFundingPayout, applyServiceCharges, recordedVatDeduction } from './payout';

describe('설계비·제작비 공제 (개설자 약관 제6조, 2026-09-28)', () => {
  it('원천징수까지 뺀 금액에서 설계비 → 제작비 순으로 뺀다 — 수수료·원천징수 계산에는 들어가지 않는다', () => {
    const p = computeFundingPayout({
      grossAmount: 4_000_000, refundAmount: 0, taxType: 'withholding',
      charges: { designFee: 550_000, productionFee: 1_980_000 },
    });
    // 수수료·부가세 상당액·원천징수는 공제가 없을 때와 같다
    const base = computeFundingPayout({ grossAmount: 4_000_000, refundAmount: 0, taxType: 'withholding' });
    expect(p.feeAmount).toBe(base.feeAmount);
    expect(p.vatDeductionAmount).toBe(base.vatDeductionAmount);
    expect(p.withholdingAmount).toBe(base.withholdingAmount);
    expect(p.designFeeOffsetAmount).toBe(550_000);
    expect(p.productionFeeOffsetAmount).toBe(1_980_000);
    expect(p.shortfallAmount).toBe(0);
    // 이체 가능액 3,206,925 − 2,530,000
    expect(p.netAmount).toBe(676_925);
  });

  it('대금이 정산금을 넘으면 실지급 0원, 넘는 부분은 차액으로 남긴다(음수로 가지 않는다)', () => {
    const p = computeFundingPayout({
      grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding',
      charges: { designFee: 550_000, productionFee: 1_980_000 },
    });
    // 이체 가능액 801,732 → 설계비 550,000 전부, 제작비 251,732만 빠지고 나머지는 차액
    expect(p.designFeeOffsetAmount).toBe(550_000);
    expect(p.productionFeeOffsetAmount).toBe(251_732);
    expect(p.shortfallAmount).toBe(1_728_268);
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
    // 수수료 뗀 912,000(부가세 포함)에서 부가세 상당액 82,909를 빼 829,091, 소득세 24,872(3% 절사)와 지방소득세 2,487(소득세의 10% 절사), 합 27,359를 원천징수
    expect(computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' })).toEqual({
      grossAmount: 1_000_000,
      refundAmount: 0,
      supplyAmount: 909_091,
      feeAmount: 88_000,
      platformFeeAmount: 55_000,
      paymentFeeAmount: 33_000,
      vatDeductionAmount: 82_909,
      shareAmount: 829_091,
      withholdingAmount: 27_359,
      designFeeOffsetAmount: 0,
      productionFeeOffsetAmount: 0,
      shortfallAmount: 0,
      netAmount: 801_732,
    });
  });

  it('사업자(invoice)는 부가세 상당액·원천징수 0 — 정산금 912,000원에 대한 세금계산서를 받는다', () => {
    const p = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'invoice' });
    expect(p.vatDeductionAmount).toBe(0);
    expect(p.withholdingAmount).toBe(0);
    expect(p.netAmount).toBe(p.shareAmount);
    expect(p.netAmount).toBe(912_000);
  });

  /**
   * 이 수정의 이유를 숫자로 고정한다. 판매자인 스튜디오가 후원금 전체의 부가세(10/110)를 내는데,
   * 사업자 개설자에게서는 정산금에 대한 세금계산서로 매입세액을 공제받고 원천징수 개설자에게서는
   * 공제받지 못한다. 스튜디오에 남는 금액(부가세 정산 뒤, PG 비용 전)이 두 유형에서 같아야 한다 —
   * 수정 전에는 원천징수 개설자 쪽이 −2,909원이었다.
   */
  it('스튜디오에 남는 금액이 개설자 유형과 관계없이 같다(100만원 → 80,000원)', () => {
    const outputVat = 90_909; // 1,000,000 × 10/110
    const invoice = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'invoice' });
    const withholding = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' });
    const invoiceInputVat = 82_909; // 정산금 912,000 × 10/110 — 개설자가 발행한 세금계산서
    expect(1_000_000 - invoice.shareAmount - (outputVat - invoiceInputVat)).toBe(80_000);
    expect(1_000_000 - withholding.shareAmount - outputVat).toBe(80_000);
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
      vatDeductionAmount: 0,
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
    expect(p.vatDeductionAmount).toBe(82_909);
    expect(p.netAmount).toBe(801_732);
  });

  it('300만원 원천징수 — 부가세 상당액 248,727 → 몫 2,487,273 → 원천징수 82,079(74,618 + 7,461) → 2,405,194', () => {
    const p = computeFundingPayout({ grossAmount: 3_000_000, refundAmount: 0, taxType: 'withholding' });
    expect(p.feeAmount).toBe(264_000);
    expect(p.vatDeductionAmount).toBe(248_727);
    expect(p.shareAmount).toBe(2_487_273);
    expect(p.withholdingAmount).toBe(82_079);
    expect(p.netAmount).toBe(2_405_194);
  });

  it('반올림이 음수를 만들지 않는다 — 작은 금액도 전 항목이 0 이상', () => {
    for (const gross of [0, 1, 10, 100, 999]) {
      const p = computeFundingPayout({ grossAmount: gross, refundAmount: 0, taxType: 'withholding' });
      expect(p.feeAmount).toBeGreaterThanOrEqual(0);
      expect(p.vatDeductionAmount).toBeGreaterThanOrEqual(0);
      expect(p.shareAmount).toBeGreaterThanOrEqual(0);
      expect(p.withholdingAmount).toBeGreaterThanOrEqual(0);
      expect(p.netAmount).toBeGreaterThanOrEqual(0);
    }
  });

  it('shareAmount + vatDeductionAmount + feeAmount === netGross — 원 단위가 새지 않는다', () => {
    for (const gross of [0, 999, 12_345, 1_000_000, 3_333_333, 9_999_999]) {
      for (const taxType of ['withholding', 'invoice'] as const) {
        const p = computeFundingPayout({ grossAmount: gross, refundAmount: 0, taxType });
        const netGross = Math.max(0, p.grossAmount - p.refundAmount);
        expect(p.shareAmount + p.vatDeductionAmount + p.feeAmount).toBe(netGross);
        expect(p.platformFeeAmount + p.paymentFeeAmount).toBe(p.feeAmount);
        if (taxType === 'invoice') expect(p.vatDeductionAmount).toBe(0);
      }
    }
  });
});

describe('recordedVatDeduction — 컬럼 없이 기록 행에서 되살린다', () => {
  it('지금 식으로 기록한 원천징수 행이면 계산 때의 값과 같다', () => {
    for (const gross of [0, 999, 12_345, 1_000_000, 3_333_333]) {
      for (const refund of [0, 5_000]) {
        const p = computeFundingPayout({ grossAmount: gross, refundAmount: refund, taxType: 'withholding' });
        expect(recordedVatDeduction(p)).toBe(p.vatDeductionAmount);
      }
    }
  });

  it('식이 바뀌기 전 기록(몫 = 모금액 − 수수료)과 사업자 기록은 0', () => {
    expect(recordedVatDeduction({ grossAmount: 1_000_000, refundAmount: 0, feeAmount: 88_000, shareAmount: 912_000 })).toBe(0);
    expect(recordedVatDeduction({ grossAmount: 1_000_000, refundAmount: 0, feeAmount: 88_000, shareAmount: 829_091 })).toBe(82_909);
  });
});
