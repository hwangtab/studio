# Inline Service Integration — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 인프라 위에 자동 fallback wiring·StickyBottomCTA·추가 글 directive를 얹고, vocal/production/lesson 카테고리 약 234편에 글 단위 frontmatter `inlineFallback`을 서브에이전트 batch로 정확 매칭한다.

**Architecture:** frontmatter `inlineFallback` > categoryKey 단순 매핑 우선순위로 `getStoryDetail`이 자동 fallback marker를 본문 마지막 H2 직전에 inject. `StickyBottomCTA`는 article 시작 직전 invisible marker를 IntersectionObserver로 추적해 viewport 위로 올라가면 노출. ScrollProgress 회귀(PSI Forced reflow 9079ms) 패턴을 회피하기 위해 scrollY 직접 조회를 쓰지 않는다.

**Tech Stack:** Next.js 14.2 (Pages Router) · TypeScript · jest+jsdom · IntersectionObserver · markdown-to-jsx (Phase 1 인프라)

**Spec:** `docs/superpowers/specs/2026-05-09-inline-service-integration-phase-2-design.md`

---

## Task 1: types/story.ts에 `StoryInlineFallback` 타입 추가

**Files:**
- Modify: `types/story.ts`

frontmatter `inlineFallback` 필드 타입 정의. price/review/booking 모두 optional, 셋 다 없으면 필드 자체 생략.

- [ ] **Step 1: 현재 types/story.ts 확인**

Run: `head -60 types/story.ts`
Expected: `StoryFrontmatter` interface와 `StoryHowTo`, `StoryFAQItem` 같은 기존 타입 보유

- [ ] **Step 2: StoryInlineFallback interface 추가**

Modify: `types/story.ts` 파일에서 `StoryHowTo` interface 정의 직후에 추가:

```ts
/**
 * Frontmatter `inlineFallback` 필드 — 글 단위 자동 fallback 매칭 명시.
 * Phase 2 storyAutoFallback이 categoryKey 단순 매핑보다 우선 적용.
 * 셋 다 없으면 필드 자체 생략. 빈 object `{}`는 자동 fallback 완전 비활성 의미.
 */
export interface StoryInlineFallback {
  /** pricing.ts id 또는 hub pricingFallback id (예: 'package-wedding', 'lesson-monthly') */
  price?: string;
  /** reviews.ts id (예: 'review-1') */
  review?: string;
  /** booking 카카오톡 inline 박스 안내 메시지 (없으면 default 카피) */
  booking?: string;
}
```

- [ ] **Step 3: StoryFrontmatter에 필드 추가**

Modify: `types/story.ts`의 `StoryFrontmatter` interface 끝에 추가:

```ts
export interface StoryFrontmatter {
  // ... 기존 필드들 (title, date, author, ...)
  inlineFallback?: StoryInlineFallback;
}
```

- [ ] **Step 4: type-check 통과 확인**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add types/story.ts
git commit -m "feat(types): StoryInlineFallback — 글 단위 자동 fallback 매칭 frontmatter 필드"
```

---

## Task 2: `lib/inlineDirectives.ts` `decideAutoFallback`에 booking type 확장 (TDD)

**Files:**
- Modify: `lib/inlineDirectives.ts`
- Modify: `lib/inlineDirectives.test.ts`

Phase 1 함수는 `{ type: 'price'|'review', id }` union만 반환. Phase 2는 booking도 자동 fallback 가능 (frontmatter `inlineFallback.booking` 명시 시).

- [ ] **Step 1: 신규 테스트 추가**

Modify: `lib/inlineDirectives.test.ts`의 `describe('decideAutoFallback', ...)` 블록 끝에 다음 테스트 추가:

```ts
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
    wordCount: 500,  // review wordCount 미달
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
```

`baseInput`에 `bookingMessage: null` 추가 (Phase 1 base에 없는 필드):

기존 baseInput:
```ts
const baseInput = {
  presentTypes: new Set<never>(),
  storyCategoryKey: 'recording',
  wordCount: 1500,
  matchedPriceId: 'recording-pro' as string | null,
  matchedReviewId: 'review-1' as string | null,
};
```

새 baseInput (한 줄 추가):
```ts
const baseInput = {
  presentTypes: new Set<never>(),
  storyCategoryKey: 'recording',
  wordCount: 1500,
  matchedPriceId: 'recording-pro' as string | null,
  matchedReviewId: 'review-1' as string | null,
  bookingMessage: null as string | null,
};
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- lib/inlineDirectives.test.ts`
Expected: 신규 4 테스트 FAIL — booking type을 union에 없어 unknown property 또는 null 반환

- [ ] **Step 3: 함수 시그니처 + 로직 확장**

Modify: `lib/inlineDirectives.ts`의 `AutoFallbackInput` interface와 `AutoFallbackDecision` type을 다음으로 교체:

```ts
export interface AutoFallbackInput {
  authorBoxes: number;
  presentTypes: Set<InlineDirectiveName>;
  storyCategoryKey: string;
  wordCount: number;
  matchedPriceId: string | null;
  matchedReviewId: string | null;
  /** frontmatter inlineFallback.booking 명시 메시지 — null이면 booking fallback 비활성 */
  bookingMessage: string | null;
}

