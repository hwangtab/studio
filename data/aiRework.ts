import type { Locale } from '../lib/i18n';
import {
  ARRANGEMENT_BAND_PRICE,
  ARRANGEMENT_SMALL_PRICE,
  COMPOSITION_PRICE,
  SINGLE_BUNDLE_PRICE,
  formatPriceLabel,
} from './pricing';

// 보컬 리워크(녹음·믹싱·마스터링)는 싱글 번들 가격을 그대로 쓴다. 단가 합계(보컬+믹싱+마스터링)로 매기면
// 유통·홍보까지 든 번들보다 녹음만 맡기는 쪽이 비싸져, 대표 '~부터' 가격이 최저가가 아니게 된다.
export const AI_REWORK_VOCAL_ONLY_PRICE = SINGLE_BUNDLE_PRICE;
export const AI_REWORK_ARRANGEMENT_ADD_PRICE = ARRANGEMENT_SMALL_PRICE;
export const AI_REWORK_BAND_ADD_PRICE = ARRANGEMENT_BAND_PRICE;
export const AI_REWORK_COMPOSITION_ADD_PRICE = COMPOSITION_PRICE;
export const AI_REWORK_RELEASE_BUNDLE_PRICE = SINGLE_BUNDLE_PRICE;
export const AI_REWORK_RELEASE_TOTAL_PRICE =
  AI_REWORK_RELEASE_BUNDLE_PRICE + AI_REWORK_ARRANGEMENT_ADD_PRICE;

export interface AiReworkPriceLabels {
  vocalOnly: string;
  arrangementAdd: string;
  bandAdd: string;
  compositionAdd: string;
  releaseBundle: string;
  releaseTotal: string;
}

export const getAiReworkPriceLabels = (locale: Locale): AiReworkPriceLabels => ({
  vocalOnly: formatPriceLabel(AI_REWORK_VOCAL_ONLY_PRICE, locale),
  arrangementAdd: formatPriceLabel(AI_REWORK_ARRANGEMENT_ADD_PRICE, locale),
  bandAdd: formatPriceLabel(AI_REWORK_BAND_ADD_PRICE, locale),
  compositionAdd: formatPriceLabel(AI_REWORK_COMPOSITION_ADD_PRICE, locale),
  releaseBundle: formatPriceLabel(AI_REWORK_RELEASE_BUNDLE_PRICE, locale),
  releaseTotal: formatPriceLabel(AI_REWORK_RELEASE_TOTAL_PRICE, locale),
});
