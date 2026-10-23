import type { Locale } from '../lib/i18n';
import {
  ARRANGEMENT_BAND_PRICE,
  ARRANGEMENT_SMALL_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_PACKAGE_PRICE,
  formatPriceLabel,
} from './pricing';

// AI 데모 리워크 가격 체계(운영자 결정 2026-10-23):
//   - 보컬만 다시 녹음 = 보컬 녹음 패키지(녹음 파일 납품, 믹싱·마스터링 없음).
//   - 믹싱·마스터링·유통 등록·발매 홍보까지 = 싱글 번들.
//   - 재편곡과 재작곡은 하나로 묶는다(재편곡하면서 멜로디도 다시 쓴다). 10트랙 이하는 소편성 편곡가,
//     11트랙 이상(풀밴드·대편성)은 풀밴드 편곡가를 더한다 — 단독 대편성 편곡가(31트랙 이상)는 쓰지 않는다.
export const AI_REWORK_VOCAL_ONLY_PRICE = VOCAL_PACKAGE_PRICE;
export const AI_REWORK_RELEASE_BUNDLE_PRICE = SINGLE_BUNDLE_PRICE;
export const AI_REWORK_REWRITE_ADD_PRICE = ARRANGEMENT_SMALL_PRICE;
export const AI_REWORK_REWRITE_LARGE_ADD_PRICE = ARRANGEMENT_BAND_PRICE;
export const AI_REWORK_RELEASE_TOTAL_PRICE =
  AI_REWORK_RELEASE_BUNDLE_PRICE + AI_REWORK_REWRITE_ADD_PRICE;

export interface AiReworkPriceLabels {
  vocalOnly: string;
  releaseBundle: string;
  reworkAdd: string;
  reworkLargeAdd: string;
  releaseTotal: string;
}

export const getAiReworkPriceLabels = (locale: Locale): AiReworkPriceLabels => ({
  vocalOnly: formatPriceLabel(AI_REWORK_VOCAL_ONLY_PRICE, locale),
  releaseBundle: formatPriceLabel(AI_REWORK_RELEASE_BUNDLE_PRICE, locale),
  reworkAdd: formatPriceLabel(AI_REWORK_REWRITE_ADD_PRICE, locale),
  reworkLargeAdd: formatPriceLabel(AI_REWORK_REWRITE_LARGE_ADD_PRICE, locale),
  releaseTotal: formatPriceLabel(AI_REWORK_RELEASE_TOTAL_PRICE, locale),
});
