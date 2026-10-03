import {
  MASTERING_PACKAGE_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../data/pricing';
import { VAT_RATE, type OrderAmounts } from './amounts';

export type MixingServiceType = 'mixing' | 'mastering' | 'mixing-mastering';

export interface MixingProduct {
  id: string;
  serviceType: MixingServiceType;
  nameKo: string;
  /**
   * 곡당 단가(VAT 별도) — data/pricing.ts SSOT. 믹싱+마스터링 통합 상품은 **1~3곡 기준**(싱글
   * 마스터링 단가를 더한 값)이다 — 4곡부터의 단가는 mixingUnitAmount()가 곡 수로 정한다.
   */
  unitAmount: number;
  /** 통합 상품만 있다 — 곡당 단가에 더해지는 두 구성. 단품은 비어 있다. */
  combinedOf?: { mixing: number };
  minSongs: number;
  maxSongs: number;
  /** 보컬 튜닝 옵션을 붙일 수 있는 상품인지. 마스터링은 보컬 트랙을 새로 다듬지 않으므로 불가. */
  tuningEligible: boolean;
}

// 오퍼 id는 data/pricing.ts의 mixingOffers/masteringOffers id와 같은 문자열이다 —
// 허브·가이드 페이지가 이 id로 /ko/booking/mixing-mastering?product=<id> 링크를 만든다.
export const MIXING_PRODUCTS: readonly MixingProduct[] = [
  { id: 'mixing-level1', serviceType: 'mixing', nameKo: '믹싱 · 10트랙 이하', unitAmount: MIXING_LEVEL1_PRICE, minSongs: 1, maxSongs: 10, tuningEligible: true },
  { id: 'mixing-level2', serviceType: 'mixing', nameKo: '믹싱 · 11~30트랙', unitAmount: MIXING_LEVEL2_PRICE, minSongs: 1, maxSongs: 10, tuningEligible: true },
  { id: 'mixing-level3', serviceType: 'mixing', nameKo: '믹싱 · 31트랙 이상', unitAmount: MIXING_LEVEL3_PRICE, minSongs: 1, maxSongs: 10, tuningEligible: true },
  { id: 'mastering-single', serviceType: 'mastering', nameKo: '싱글 마스터링', unitAmount: MASTERING_SINGLE_PRICE, minSongs: 1, maxSongs: 3, tuningEligible: false },
  { id: 'mastering-package', serviceType: 'mastering', nameKo: 'EP·정규 마스터링', unitAmount: MASTERING_PACKAGE_PRICE, minSongs: 4, maxSongs: 20, tuningEligible: false },
  // 믹싱+마스터링 통합 주문(2026-10-03, 운영자 결정: 가격은 두 상품의 합산 그대로 — 번들 할인 없음).
  // 한 주문에 한 상품이라(work_orders 1행) 두 서비스를 같이 담는 장바구니 대신, 믹싱 3티어마다 마스터링을 더한
  // 통합 상품을 둔다. 마스터링 단가는 곡 수가 정한다: 1~3곡은 싱글(곡당 10만), 4곡 이상은 패키지(곡당 8만) —
  // 단품 마스터링과 같은 규칙이다. 이 id는 data/pricing.ts 오퍼에 없다(요금 페이지는 단품만 말한다).
  { id: 'mixing-mastering-level1', serviceType: 'mixing-mastering', nameKo: '믹싱+마스터링 · 10트랙 이하', unitAmount: MIXING_LEVEL1_PRICE + MASTERING_SINGLE_PRICE, combinedOf: { mixing: MIXING_LEVEL1_PRICE }, minSongs: 1, maxSongs: 10, tuningEligible: true },
  { id: 'mixing-mastering-level2', serviceType: 'mixing-mastering', nameKo: '믹싱+마스터링 · 11~30트랙', unitAmount: MIXING_LEVEL2_PRICE + MASTERING_SINGLE_PRICE, combinedOf: { mixing: MIXING_LEVEL2_PRICE }, minSongs: 1, maxSongs: 10, tuningEligible: true },
  { id: 'mixing-mastering-level3', serviceType: 'mixing-mastering', nameKo: '믹싱+마스터링 · 31트랙 이상', unitAmount: MIXING_LEVEL3_PRICE + MASTERING_SINGLE_PRICE, combinedOf: { mixing: MIXING_LEVEL3_PRICE }, minSongs: 1, maxSongs: 10, tuningEligible: true },
] as const;

/** 마스터링 패키지 단가가 적용되는 최소 곡 수 — 단품 마스터링 패키지(mastering-package)의 minSongs와 같다. */
export const MASTERING_PACKAGE_MIN_SONGS = 4;

/**
 * 이 곡 수에서의 곡당 단가(VAT 별도, 튜닝 제외). 서버 계산(service.ts)과 위저드 표시가 같은 함수를
 * 쓴다 — 통합 상품은 곡 수에 따라 마스터링 단가가 바뀌어 단가가 상수가 아니다.
 */
export const mixingUnitAmount = (product: MixingProduct, songCount: number): number =>
  product.combinedOf
    ? product.combinedOf.mixing + (songCount >= MASTERING_PACKAGE_MIN_SONGS ? MASTERING_PACKAGE_PRICE : MASTERING_SINGLE_PRICE)
    : product.unitAmount;

export const getMixingProduct = (id: string): MixingProduct | undefined =>
  MIXING_PRODUCTS.find((p) => p.id === id);

/** 유효하지 않은 곡 수 요청은 null — 호출부가 400으로 바꾼다(SESSION_PRODUCTS.resolveHours 패턴). */
export const resolveSongCount = (product: MixingProduct, requested: unknown): number | null => {
  if (typeof requested !== 'number' || !Number.isInteger(requested)) return null;
  if (requested < product.minSongs || requested > product.maxSongs) return null;
  return requested;
};

/**
 * amounts.ts computeAmounts와 같은 VAT 반올림 규칙(원 단위 반올림)을 쓴다 — 두 계산기가
 * 갈라지면 세션·믹싱 주문의 합계 자릿수 처리가 달라 보이는 문제라 규칙을 하나로 묶는다.
 */
export const computeMixingAmounts = (
  product: MixingProduct,
  songCount: number,
  vocalTuning: boolean,
): OrderAmounts => {
  const itemAmount = mixingUnitAmount(product, songCount) * songCount + (vocalTuning ? VOCAL_TUNING_ADDON_PRICE * songCount : 0);
  const vatAmount = Math.round(itemAmount * VAT_RATE);
  return { itemAmount, vatAmount, totalAmount: itemAmount + vatAmount };
};
