import { getPricingData } from '../../data/pricing';
import { computeMixingAmounts, getMixingProduct, MIXING_PRODUCTS, resolveSongCount } from './mixing-products';

describe('MIXING_PRODUCTS ↔ data/pricing.ts 오퍼 id 정합', () => {
  it('오퍼 id 집합이 mixingOffers·masteringOffers와 1:1이다', () => {
    const d = getPricingData('ko');
    const offerIds = new Set([...d.mixingOffers, ...d.masteringOffers].map((o) => o.id));
    const productIds = new Set(MIXING_PRODUCTS.map((p) => p.id));
    expect(productIds).toEqual(offerIds);
  });

  it('곡당 단가가 오퍼 priceValue와 같다', () => {
    const d = getPricingData('ko');
    const byId = new Map([...d.mixingOffers, ...d.masteringOffers].map((o) => [o.id, o.priceValue]));
    for (const p of MIXING_PRODUCTS) {
      expect(p.unitAmount).toBe(byId.get(p.id));
    }
  });
});

describe('resolveSongCount', () => {
  it('범위 안은 그대로 통과', () => {
    const p = getMixingProduct('mixing-level1')!;
    expect(resolveSongCount(p, 5)).toBe(5);
  });
  it('범위 밖·정수 아님·타입 불일치는 null', () => {
    const p = getMixingProduct('mixing-level1')!;
    expect(resolveSongCount(p, 0)).toBeNull();
    expect(resolveSongCount(p, 11)).toBeNull();
    expect(resolveSongCount(p, 1.5)).toBeNull();
    expect(resolveSongCount(p, '3')).toBeNull();
    expect(resolveSongCount(p, undefined)).toBeNull();
  });
  it('마스터링 패키지는 4~20곡', () => {
    const p = getMixingProduct('mastering-package')!;
    expect(resolveSongCount(p, 3)).toBeNull();
    expect(resolveSongCount(p, 4)).toBe(4);
    expect(resolveSongCount(p, 20)).toBe(20);
    expect(resolveSongCount(p, 21)).toBeNull();
  });
});

describe('computeMixingAmounts', () => {
  it('튜닝 없이 3곡 · 믹싱 10트랙 이하 = 60만 + VAT 6만', () => {
    const p = getMixingProduct('mixing-level1')!;
    expect(computeMixingAmounts(p, 3, false)).toEqual({ itemAmount: 600000, vatAmount: 60000, totalAmount: 660000 });
  });
  it('튜닝 포함 2곡 · 믹싱 10트랙 이하 = (200,000+150,000)*2 + VAT', () => {
    const p = getMixingProduct('mixing-level1')!;
    const amounts = computeMixingAmounts(p, 2, true);
    expect(amounts.itemAmount).toBe(700000);
    expect(amounts.vatAmount).toBe(70000);
    expect(amounts.totalAmount).toBe(770000);
  });
  it('마스터링은 튜닝 옵션이 없으므로(tuningEligible=false) true를 넘겨도 계산기는 그대로 더한다 — 방지는 validation의 책임', () => {
    const p = getMixingProduct('mastering-single')!;
    expect(p.tuningEligible).toBe(false);
    expect(computeMixingAmounts(p, 1, false)).toEqual({ itemAmount: 100000, vatAmount: 10000, totalAmount: 110000 });
  });
});
