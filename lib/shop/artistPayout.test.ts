import { computeShopArtistPayout, kstMonthRange } from './artistPayout';

describe('상점 아티스트 정산(computeShopArtistPayout)', () => {
  it('사업자 아티스트 — 판매가의 55%를 그대로(세금계산서 대상)', () => {
    expect(computeShopArtistPayout({ salesAmount: 20000, refundAmount: 0, taxType: 'invoice' })).toEqual({
      salesAmount: 20000, refundAmount: 0, shippingAmount: 0, storeAmount: 9000, vatDeductionAmount: 0, shareAmount: 11000, withholdingAmount: 0, netAmount: 11000,
    });
  });

  it('원천징수 아티스트 — 부가세 상당액을 빼고 3.3% 원천징수', () => {
    expect(computeShopArtistPayout({ salesAmount: 20000, refundAmount: 0, taxType: 'withholding' })).toEqual({
      salesAmount: 20000, refundAmount: 0, shippingAmount: 0, storeAmount: 9000, vatDeductionAmount: 1000, shareAmount: 10000, withholdingAmount: 330, netAmount: 9670,
    });
  });

  it.each([20000, 35000, 1234567])('판매액 %i원 — 두 유형 모두 부가세 정산 뒤 스튜디오에 남는 금액이 같다', (sales) => {
    const vat = (gross: number) => gross - Math.round(gross / 1.1);
    const invoice = computeShopArtistPayout({ salesAmount: sales, refundAmount: 0, taxType: 'invoice' });
    const withholding = computeShopArtistPayout({ salesAmount: sales, refundAmount: 0, taxType: 'withholding' });
    // 사업자: 판매 부가세를 내고, 아티스트 세금계산서의 매입세액을 공제받는다.
    const studioInvoice = sales - vat(sales) + vat(invoice.shareAmount) - invoice.shareAmount;
    // 원천징수: 매입세액 공제가 없고, 원천징수액은 스튜디오가 대신 내는 아티스트의 세금이다.
    const studioWithholding = sales - vat(sales) - withholding.shareAmount;
    expect(Math.abs(studioInvoice - studioWithholding)).toBeLessThanOrEqual(1);
  });

  it('아티스트 직접 발송 — 배송비 전액이 아티스트 몫에 더해진다(상품 55% + 배송비 100%)', () => {
    // 20,000원 CD 1장 + 배송비 4,000원: 55% = 11,000 + 4,000 = 15,000. 스튜디오 몫(storeAmount)은 상품분 그대로.
    expect(computeShopArtistPayout({ salesAmount: 20000, refundAmount: 0, taxType: 'invoice', shippingAmount: 4000 })).toEqual({
      salesAmount: 20000, refundAmount: 0, shippingAmount: 4000, storeAmount: 9000, vatDeductionAmount: 0, shareAmount: 15000, withholdingAmount: 0, netAmount: 15000,
    });
    // 개인: 배송비도 같은 결제의 일부라 부가세 상당액을 같은 식으로 뺀다 — round(15,000 / 1.1) = 13,636, 원천징수 3.3%.
    const p = computeShopArtistPayout({ salesAmount: 20000, refundAmount: 0, taxType: 'withholding', shippingAmount: 4000 });
    expect(p.shareAmount).toBe(13636);
    expect(p.vatDeductionAmount).toBe(15000 - 13636);
    expect(p.netAmount).toBe(p.shareAmount - p.withholdingAmount);
  });

  it('배송비가 없거나 음수면 0으로 본다', () => {
    expect(computeShopArtistPayout({ salesAmount: 20000, refundAmount: 0, taxType: 'invoice' }).shippingAmount).toBe(0);
    expect(computeShopArtistPayout({ salesAmount: 20000, refundAmount: 0, taxType: 'invoice', shippingAmount: -100 }).shareAmount).toBe(11000);
  });

  it('환불을 빼고, 음수가 되지 않는다', () => {
    expect(computeShopArtistPayout({ salesAmount: 20000, refundAmount: 20000, taxType: 'invoice' }).netAmount).toBe(0);
    expect(computeShopArtistPayout({ salesAmount: 0, refundAmount: 5000, taxType: 'withholding' }).netAmount).toBe(0);
  });
});

describe('kstMonthRange', () => {
  it('KST 달의 시작·끝(초)', () => {
    expect(kstMonthRange('2026-10')).toEqual({
      from: Date.parse('2026-10-01T00:00:00+09:00') / 1000,
      to: Date.parse('2026-11-01T00:00:00+09:00') / 1000,
    });
    expect(kstMonthRange('2026-12')?.to).toBe(Date.parse('2027-01-01T00:00:00+09:00') / 1000);
  });

  it.each(['2026-13', '2026-1', '', '2026-10-01'])('형식이 틀리면 null: %p', (m) => {
    expect(kstMonthRange(m)).toBeNull();
  });
});
