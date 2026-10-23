import {
  AI_REWORK_VOCAL_ONLY_PRICE,
  AI_REWORK_RELEASE_BUNDLE_PRICE,
  AI_REWORK_REWRITE_ADD_PRICE,
  AI_REWORK_REWRITE_LARGE_ADD_PRICE,
  AI_REWORK_RELEASE_TOTAL_PRICE,
  getAiReworkPriceLabels,
} from './aiRework';

it('composes the published AI rework prices', () => {
  expect(AI_REWORK_VOCAL_ONLY_PRICE).toBe(250000);
  expect(AI_REWORK_RELEASE_BUNDLE_PRICE).toBe(500000);
  expect(AI_REWORK_REWRITE_ADD_PRICE).toBe(500000);
  expect(AI_REWORK_REWRITE_LARGE_ADD_PRICE).toBe(1000000);
  expect(AI_REWORK_RELEASE_TOTAL_PRICE).toBe(1000000);
});

it('localizes labels', () => {
  expect(getAiReworkPriceLabels('ko').vocalOnly).toBe('25만원');
  expect(getAiReworkPriceLabels('en').vocalOnly).toBe('₩250,000');
  expect(getAiReworkPriceLabels('ko').releaseBundle).toBe('50만원');
  expect(getAiReworkPriceLabels('ko').reworkLargeAdd).toBe('100만원');
  expect(getAiReworkPriceLabels('ko').releaseTotal).toBe('100만원');
});