export type AutoFallbackDecision =
  | { type: 'price'; id: string }
  | { type: 'review'; id: string }
  | { type: 'booking'; message: string };
```

`decideAutoFallback` 함수 본체를 다음으로 교체:

```ts
/**
 * 작가가 명시 안 한 글에 자동 fallback 박스 1개를 inject할지 결정.
 *
 * 우선순위:
 *   1. authorBoxes >= MAX_TOTAL_BOXES → null
 *   2. price 매칭 있고 presentTypes에 price 없음 → price
 *   3. booking 메시지 있고 presentTypes에 booking 없음 → booking
 *   4. review 매칭 있고 wordCount >= REVIEW_FALLBACK_MIN_WORDCOUNT + presentTypes에 review 없음 → review
 *   5. 모두 안 되면 null
 *
 * booking은 wordCount 제한 없음 — frontmatter 명시이므로 작가 의도 신뢰.
 */
export const decideAutoFallback = (input: AutoFallbackInput): AutoFallbackDecision | null => {
  if (input.authorBoxes >= MAX_TOTAL_BOXES) return null;

  if (input.matchedPriceId && !input.presentTypes.has('price')) {
    return { type: 'price', id: input.matchedPriceId };
  }

  if (input.bookingMessage && !input.presentTypes.has('booking')) {
    return { type: 'booking', message: input.bookingMessage };
  }

  if (
    input.matchedReviewId
    && input.wordCount >= REVIEW_FALLBACK_MIN_WORDCOUNT
    && !input.presentTypes.has('review')
  ) {
    return { type: 'review', id: input.matchedReviewId };
  }

  return null;
};
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `npm test -- lib/inlineDirectives.test.ts`
Expected: 모든 테스트 통과 (기존 11 + 신규 4 = 15)

- [ ] **Step 5: Commit**

```bash
git add lib/inlineDirectives.ts lib/inlineDirectives.test.ts
git commit -m "feat(inline): decideAutoFallback에 booking type 확장 — frontmatter inlineFallback.booking 명시 지원"
```

---

## Task 3: `lib/storyAutoFallback.ts` 매핑·inject 로직 (TDD)

**Files:**
- Create: `lib/storyAutoFallback.ts`
- Test: `lib/storyAutoFallback.test.ts`

categoryKey 단순 매핑(recording/mixing/instrument만) + 본문 마지막 H2 직전에 marker inject.

- [ ] **Step 1: 테스트 작성**

Create: `lib/storyAutoFallback.test.ts`

```ts
import {
  matchPricingForCategory,
  matchReviewForCategory,
  injectAutoFallbackMarker,
  PRICING_BY_CATEGORY,
  REVIEW_BY_CATEGORY,
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
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- lib/storyAutoFallback.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

Create: `lib/storyAutoFallback.ts`

```ts
/**
 * Phase 2 자동 fallback 매핑·inject 로직.
 *
 * categoryKey 단순 매핑은 의미가 명확한 카테고리(recording/mixing/instrument)만 유지.
 * vocal/production/lesson은 글 단위 frontmatter `inlineFallback`로 정밀 매칭한다.
 */

export const PRICING_BY_CATEGORY: Readonly<Record<string, string>> = {
  recording: 'recording-pro',
  mixing: 'mixing-level1',
  instrument: 'recording-hourly',
  // vocal/production/lesson 제거 — frontmatter inlineFallback 사용
  // event/feedback/business/region → 매칭 없음
};

export const REVIEW_BY_CATEGORY: Readonly<Record<string, string>> = {
  mixing: 'review-3',
  practice: 'review-4',
  // production/wedding 매핑 제거 — frontmatter로 글 단위 매핑
};

export const matchPricingForCategory = (categoryKey: string): string | null =>
  PRICING_BY_CATEGORY[categoryKey] ?? null;

export const matchReviewForCategory = (categoryKey: string): string | null =>
  REVIEW_BY_CATEGORY[categoryKey] ?? null;

/**
 * 본문 마지막 H2 직전에 short-code marker inject.
 * 매칭 H2 없으면 본문 끝에 append.
 *
 *   "본문\n\n## 마지막H2\n끝" + "%%price:p1%%"
 *   → "본문\n\n\n%%price:p1%%\n\n## 마지막H2\n끝"
 */
