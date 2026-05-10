import { parseInlineDirectives, isInlineDirectiveName, decideAutoFallback } from './inlineDirectives';

describe('parseInlineDirectives', () => {
  it('지원 안 되는 type은 plain text로 둠', () => {
    const { authorBoxes } = parseInlineDirectives('본문\n\n%%unknown:foo%%\n\n끝');
    expect(authorBoxes).toBe(0);
  });

  it('price/review/booking/service 4종 인식', () => {
    const content = `머리\n\n%%price:package-wedding%%\n\n중간\n\n%%booking%%\n\n끝`;
    const { authorBoxes } = parseInlineDirectives(content);
    expect(authorBoxes).toBe(2);
  });

  it('booking은 arg 없이도 동작', () => {
    const { authorBoxes } = parseInlineDirectives('a\n\n%%booking%%\n\nb');
    expect(authorBoxes).toBe(1);
  });

  it('booking에 arg 있으면 메시지로 사용', () => {
    const { authorBoxes } = parseInlineDirectives('a\n\n%%booking:축가 문의%%\n\nb');
    expect(authorBoxes).toBe(1);
  });

  it('박스 한도 초과(max 2) 시 초과분은 plain text', () => {
    const content = `1\n\n%%price:p1%%\n\n2\n\n%%review:r1%%\n\n3\n\n%%booking%%\n\n4`;
    // 첫 2개만 인식, 3번째 booking은 plain text로 떨어짐
    const { authorBoxes } = parseInlineDirectives(content);
    expect(authorBoxes).toBe(2);
  });

  it('isInlineDirectiveName: 4종 type 인식', () => {
    expect(isInlineDirectiveName('price')).toBe(true);
    expect(isInlineDirectiveName('review')).toBe(true);
    expect(isInlineDirectiveName('booking')).toBe(true);
    expect(isInlineDirectiveName('service')).toBe(true);
    expect(isInlineDirectiveName('unknown')).toBe(false);
    expect(isInlineDirectiveName('online-fallback')).toBe(false); // 기존 short-code와 분리
  });
});

describe('decideAutoFallback', () => {
  const baseInput = {
    presentTypes: new Set<never>(),
    storyCategoryKey: 'recording',
    wordCount: 1500,
    matchedPriceId: 'recording-pro' as string | null,
    matchedReviewId: 'review-1' as string | null,
    bookingMessage: null as string | null,
    reviewSourcedFromFrontmatter: false,
  };

  it('authorBoxes >= 3이면 null', () => {
    const r = decideAutoFallback({ ...baseInput, authorBoxes: 3 });
    expect(r).toBeNull();
  });

  it('가격 매칭 있고 price 없으면 price 우선', () => {
    const r = decideAutoFallback({ ...baseInput, authorBoxes: 0 });
    expect(r).toEqual({ type: 'price', id: 'recording-pro' });
  });

  it('이미 price directive 있으면 review로 fallback', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 1,
      presentTypes: new Set(['price']),
    });
    expect(r).toEqual({ type: 'review', id: 'review-1' });
  });

  it('wordCount < 1000이면 review fallback 안 함', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 1,
      presentTypes: new Set(['price']),
      wordCount: 800,
    });
    expect(r).toBeNull();
  });

  it('가격·후기 모두 매칭 없으면 null', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 0,
      matchedPriceId: null,
      matchedReviewId: null,
    });
    expect(r).toBeNull();
  });

  it('booking 메시지 명시 시 booking fallback 반환 (price 매칭 없을 때)', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 0,
      matchedPriceId: null,
      matchedReviewId: null,
      bookingMessage: '축가 녹음 문의드립니다',
    });
    expect(r).toEqual({ type: 'booking', message: '축가 녹음 문의드립니다' });
  });

  it('price 매칭 있고 booking도 있으면 price 우선', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 0,
      matchedPriceId: 'recording-pro',
      bookingMessage: '문의',
    });
    expect(r).toEqual({ type: 'price', id: 'recording-pro' });
  });

  it('booking은 wordCount 제한 없이 동작', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 0,
      wordCount: 500,
      matchedPriceId: null,
      matchedReviewId: null,
      bookingMessage: '문의',
    });
    expect(r).toEqual({ type: 'booking', message: '문의' });
  });

  it('presentTypes에 booking 있으면 booking fallback 차단', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 1,
      presentTypes: new Set(['booking']),
      matchedPriceId: null,
      matchedReviewId: null,
      bookingMessage: '문의',
    });
    expect(r).toBeNull();
  });

  it('frontmatter sourced review는 wordCount 게이트 우회', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 0,
      matchedPriceId: null,
      matchedReviewId: 'review-2',
      wordCount: 500,  // 게이트 미달
      reviewSourcedFromFrontmatter: true,  // frontmatter 명시이므로 우회
    });
    expect(r).toEqual({ type: 'review', id: 'review-2' });
  });

  it('categoryKey 매핑 review는 wordCount 게이트 적용', () => {
    const r = decideAutoFallback({
      ...baseInput,
      authorBoxes: 0,
      matchedPriceId: null,
      matchedReviewId: 'review-3',
      wordCount: 500,
      reviewSourcedFromFrontmatter: false,  // categoryKey sourced
    });
    expect(r).toBeNull();
  });
});
