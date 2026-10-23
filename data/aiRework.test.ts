import {
  AI_REWORK_VOCAL_ONLY_PRICE,
  AI_REWORK_ARRANGEMENT_ADD_PRICE,
  AI_REWORK_BAND_ADD_PRICE,
  AI_REWORK_COMPOSITION_ADD_PRICE,
  AI_REWORK_RELEASE_BUNDLE_PRICE,
  AI_REWORK_RELEASE_TOTAL_PRICE,
  getAiReworkPriceLabels,
} from './aiRework';

it('composes the published AI rework prices', () => {
  expect(AI_REWORK_VOCAL_ONLY_PRICE).toBe(500000);
  expect(AI_REWORK_ARRANGEMENT_ADD_PRICE).toBe(500000);
  expect(AI_REWORK_BAND_ADD_PRICE).toBe(1000000);
  expect(AI_REWORK_COMPOSITION_ADD_PRICE).toBe(500000);
  expect(AI_REWORK_RELEASE_BUNDLE_PRICE).toBe(500000);
  expect(AI_REWORK_RELEASE_TOTAL_PRICE).toBe(1000000);
});

it('localizes labels', () => {
  expect(getAiReworkPriceLabels('ko').vocalOnly).toBe('50만원');
  expect(getAiReworkPriceLabels('en').vocalOnly).toBe('₩500,000');
  expect(getAiReworkPriceLabels('ko').releaseTotal).toBe('100만원');
});
