import { getPricingData } from '../../data/pricing';
import { computeMixingAmounts, getMixingProduct, MIXING_PRODUCTS, mixingUnitAmount, resolveSongCount } from './mixing-products';

// 통합 상품(믹싱+마스터링)은 요금 페이지 오퍼가 아니라 주문 전용 상품이다 — 단품만 오퍼와 1:1이다.
const SINGLE_PRODUCTS = MIXING_PRODUCTS.filter((p) => !p.combinedOf);
const COMBINED_PRODUCTS = MIXING_PRODUCTS.filter((p) => p.combinedOf);

describe('MIXING_PRODUCTS ↔ data/pricing.ts 오퍼 id 정합', () => {
  it('단품 상품 id 집합이 mixingOffers·masteringOffers와 1:1이다', () => {
    const d = getPricingData('ko');
    const offerIds = new Set([...d.mixingOffers, ...d.masteringOffers].map((o) => o.id));
    expect(new Set(SINGLE_PRODUCTS.map((p) => p.id))).toEqual(offerIds);
  });

  it('단품 곡당 단가가 오퍼 priceValue와 같다', () => {
    const d = getPricingData('ko');
    const byId = new Map([...d.mixingOffers, ...d.masteringOffers].map((o) => [o.id, o.priceValue]));
    for (const p of SINGLE_PRODUCTS) {
      expect(p.unitAmount).toBe(byId.get(p.id));
    }
  });
});

describe('믹싱+마스터링 통합 상품 — 가격은 두 단품의 합산 그대로(번들 할인 없음)', () => {
  const tiers: Array<[string, string]> = [
    ['mixing-mastering-level1', 'mixing-level1'],
    ['mixing-mastering-level2', 'mixing-level2'],
    ['mixing-mastering-level3', 'mixing-level3'],
  ];
  const itemAmount = (id: string, songs: number, tuning = false) =>
    computeMixingAmounts(getMixingProduct(id)!, songs, tuning).itemAmount;

  it('믹싱 3티어마다 하나씩 있다', () => {
    expect(COMBINED_PRODUCTS.map((p) => p.id)).toEqual(tiers.map(([combined]) => combined));
  });

  it.each(tiers)('%s: 1~3곡은 믹싱 + 싱글 마스터링의 합과 같다', (combined, mixing) => {
    for (const songs of [1, 2, 3]) {
      expect(itemAmount(combined, songs)).toBe(itemAmount(mixing, songs) + itemAmount('mastering-single', songs));
    }
  });

  it.each(tiers)('%s: 4곡 이상은 믹싱 + 마스터링 패키지의 합과 같다', (combined, mixing) => {
    for (const songs of [4, 7, 10]) {
      expect(itemAmount(combined, songs)).toBe(itemAmount(mixing, songs) + itemAmount('mastering-package', songs));
    }
  });

  it.each(tiers)('%s: 보컬 튜닝 옵션은 믹싱과 같이 곡당 가산이다', (combined, mixing) => {
    expect(itemAmount(combined, 2, true) - itemAmount(combined, 2)).toBe(itemAmount(mixing, 2, true) - itemAmount(mixing, 2));
  });

  it('위저드 표시용 unitAmount는 1~3곡 단가다', () => {
    for (const p of COMBINED_PRODUCTS) expect(mixingUnitAmount(p, 1)).toBe(p.unitAmount);
  });

  it('곡 수 범위는 믹싱과 같은 1~10곡이다', () => {
    const p = getMixingProduct('mixing-mastering-level2')!;
    expect(resolveSongCount(p, 10)).toBe(10);
    expect(resolveSongCount(p, 11)).toBeNull();
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
