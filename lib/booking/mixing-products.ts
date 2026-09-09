import {
  MASTERING_PACKAGE_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../data/pricing';
import { VAT_RATE, type OrderAmounts } from './amounts';

export type MixingServiceType = 'mixing' | 'mastering';

export interface MixingProduct {
  id: string;
  serviceType: MixingServiceType;
  nameKo: string;
  /** 곡당 단가(VAT 별도) — data/pricing.ts SSOT. */
  unitAmount: number;
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
] as const;

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
  const itemAmount = product.unitAmount * songCount + (vocalTuning ? VOCAL_TUNING_ADDON_PRICE * songCount : 0);
  const vatAmount = Math.round(itemAmount * VAT_RATE);
  return { itemAmount, vatAmount, totalAmount: itemAmount + vatAmount };
};
