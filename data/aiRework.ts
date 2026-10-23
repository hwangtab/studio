import type { Locale } from '../lib/i18n';
import {
  ARRANGEMENT_BAND_PRICE,
  ARRANGEMENT_SMALL_PRICE,
  COMPOSITION_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_PACKAGE_PRICE,
  formatPriceLabel,
} from './pricing';

export const AI_REWORK_VOCAL_ONLY_PRICE =
  VOCAL_PACKAGE_PRICE + MIXING_LEVEL1_PRICE + MASTERING_SINGLE_PRICE;
export const AI_REWORK_ARRANGEMENT_ADD_PRICE = ARRANGEMENT_SMALL_PRICE;
export const AI_REWORK_BAND_ADD_PRICE = ARRANGEMENT_BAND_PRICE;
export const AI_REWORK_COMPOSITION_ADD_PRICE = COMPOSITION_PRICE;
export const AI_REWORK_RELEASE_BUNDLE_PRICE = SINGLE_BUNDLE_PRICE;

export interface AiReworkPriceLabels {
  vocalOnly: string;
  arrangementAdd: string;
  bandAdd: string;
  compositionAdd: string;
  releaseBundle: string;
}

export const getAiReworkPriceLabels = (locale: Locale): AiReworkPriceLabels => ({
  vocalOnly: formatPriceLabel(AI_REWORK_VOCAL_ONLY_PRICE, locale),
  arrangementAdd: formatPriceLabel(AI_REWORK_ARRANGEMENT_ADD_PRICE, locale),
  bandAdd: formatPriceLabel(AI_REWORK_BAND_ADD_PRICE, locale),
  compositionAdd: formatPriceLabel(AI_REWORK_COMPOSITION_ADD_PRICE, locale),
  releaseBundle: formatPriceLabel(AI_REWORK_RELEASE_BUNDLE_PRICE, locale),
});