export const injectAutoFallbackMarker = (content: string, marker: string): string => {
  const lines = content.split('\n');
  // 뒤에서부터 첫 H2(`## `) 찾기
  let lastH2 = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^## /.test(lines[i])) {
      lastH2 = i;
      break;
    }
  }
  if (lastH2 === -1) {
    // H2 없음 — 본문 끝에 append (앞뒤 빈 줄로 분리)
    return `${content}\n\n${marker}\n`;
  }
  return [
    ...lines.slice(0, lastH2),
    '',  // marker 앞 빈 줄
    marker,
    '',  // marker 뒤 빈 줄
    ...lines.slice(lastH2),
  ].join('\n');
};
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `npm test -- lib/storyAutoFallback.test.ts`
Expected: 모든 테스트 통과 (15 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/storyAutoFallback.ts lib/storyAutoFallback.test.ts
git commit -m "feat(inline): storyAutoFallback — categoryKey 매핑(3종) + 본문 inject 헬퍼"
```

---

## Task 4: `lib/stories.ts` `getStoryDetail` wiring

**Files:**
- Modify: `lib/stories.ts`

frontmatter `inlineFallback` 우선, categoryKey 단순 매핑 fallback. wordCount 계산은 [id].tsx에서 lib로 옮기지 않고 inline으로 작성 (mvp 비용 절감).

- [ ] **Step 1: import 추가**

Modify: `lib/stories.ts` 파일 상단 import 영역 (다른 import들 옆에) 추가:

```ts
import { parseInlineDirectives, decideAutoFallback } from './inlineDirectives';
import {
  matchPricingForCategory,
  matchReviewForCategory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';
import { stripMarkdown } from '../utils/textUtils';
```

(`stripMarkdown`이 이미 다른 곳에서 import 되었는지 grep 확인)

- [ ] **Step 2: getStoryDetail에 wiring 추가**

Modify: `lib/stories.ts`의 `getStoryDetail` 함수에서 `contentToProcess` 변수 정의 직후 (`const isThinContent = ...` 직전)에 다음 블록 삽입:

```ts
// Phase 2 자동 fallback wiring — frontmatter inlineFallback > categoryKey 매핑 우선순위
// ko 외 locale의 fallback 페이지는 자동 fallback 비활성 (Phase 1 정책 일관)
let finalContent = contentToProcess;
if (sourceLocale === requestedLocale && requestedLocale === defaultLocale) {
  const parsed = parseInlineDirectives(contentToProcess);

  const frontmatterFallback = data?.inlineFallback as
    | { price?: string; review?: string; booking?: string }
    | undefined;

  const matchedPriceId = frontmatterFallback?.price
    ?? matchPricingForCategory(baseStory.categoryKey);
  const matchedReviewId = frontmatterFallback?.review
    ?? matchReviewForCategory(baseStory.categoryKey);
  const bookingMessage = frontmatterFallback?.booking ?? null;

  // wordCount 계산 — 한국어/일본어/태국어는 글자 수, 영문은 단어 수 (Phase 1 [id].tsx 로직과 동일)
  const plain = stripMarkdown(contentToProcess);
  const wordCount = (requestedLocale === 'ko' || requestedLocale === 'zh' || requestedLocale === 'th')
    ? plain.replace(/\s+/g, '').length
    : plain.split(/\s+/).filter(Boolean).length;

  const fallback = decideAutoFallback({
    authorBoxes: parsed.authorBoxes,
    presentTypes: parsed.presentTypes,
    storyCategoryKey: baseStory.categoryKey,
    wordCount,
    matchedPriceId,
    matchedReviewId,
    bookingMessage,
  });

  if (fallback) {
    let marker: string;
    switch (fallback.type) {
      case 'price':
      case 'review':
        marker = `%%${fallback.type}:${fallback.id}%%`;
        break;
      case 'booking':
        marker = `%%booking:${fallback.message}%%`;
        break;
    }
    finalContent = injectAutoFallbackMarker(contentToProcess, marker);
  }
}
```

기존 `const isThinContent = computeThinContentStatus(contentToProcess, slug).isThinContent;` 라인을 변경:
```ts
const isThinContent = computeThinContentStatus(finalContent, slug).isThinContent;
```

기존 `content: contentToProcess,`를 변경:
```ts
content: finalContent,
```

- [ ] **Step 3: type-check + jest**

Run: `npm run type-check && npm test`
Expected: 0 errors, 모든 테스트 통과

- [ ] **Step 4: 빌드 검증 — 자동 fallback 발현 확인**

Run: `npx next build 2>&1 | tail -10`
Expected: 빌드 성공

다음 글에서 자동 fallback이 발현되는지 직접 확인 (recording 카테고리 글 sample):
```bash
grep -oE 'data-inline-callout="(price|review|booking|service)"' .next/server/pages/ko/stories/guide1.html | sort -u
```
Expected: `data-inline-callout="price"` (recording-pro 자동 매칭)

vocal 카테고리 글(harmony-singing1 등 frontmatter inlineFallback 없는 글):
```bash
grep -oE 'data-inline-callout="(price|review|booking|service)"' .next/server/pages/ko/stories/harmony-singing1.html | sort -u
```
Expected: 빈 출력 (vocal categoryKey 매핑 없으므로 자동 fallback 안 들어감)

- [ ] **Step 5: Commit**

```bash
git add lib/stories.ts
git commit -m "feat(inline): getStoryDetail에 자동 fallback wiring — frontmatter inlineFallback > categoryKey 매핑 우선순위"
```

---

## Task 5: `InlinePriceCallout`에 hub `pricingFallback` lookup 추가

**Files:**
- Modify: `components/inline/InlinePriceCallout.tsx`

lesson categoryKey 글에 `inlineFallback.price = 'lesson-monthly'` 명시 시 InlinePriceCallout이 hub의 pricingFallback 카드(buyerIntentHubs.ts의 vocal-beginners-guide.pricingFallback)도 lookup하도록 보강.

- [ ] **Step 1: import 추가 + lookup 확장**

Modify: `components/inline/InlinePriceCallout.tsx`의 상단 import 영역에 추가:

```ts
import { buyerIntentHubs } from '../../data/buyerIntentHubs';
```

기존 `pkg = useMemo(...)` 블록을 다음으로 교체 (5개 pricing pool 검색 후 hub fallback도 검색):

```tsx
const pkg = React.useMemo(() => {
  // 1. pricing.ts pools에서 lookup
  const pools = [
    pricingData.specialPackages,
    pricingData.recordingOffers,
    pricingData.mixingOffers,
    pricingData.masteringOffers,
    pricingData.additionalServices,
  ];
  for (const pool of pools) {
    const found = pool.find((p) => p.id === id);
    if (found) return found;
  }

  // 2. hub pricingFallback에서 lookup (lesson-monthly 같은 hub 전용 id)
  const hubFallback = Object.values(buyerIntentHubs)
    .map((h) => h.pricingFallback)
    .find((f): f is NonNullable<typeof f> => Boolean(f) && f!.id === id);
  if (hubFallback) {
    // hub fallback 카드를 pricing pool 항목과 동일한 shape으로 변환
    return {
      id: hubFallback.id,
      title: hubFallback.title,
      priceDisplay: hubFallback.priceDisplay,
      priceValue: 0,  // hub fallback은 priceValue 없음
      unit: hubFallback.unit ?? '',
      description: hubFallback.description,
      features: [...hubFallback.features],
      ...(hubFallback.recommended && { recommended: hubFallback.recommended }),
    };
  }

  return null;
}, [pricingData, id]);
```

- [ ] **Step 2: type-check 통과**

Run: `npm run type-check`
Expected: 0 errors

`'unit' in pkg` narrowing이 hub fallback에서도 동작하는지 확인 — pkg의 unit이 항상 string 또는 undefined이므로 narrowing 안전.

- [ ] **Step 3: 빌드 검증**

Run: `npx next build 2>&1 | tail -5`
Expected: 빌드 성공

- [ ] **Step 4: Commit**

```bash
git add components/inline/InlinePriceCallout.tsx
git commit -m "feat(inline): InlinePriceCallout에 hub pricingFallback lookup 추가 — lesson-monthly 같은 hub 전용 id 처리"
```

---

## Task 6: `StickyBottomCTA` 컴포넌트 (TDD)

**Files:**
- Create: `components/inline/StickyBottomCTA.tsx`
- Test: `components/inline/StickyBottomCTA.test.tsx`

IntersectionObserver로 marker 추적. dismiss 시 localStorage `sticky-cta-dismissed-until` = now + 24h.

- [ ] **Step 1: 테스트 작성**

Create: `components/inline/StickyBottomCTA.test.tsx`

```tsx
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import StickyBottomCTA from './StickyBottomCTA';
import '@testing-library/jest-dom';

// IntersectionObserver mock
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[] = [];
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
  }
  observe(target: Element) { this.observed.push(target); }
  unobserve() {}
  disconnect() {}
  trigger(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

let mockObserverInstance: MockIntersectionObserver | null = null;
beforeAll(() => {
  // @ts-expect-error IntersectionObserver 전역 mock
  global.IntersectionObserver = function(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
    mockObserverInstance = new MockIntersectionObserver(cb, opts);
    return mockObserverInstance;
  };
});

beforeEach(() => {
  localStorage.clear();
  mockObserverInstance = null;
});

const TestHarness = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={ref} data-testid="marker" />
      <StickyBottomCTA markerRef={ref} locale="ko" />
    </>
  );
};

