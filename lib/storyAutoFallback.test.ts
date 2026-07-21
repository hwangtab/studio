import {
  matchPricingForCategory,
  matchReviewForCategory,
  matchServiceForCategory,
  matchPricingForStory,
  matchServiceForStory,
  isPracticeRoomRegionStory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';

describe('matchPricingForCategory', () => {
  it('recording → recording-pro', () => {
    expect(matchPricingForCategory('recording')).toBe('recording-pro');
  });

  it('mixing → mixing-level1', () => {
    expect(matchPricingForCategory('mixing')).toBe('mixing-level1');
  });

  it('instrument → null (service fallback으로 이전)', () => {
    expect(matchPricingForCategory('instrument')).toBeNull();
  });

  // 2026-05-31 확장: 의뢰 의도 카테고리에 가격 카드 자동 연결.
  it('region/vocal/production → recording-pro (의뢰 의도 매핑)', () => {
    expect(matchPricingForCategory('region')).toBe('recording-pro');
    expect(matchPricingForCategory('vocal')).toBe('recording-pro');
    expect(matchPricingForCategory('production')).toBe('recording-pro');
  });

  it('business → mixing-level1 (발매·유통 의도)', () => {
    expect(matchPricingForCategory('business')).toBe('mixing-level1');
  });

  it('lesson은 매칭 없음 — frontmatter inlineFallback로 글 단위 매핑', () => {
    expect(matchPricingForCategory('lesson')).toBeNull();
  });

  it('event/feedback 매칭 없음', () => {
    expect(matchPricingForCategory('event')).toBeNull();
    expect(matchPricingForCategory('feedback')).toBeNull();
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

describe('matchServiceForCategory', () => {
  it('instrument → practice', () => {
    expect(matchServiceForCategory('instrument')).toBe('practice');
  });

  it('recording/mixing/vocal/lesson 매칭 없음', () => {
    expect(matchServiceForCategory('recording')).toBeNull();
    expect(matchServiceForCategory('mixing')).toBeNull();
    expect(matchServiceForCategory('vocal')).toBeNull();
    expect(matchServiceForCategory('lesson')).toBeNull();
  });

  it('알 수 없는 카테고리 null', () => {
    expect(matchServiceForCategory('unknown')).toBeNull();
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

// 실상권 연습실 지역 LP는 "연신내 연습실 월세" 같은 순수 구매 의도로 진입한다.
// 그런데 PRICING_BY_CATEGORY.region = 'recording-pro'이고 decideAutoFallback이 price를
// service보다 먼저 반환하므로, 이 페이지들의 본문에는 시간당 10만원 보컬녹음 가격표가
// 꽂히고 연습실 브릿지는 구조적으로 못 받는다. 슬러그로 분기해 교정한다.
describe('지역 스토리 오퍼 분기', () => {
  describe('isPracticeRoomRegionStory', () => {
    it('region + practice-room- 접두사 → true', () => {
      expect(isPracticeRoomRegionStory('region', 'practice-room-yeonsinnae1')).toBe(true);
      expect(isPracticeRoomRegionStory('region', 'practice-room-deogyang1')).toBe(true);
      expect(isPracticeRoomRegionStory('region', 'practice-room-mangwon1')).toBe(true);
    });

    it('광역 허브는 false — 부산 검색자에게 서울 연습실은 무의미하다', () => {
      expect(isPracticeRoomRegionStory('region', 'seoul1')).toBe(false);
      expect(isPracticeRoomRegionStory('region', 'busan1')).toBe(false);
    });

    it('찾아오는 길 가이드는 false — 녹음하러 오는 사람이다', () => {
      expect(isPracticeRoomRegionStory('region', 'ktx-gyeongbu-guide1')).toBe(false);
      expect(isPracticeRoomRegionStory('region', 'seoul-metro-guide1')).toBe(false);
      expect(isPracticeRoomRegionStory('region', 'dongjak1')).toBe(false);
    });

    it('region이 아닌 카테고리는 접두사가 같아도 false', () => {
      expect(isPracticeRoomRegionStory('instrument', 'practice-room-bass-funk1')).toBe(false);
    });
  });

  describe('matchPricingForStory', () => {
    it('실상권 연습실 LP는 가격표를 받지 않는다 (service 자리를 비워준다)', () => {
      expect(matchPricingForStory('region', 'practice-room-yeonsinnae1')).toBeNull();
    });

    it('광역 허브·교통 가이드는 기존대로 recording-pro', () => {
      expect(matchPricingForStory('region', 'seoul1')).toBe('recording-pro');
      expect(matchPricingForStory('region', 'ktx-honam-guide1')).toBe('recording-pro');
    });

    it('다른 카테고리는 카테고리 맵 그대로', () => {
      expect(matchPricingForStory('mixing', 'mixing1')).toBe('mixing-level1');
      expect(matchPricingForStory('instrument', 'practice-room-bass-funk1')).toBeNull();
    });
  });

  describe('matchServiceForStory', () => {
    it('실상권 연습실 LP → practice 브릿지', () => {
      expect(matchServiceForStory('region', 'practice-room-samsong1')).toBe('practice');
    });

    it('광역 허브·교통 가이드는 service 매칭 없음', () => {
      expect(matchServiceForStory('region', 'seoul1')).toBeNull();
      expect(matchServiceForStory('region', 'ktx-gyeongbu-guide1')).toBeNull();
    });

    it('instrument 카테고리는 기존대로 practice', () => {
      expect(matchServiceForStory('instrument', 'practice-room-bass-funk1')).toBe('practice');
    });
  });
});
