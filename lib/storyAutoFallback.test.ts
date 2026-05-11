import {
  matchPricingForCategory,
  matchReviewForCategory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';

describe('matchPricingForCategory', () => {
  it('recording → recording-pro', () => {
    expect(matchPricingForCategory('recording')).toBe('recording-pro');
  });

  it('mixing → mixing-level1', () => {
    expect(matchPricingForCategory('mixing')).toBe('mixing-level1');
  });

  it('instrument → recording-hourly', () => {
    expect(matchPricingForCategory('instrument')).toBe('recording-hourly');
  });

  it('vocal/production/lesson은 매칭 없음 — frontmatter로 글 단위 매핑', () => {
    expect(matchPricingForCategory('vocal')).toBeNull();
    expect(matchPricingForCategory('production')).toBeNull();
    expect(matchPricingForCategory('lesson')).toBeNull();
  });

  it('event/feedback/business/region 매칭 없음', () => {
    expect(matchPricingForCategory('event')).toBeNull();
    expect(matchPricingForCategory('feedback')).toBeNull();
    expect(matchPricingForCategory('business')).toBeNull();
    expect(matchPricingForCategory('region')).toBeNull();
  });

  it('알 수 없는 카테고리 null', () => {
    expect(matchPricingForCategory('unknown')).toBeNull();
  });
});

describe('matchReviewForCategory', () => {
  it('mixing → review-3', () => {
    expect(matchReviewForCategory('mixing')).toBe('review-3');
  });

  it('practice → review-4', () => {
    expect(matchReviewForCategory('practice')).toBe('review-4');
  });

  it('production/wedding/vocal/lesson 매칭 없음', () => {
    expect(matchReviewForCategory('production')).toBeNull();
    expect(matchReviewForCategory('vocal')).toBeNull();
    expect(matchReviewForCategory('lesson')).toBeNull();
  });
});

describe('injectAutoFallbackMarker', () => {
  it('마지막 H2 직전에 marker inject', () => {
    const content = '머리\n\n## H2-A\n\n본문\n\n## H2-B\n\n끝';
    const result = injectAutoFallbackMarker(content, '%%price:recording-pro%%');
    expect(result).toBe('머리\n\n## H2-A\n\n본문\n\n\n%%price:recording-pro%%\n\n## H2-B\n\n끝');
  });

  it('H2 없으면 본문 끝에 append', () => {
    const content = '본문 단락만 있음';
    const result = injectAutoFallbackMarker(content, '%%price:recording-pro%%');
    expect(result).toBe('본문 단락만 있음\n\n%%price:recording-pro%%\n');
  });

  it('H2가 1개면 그 직전에 inject', () => {
    const content = '머리\n\n## 마치며\n\n끝';
    const result = injectAutoFallbackMarker(content, '%%booking:문의%%');
    expect(result).toBe('머리\n\n\n%%booking:문의%%\n\n## 마치며\n\n끝');
  });

  it('빈 본문에도 안전', () => {
    const result = injectAutoFallbackMarker('', '%%price:p1%%');
    expect(result).toBe('\n\n%%price:p1%%\n');
  });
});