describe('StickyBottomCTA', () => {
  it('marker가 viewport 안에 있으면 hidden', () => {
    render(<TestHarness />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('marker가 viewport 위로 올라가면 visible', () => {
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('marker가 viewport 아래에 있으면 hidden (사용자 아직 진입 전)', () => {
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: 1000 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('dismiss 클릭 시 hidden + localStorage 기록', () => {
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    const dismissButton = screen.getByRole('button', { name: /닫기/ });
    fireEvent.click(dismissButton);
    expect(screen.queryByRole('region')).toBeNull();
    const stored = localStorage.getItem('sticky-cta-dismissed-until');
    expect(stored).not.toBeNull();
    expect(parseInt(stored!, 10)).toBeGreaterThan(Date.now());
  });

  it('localStorage TTL 만료 안 되었으면 mount 시 hidden 유지', () => {
    localStorage.setItem('sticky-cta-dismissed-until', String(Date.now() + 60_000));
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('localStorage TTL 만료된 경우 정상 노출', () => {
    localStorage.setItem('sticky-cta-dismissed-until', String(Date.now() - 60_000));
    render(<TestHarness />);
    act(() => {
      mockObserverInstance!.trigger([{
        isIntersecting: false,
        boundingClientRect: { top: -100 } as DOMRectReadOnly,
      }]);
    });
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- components/inline/StickyBottomCTA.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

Create: `components/inline/StickyBottomCTA.tsx`

```tsx
import React from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';

interface StickyBottomCTAProps {
  /** article 시작 직전 invisible marker ref */
  markerRef: React.RefObject<HTMLElement>;
  locale: Locale;
}

const DISMISS_KEY = 'sticky-cta-dismissed-until';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;  // 24시간

const isDismissedNow = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
};

/**
 * 본문 첫 H2 부근(article 시작 직전) marker를 IntersectionObserver로 추적해
 * marker가 viewport 위로 올라가면 sticky 노출. dismiss 24h TTL.
 *
 * scrollY 직접 조회를 쓰지 않아 ScrollProgress의 PSI Forced reflow 회귀 패턴을 회피.
 */
const StickyBottomCTA = ({ markerRef, locale }: StickyBottomCTAProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const [visible, setVisible] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  // 페이지 mount 시 localStorage TTL 체크
  React.useEffect(() => {
    setDismissed(isDismissedNow());
  }, []);

  React.useEffect(() => {
    if (dismissed) return;
    const target = markerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // marker가 viewport 위로 올라감 (사용자 본문 진입 후)
        const movedAbove = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setVisible(movedAbove);
      },
      { rootMargin: '0px', threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [markerRef, dismissed]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
    } catch {
      // localStorage 차단 환경 (시크릿 모드 등) — silent ignore
    }
    setDismissed(true);
  };

  if (dismissed || !visible) return null;

  return (
    <div
      role="region"
      aria-label={t('stories.sticky.label', { defaultValue: '고정 문의 바' })}
      className="fixed inset-x-4 bottom-4 sm:bottom-8 z-50 max-w-2xl sm:mx-auto rounded-xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50/95 dark:bg-amber-500/15 backdrop-blur-md shadow-xl p-4 flex items-center gap-3"
    >
      <div className="flex-shrink-0 inline-flex items-center justify-center p-2 rounded-full bg-amber-300/40 dark:bg-amber-500/30" aria-hidden="true">
        <MessageCircle className="text-amber-700 dark:text-amber-300" size={18} />
      </div>
      <p className="flex-1 typo-card-body text-sm text-gray-800 dark:text-gray-200 truncate">
        {t('stories.sticky.headline', { defaultValue: '예약·문의는 카카오톡으로' })}
      </p>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline-flex items-center gap-1 px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 text-sm font-bold min-h-[44px] touch-manipulation"
      >
        {t('stories.sticky.kakao', { defaultValue: '카카오톡' })}
        <ArrowRight size={14} aria-hidden="true" />
      </a>
      <Link
        href={`/${locale}/pricing`}
        prefetch={false}
        className="hidden sm:inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline min-h-[44px] touch-manipulation"
      >
        {t('nav.pricing')}
      </Link>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="sm:hidden inline-flex items-center justify-center w-11 h-11 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 touch-manipulation"
        aria-label={t('stories.sticky.kakao', { defaultValue: '카카오톡' })}
      >
        <MessageCircle size={20} aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-amber-200 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 touch-manipulation"
        aria-label={t('stories.sticky.dismiss', { defaultValue: '닫기' })}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default React.memo(StickyBottomCTA);
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `npm test -- components/inline/StickyBottomCTA.test.tsx`
Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/inline/StickyBottomCTA.tsx components/inline/StickyBottomCTA.test.tsx
git commit -m "feat(inline): StickyBottomCTA — IntersectionObserver 기반 sticky bar (PSI Forced reflow 회귀 회피)"
```

---

## Task 7: stories/[id].tsx에 marker + StickyBottomCTA 마운트

**Files:**
- Modify: `pages/[locale]/stories/[id].tsx`

article 시작 직전 invisible marker `<div>` + article 끝 직후 StickyBottomCTA. dynamic import로 초기 번들 분리.

- [ ] **Step 1: dynamic import 추가**

Modify: `pages/[locale]/stories/[id].tsx` 상단 dynamic import 영역 (`StoryCTA`, `RelatedPortfolioInline` 옆에) 추가:

```ts
const StickyBottomCTA = dynamic(() => import('../../../components/inline/StickyBottomCTA'), { ssr: false });
```

`{ ssr: false }` — sticky CTA는 client-side only (IntersectionObserver). SSR에서는 마운트되지 않아 LCP 영향 0.

- [ ] **Step 2: 컴포넌트 본체에 markerRef + JSX 추가**

Modify: `StoryDetailPage` 컴포넌트 본체에 `useRef` 추가 (다른 hooks 옆에):

```tsx
const stickyMarkerRef = React.useRef<HTMLDivElement>(null);
```

JSX의 `<article>` 직전에 invisible marker, article 끝 직후 StickyCTA 추가:

기존:
```tsx
<article itemScope itemType="https://schema.org/BlogPosting">
  <meta itemProp="headline" content={story.title} />
  ...
</article>
```

변경:
```tsx
<div
  ref={stickyMarkerRef}
  aria-hidden="true"
  data-sticky-trigger
  className="h-px"
/>
<article itemScope itemType="https://schema.org/BlogPosting">
  <meta itemProp="headline" content={story.title} />
  ...
</article>
{/* Phase 2 — IntersectionObserver 기반 sticky bar. ssr: false라 서버 렌더 안 됨 */}
<StickyBottomCTA markerRef={stickyMarkerRef} locale={locale} />
```

`h-px`는 1px height invisible marker (display:none이면 IntersectionObserver가 보지 못해 trigger 안 됨).

- [ ] **Step 3: type-check + jest 통과**

Run: `npm run type-check && npm test -- components/inline/StickyBottomCTA.test.tsx`
Expected: 0 errors, 모든 테스트 통과

- [ ] **Step 4: 빌드 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 빌드 성공

- [ ] **Step 5: Commit**

```bash
git add pages/[locale]/stories/[id].tsx
git commit -m "feat(inline): stories/[id]에 stickyMarkerRef + StickyBottomCTA 마운트"
```

---

## Task 8: 시범 글 3편에 directive 적용

**Files:**
- Modify: `content/stories/mixing-complete-guide.md`
- Modify: `content/stories/vocal-recording-guide1.md`
- Modify: `content/stories/band-recording-guide1.md`

각 글에 price + booking 두 short-code. 위치는 가격·비용 섹션 끝.

- [ ] **Step 1: mixing-complete-guide.md 수정**

Modify: `content/stories/mixing-complete-guide.md`의 적합한 위치 — "## 4단계: 보컬·마스터링 (19~23부)" 직전 (또는 마지막 H2 직전 적절한 위치)에 short-code 추가.

다음 두 라인을 자연스러운 단락 끝 + 빈 줄로 분리해 추가:

```markdown
%%price:mixing-level1%%
```

마지막 H2 ("마치며" 같은 wrap-up) 직전에:

```markdown
%%booking:믹싱·마스터링 견적 문의%%
```

(본 plan 작성 시점 mixing-complete-guide의 정확한 H2 구조: "1단계 ~ 4단계", "입문자가 흔히 막히는 5가지 지점", "믹싱 학습에 도움되는 외부 리소스", "더 빠른 학습을 원한다면 — 1:1 음악 레슨", "마치며". 작가 의도에 가장 맞는 위치는 "더 빠른 학습을 원한다면" 직전 + 마지막 "마치며" 직전.)

- [ ] **Step 2: vocal-recording-guide1.md 수정**

Modify: `content/stories/vocal-recording-guide1.md`의 "## 비용 현실" 또는 "## 셀프 녹음 vs 엔지니어 세션" 섹션 끝에 추가:

```markdown
%%price:recording-pro%%
```

마지막 H2 직전:

```markdown
%%booking:보컬 녹음 예약 문의%%
```

- [ ] **Step 3: band-recording-guide1.md 수정**

Modify: `content/stories/band-recording-guide1.md`의 "## 비용과 시간 현실" 섹션 끝에 추가:

```markdown
%%price:recording-daylock%%
```

마지막 H2 직전:

```markdown
%%booking:밴드 녹음 일정 문의%%
```

- [ ] **Step 4: 빌드 검증**

Run: `npx next build 2>&1 | tail -5`
Expected: 빌드 성공

각 글의 callout 발현 확인:
```bash
for slug in mixing-complete-guide vocal-recording-guide1 band-recording-guide1; do
  echo "=== $slug ==="
  grep -oE 'data-inline-callout="(price|review|booking|service)"' .next/server/pages/ko/stories/${slug}.html | sort -u
done
```
Expected: 각 글에서 `data-inline-callout="booking"` + `data-inline-callout="price"` 2 종류

- [ ] **Step 5: Commit**

```bash
git add content/stories/mixing-complete-guide.md content/stories/vocal-recording-guide1.md content/stories/band-recording-guide1.md
git commit -m "content(inline): mixing/vocal/band-recording-guide1에 inline directive 시범 적용"
```

---

## Task 9: vocal/production/lesson 약 234편에 frontmatter `inlineFallback` 매핑 (서브에이전트 batch)

**Files:**
- Modify: `content/stories/*.md` (vocal/production/lesson categoryKey 글, 약 234편)

서브에이전트 6 batch로 분할 dispatch. 각 batch는 약 30-50편 처리.

**Subagent dispatch 전략 (controller가 직접 수행):**

각 batch에 다음 prompt 패턴으로 dispatch:

```
You are auditing a batch of Studio NOL story articles to add `inlineFallback` frontmatter for accurate Phase 2 auto-fallback matching.

## Context

Studio NOL의 Phase 2 자동 fallback은 categoryKey 단순 매핑(recording/mixing/instrument)만 적용하고,
vocal/production/lesson 카테고리는 글 단위 frontmatter `inlineFallback`로 정확 매핑한다.

## inlineFallback shape

```yaml
inlineFallback:
  price: <pricing.ts id 또는 hub pricingFallback id>   # optional
  review: <reviews.ts id>                                # optional
  booking: "<카카오톡 prefill 메시지>"                   # optional
```

Available pricing IDs:
- specialPackages: package-wedding (35만원), package-voiceover (시간당 10만원), package-rental (시간당 10만원)
- recordingOffers: recording-pro (보컬 녹음 1프로 25만원/3시간), recording-hourly (시간당 10만원), recording-daylock (6시간 50만원)
- mixingOffers: mixing-level1 (20만원/곡), mixing-level2 (35만원), mixing-level3 (50만원)
- masteringOffers: mastering-single (10만원), mastering-album (50만원)
- additionalServices: service-consulting, service-funding, service-promo, service-epk
- hub fallback: lesson-monthly (1:1 레슨 월 35만원)

Available review IDs:
- review-1 (production 카테고리, 음반 프로덕션)
- review-2 (wedding, 축가 녹음)
- review-3 (mixing, 믹싱·마스터링)
- review-4 (practice, 음악연습실)

## Your task

For each story file in the list below, read frontmatter title/summary + first 1-2 paragraphs.
Decide the best `inlineFallback` value:

- 보컬 트레이닝 글 (호흡·발성·음감 훈련 등) → `inlineFallback: { price: "lesson-monthly" }` 또는 비매칭
- 보컬 녹음 가이드 → `inlineFallback: { price: "recording-pro" }`
- 작곡·기획·발매 글 → 적합한 service-* 또는 비매칭
- 1:1 레슨 관련 → `inlineFallback: { price: "lesson-monthly" }`
- 인디 EP·앨범 제작 → `inlineFallback: { price: "recording-daylock" }`
- 매칭 적합한 게 없으면 `inlineFallback: {}` (자동 fallback 비활성)
- 직접 booking이 더 적합하면 `inlineFallback: { booking: "..." }`

For each file, output ONE patch in this exact format (frontmatter 위치는 howTo·faq 같은 기존 필드 옆):

  FILE: <full path>
  ACTION: insert_after_summary OR insert_before_faq OR no_change
  YAML_BLOCK:
  inlineFallback:
    price: ...

After all files processed, report: total files, applied patches, no_change count, sample 5 decisions with rationale.

## File list

[batch slug list]
```

각 batch 처리 후 controller가:
1. 응답 patch들을 직접 .md 파일에 적용
2. 적용 후 type-check + 빌드 검증

- [ ] **Step 0: 카테고리별 slug 추출 (controller가 dispatch 직전)**

vocal/production/lesson 글 목록을 alphabetical로 추출하고 batch 분할:

```bash
# /tmp/category-slugs.sh
cd /Users/hwang-gyeongha/studio
for f in content/stories/*.md; do
  if [[ "$f" =~ \.(en|zh|es|vi|th|uz)\.md$ ]]; then continue; fi
  cat=$(grep -E '^category:' "$f" | head -1 | sed 's/^category:[ ]*//; s/[" ]//g')
  case "$cat" in
    "보컬가이드"|"보컬 가이드"|"vocal") echo "vocal $(basename "$f" .md)";;
    "음악제작"|"음악 제작"|"production") echo "production $(basename "$f" .md)";;
    "강좌"|"lesson") echo "lesson $(basename "$f" .md)";;
  esac
done | sort > /tmp/inline-fallback-targets.txt

# Batch 분할 (각 batch ~40-45편)
awk '$1=="vocal"' /tmp/inline-fallback-targets.txt | head -n 43 > /tmp/batch1-vocal-A.txt
awk '$1=="vocal"' /tmp/inline-fallback-targets.txt | sed -n '44,86p' > /tmp/batch2-vocal-B.txt
awk '$1=="vocal"' /tmp/inline-fallback-targets.txt | sed -n '87,$p' > /tmp/batch3-vocal-C.txt
awk '$1=="production"' /tmp/inline-fallback-targets.txt | head -n 40 > /tmp/batch4-production-A.txt
awk '$1=="production"' /tmp/inline-fallback-targets.txt | sed -n '41,$p' > /tmp/batch5-production-B.txt
awk '$1=="lesson"' /tmp/inline-fallback-targets.txt > /tmp/batch6-lesson.txt
```

각 batch 파일이 dispatch 시 prompt에 사용된다.

- [ ] **Step 1: batch 1 dispatch — vocal A (약 43편)**

`/tmp/batch1-vocal-A.txt`의 slug 리스트를 위 prompt template에 삽입해 subagent dispatch. 결과 patch 적용.

- [ ] **Step 2: batch 2 dispatch — vocal B (약 43편)**

vocal categoryKey 글 두 번째 그룹(m-r). 결과 적용.

- [ ] **Step 3: batch 3 dispatch — vocal C (약 44편)**

vocal categoryKey 글 마지막 그룹(s-z + 기타). 결과 적용.

- [ ] **Step 4: batch 4 dispatch — production A (약 40편)**

production categoryKey 글 절반. 결과 적용.

- [ ] **Step 5: batch 5 dispatch — production B (약 40편)**

production categoryKey 글 나머지. 결과 적용.

- [ ] **Step 6: batch 6 dispatch — lesson (약 24편)**

lesson categoryKey 글 전부. 결과 적용.

- [ ] **Step 7: batch 적용 후 빌드 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 빌드 성공, 234편 모두 정상 SSG

자동 fallback 발현 누출 검사:
```bash
grep -l 'data-inline-callout' .next/server/pages/ko/stories/*.html | wc -l
```
Expected: 시범 글 5편(Phase 1 2편 + Phase 2 시범 3편) + frontmatter 매칭된 글 + categoryKey 매칭 글 = 약 200-400편 사이

inlineFallback 빈 object `{}` (자동 fallback 비활성)인 글이 누출 없이 처리되는지 sample 5편 확인:
```bash
# inlineFallback: {}로 명시한 글 sample (서브에이전트 결과 기준)
for slug in [sample slugs from batch reports]; do
  echo "=== $slug ==="
  grep -oE 'data-inline-callout="[^"]+"' .next/server/pages/ko/stories/${slug}.html
done
```
Expected: 빈 object 명시한 글에서 callout 미발현

- [ ] **Step 8: Batch 별 commit (작업 단위 분리)**

각 batch 적용 후 별도 commit으로 history 추적성 확보:

```bash
# batch 1 후
git add content/stories/[vocal A slugs].md
git commit -m "content(inline): vocal A 43편에 inlineFallback frontmatter 추가 (서브에이전트 batch 1)"

# batch 2-6 동일 패턴
```

총 6 commits.

---

## Task 10: 최종 검증 + sitemap 갱신

**Files:** (검증만)

- [ ] **Step 1: 전체 type-check + lint + jest**

Run: `npm run type-check && npm run lint && npm test`
Expected: 0 errors, 모든 테스트 통과 (storyAutoFallback 15 + inlineDirectives 15 + StickyBottomCTA 6 + 기존 모든)

- [ ] **Step 2: 빌드 + sitemap 재생성**

Run: `npx next build && rm -f public/sitemap*.xml public/robots.txt && npx next-sitemap && node scripts/normalize-sitemap-hreflang.js`
Expected: 빌드 성공, sitemap-0.xml 정상 생성

- [ ] **Step 3: 자동 fallback 누출 검사**

```bash
echo "=== callout 발현 글 수 ==="
grep -l 'data-inline-callout' .next/server/pages/ko/stories/*.html | wc -l

echo "=== raw short-code 잔재 검사 (모두 React 컴포넌트로 치환되어야 함) ==="
grep -rE '%%price|%%review|%%booking|%%service' .next/server/pages/ko/stories/*.html 2>/dev/null | grep -v '__NEXT_DATA__' | head -3
```
Expected:
- 발현 글 수는 매핑된 카테고리 글 수에 가까움 (200-400)
- raw short-code는 본문 article HTML에 없음 (Next.js __NEXT_DATA__ JSON 안에는 raw text 존재 — 정상)

- [ ] **Step 4: 시범 글 직접 확인**

```bash
for slug in wedding-song-guide1 audiobook-guide1 mixing-complete-guide vocal-recording-guide1 band-recording-guide1 guide1 harmony-singing1; do
  echo "=== $slug ==="
  grep -oE 'data-inline-callout="[^"]+"' .next/server/pages/ko/stories/${slug}.html | sort -u
done
```
Expected:
- wedding-song-guide1: booking + price (Phase 1)
- audiobook-guide1: price + review (Phase 1)
- mixing-complete-guide: booking + price (Phase 2 시범)
- vocal-recording-guide1: booking + price (Phase 2 시범)
- band-recording-guide1: booking + price (Phase 2 시범)
- guide1: price (recording categoryKey 자동 매핑)
- harmony-singing1: vocal categoryKey라 frontmatter inlineFallback에 따름 (서브에이전트 결정 결과)

- [ ] **Step 5: Final commit (필요 시)**

이 task는 검증만이라 commit 없을 가능성. 만약 lint/type 정정이 발생하면:

```bash
git add -A
git commit -m "fix(inline): Phase 2 빌드 검증 후 잔여 정정"
```

---

## Spec Coverage Summary

| Spec 항목 | 구현 Task |
|---|---|
| Layer 4 StickyBottomCTA | Task 6 + Task 7 |
| Layer 2 자동 fallback wiring | Task 4 |
| frontmatter inlineFallback | Task 1 (타입) + Task 9 (234편 적용) |
| categoryKey 단순 매핑 (3종) | Task 3 |
| decideAutoFallback booking 확장 | Task 2 |
| InlinePriceCallout hub fallback lookup | Task 5 |
| 시범 글 3편 directive | Task 8 |
| lib/storyAutoFallback unit test | Task 3 |
| StickyBottomCTA component test | Task 6 |
| 빌드·sitemap 검증 | Task 10 |

## Self-Review Checklist (Post-implementation)

- [ ] Phase 1 시범 글 2편(wedding-song-guide1, audiobook-guide1)에 자동 fallback이 들어가지 않는지 (작가 directive 2개로 차단)
- [ ] Phase 2 시범 글 3편에도 자동 fallback이 안 들어가는지 (작가 directive 2개로 차단)
- [ ] vocal categoryKey의 보컬 트레이닝 글(harmony-singing 등)에 어색한 "보컬 녹음 25만원" 박스가 자동 노출 안 되는지 — frontmatter inlineFallback으로 처리됐는지
- [ ] StickyBottomCTA가 ssr: false로 LCP 영향 0인지
- [ ] PSI Forced reflow 회귀 없는지 (IntersectionObserver만 사용)
- [ ] dismiss localStorage TTL 24h 동작 정확한지
- [ ] ko 외 locale 글에 자동 fallback이 안 들어가는지 (ko + sourceLocale==requestedLocale 조건 enforce)

---

**다음 단계 (Phase 3, 별도 spec):**
없음 — Phase 2가 inline service integration의 마지막 phase. 향후 운영하면서 어색한 매칭 발견 시 frontmatter inlineFallback 글 단위 수정.
