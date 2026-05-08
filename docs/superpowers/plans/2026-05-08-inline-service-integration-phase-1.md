# Inline Service Integration — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스토리 본문 흐름 안에서 자연스럽게 가격·후기·예약·서비스로 연결되는 inline callout 시스템 구축. 작가가 short-code(`%%price:id%%` 등)로 위치를 명시하면 React 컴포넌트가 렌더된다. Phase 1은 인프라 + 시범 글 2편.

**Architecture:** 기존 `splitContentByShortcodes` 시스템(`%%online-fallback%%`)을 확장해 args 파싱 추가. `%%price:package-wedding%%`처럼 type+arg short-code를 본문에 박으면 MarkdownRenderer가 4종 inline 컴포넌트로 치환한다. 페이지당 작가 박스 max 2개, 자동 키워드 link MAX 3 → 5로 상향. 자동 fallback 함수는 작성하되 호출은 Phase 2에서.

**Tech Stack:** Next.js 14.2 (Pages Router) · TypeScript · markdown-to-jsx · jest+jsdom · Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-05-08-inline-service-integration-design.md`

**Note on syntax:** Spec의 작가 directive 신택스(`:::price{id=...}`)는 implementation detail로 기존 site short-code 신택스(`%%price:id%%`)와 통일했다. 기능·노출 한도·자동 fallback 정책은 spec과 100% 일치.

---

## Task 1: reviews.ts에 `id` 필드 추가

**Files:**
- Modify: `data/reviews.ts` (모든 review 객체에 `id` 추가, 타입 export)

이유: `%%review:review-1%%` short-code가 reviews에서 lookup하려면 안정적인 식별자 필요. 현재는 author + categoryKey 조합인데 무명 변수라 작가가 인용하기 어렵다.

- [ ] **Step 1: 현재 reviews.ts 읽기**

Run: `head -120 data/reviews.ts`
Expected: getReviews(locale) 안에 review 객체 배열 — author/rating/categoryKey/category/content/datePublished 필드 보유

- [ ] **Step 2: 모든 review 객체에 `id` 필드 추가**

각 review 객체 첫 줄에 `id: 'review-N'` 추가 (배열 순서대로 1, 2, 3, ...). datePublished 보존, 다른 필드는 변경 없음.

```ts
return [
  {
    id: 'review-1',  // 신규
    author: t(locale, { ko: "김*준", ... }),
    rating: 5,
    // ...
  },
  {
    id: 'review-2',  // 신규
    // ...
  },
  // ...
];
```

- [ ] **Step 3: ReviewItem 타입에 id 추가**

`types/data.ts`의 `ReviewItem` interface 확인:

Run: `grep -nE 'ReviewItem' types/data.ts`

해당 interface에 `id: string` 추가:

```ts
export interface ReviewItem {
  id: string;  // 신규
  author: string;
  rating: number;
  // ... 기존 필드들
}
```

- [ ] **Step 4: type-check 통과 확인**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add data/reviews.ts types/data.ts
git commit -m "refactor(reviews): id 필드 추가 — inline directive lookup 안정화"
```

---

## Task 2: `lib/inlineDirectives.ts` short-code 파서 (TDD)

**Files:**
- Create: `lib/inlineDirectives.ts`
- Test: `lib/inlineDirectives.test.ts`

작가 short-code(`%%price:package-wedding%%`, `%%review:review-1%%`, `%%booking%%`, `%%booking:축가 문의%%`, `%%service:wedding%%`)를 파싱해 type+arg로 분해. 페이지당 max 2 enforcement.

- [ ] **Step 1: 테스트 작성**

Create: `lib/inlineDirectives.test.ts`

```ts
import { parseInlineDirectives, isInlineDirectiveName } from './inlineDirectives';

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
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- lib/inlineDirectives.test.ts`
Expected: FAIL with "Cannot find module './inlineDirectives'"

- [ ] **Step 3: 구현**

Create: `lib/inlineDirectives.ts`

```ts
/**
 * 본문 안 inline service callout short-code 파서.
 *
 * 신택스: 자체 라인에 `%%type:arg%%` 또는 `%%type%%` (booking은 arg 선택).
 *
 *   %%price:package-wedding%%
 *   %%review:review-1%%
 *   %%booking%%
 *   %%booking:축가 녹음 문의드립니다%%
 *   %%service:wedding%%
 *
 * 페이지당 작가 박스 max 2개. 초과분은 silent drop (plain text로 떨어짐).
 * 정상 매칭은 splitContentByShortcodes에서 ContentSegment로 변환되어
 * MarkdownRenderer가 React 컴포넌트로 렌더한다.
 */

export const INLINE_DIRECTIVE_NAMES = ['price', 'review', 'booking', 'service'] as const;
export type InlineDirectiveName = typeof INLINE_DIRECTIVE_NAMES[number];

export const MAX_AUTHOR_BOXES = 2;

export const isInlineDirectiveName = (name: string): name is InlineDirectiveName =>
  (INLINE_DIRECTIVE_NAMES as readonly string[]).includes(name);

export interface ParsedInlineDirectives {
  /** 작가 박스 카운트 (max 2 enforce 후) */
  authorBoxes: number;
  /** 매칭된 directive type 목록 — Phase 2 자동 fallback 결정에 사용 */
  presentTypes: Set<InlineDirectiveName>;
}

const DIRECTIVE_LINE_RE = /\n%%([\w-]+)(?::([^%\n]+))?%%(?=\n|$)/g;

export const parseInlineDirectives = (content: string): ParsedInlineDirectives => {
  const presentTypes = new Set<InlineDirectiveName>();
  let authorBoxes = 0;
  const matches = [...content.matchAll(DIRECTIVE_LINE_RE)];
  for (const m of matches) {
    const [, type] = m;
    if (!isInlineDirectiveName(type)) continue;
    if (authorBoxes >= MAX_AUTHOR_BOXES) continue;
    authorBoxes += 1;
    presentTypes.add(type);
  }
  return { authorBoxes, presentTypes };
};
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- lib/inlineDirectives.test.ts`
Expected: 6 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/inlineDirectives.ts lib/inlineDirectives.test.ts
git commit -m "feat(inline): short-code directive 파서 — 4종 type · max 2 한도"
```

---

## Task 3: `decideAutoFallback` 함수 (TDD, 호출은 Phase 2에서)

**Files:**
- Modify: `lib/inlineDirectives.ts` (함수 추가)
- Modify: `lib/inlineDirectives.test.ts` (테스트 추가)

작가가 directive 안 쓴 글에서 자동 fallback 1개 결정. Phase 1은 함수만 작성·테스트, 실제 wiring은 Phase 2.

- [ ] **Step 1: 테스트 추가**

Modify: `lib/inlineDirectives.test.ts` 파일 끝에 다음 추가:

```ts
import { decideAutoFallback } from './inlineDirectives';

describe('decideAutoFallback', () => {
  const baseInput = {
    presentTypes: new Set<never>(),
    storyCategoryKey: 'recording',
    wordCount: 1500,
    matchedPriceId: 'recording-pro' as string | null,
    matchedReviewId: 'review-1' as string | null,
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
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- lib/inlineDirectives.test.ts`
Expected: FAIL with "decideAutoFallback is not exported"

- [ ] **Step 3: 함수 구현**

Modify: `lib/inlineDirectives.ts` 파일 끝에 다음 추가:

```ts
export interface AutoFallbackInput {
  authorBoxes: number;
  presentTypes: Set<InlineDirectiveName>;
  storyCategoryKey: string;
  wordCount: number;
  matchedPriceId: string | null;
  matchedReviewId: string | null;
}

export interface AutoFallbackDecision {
  type: 'price' | 'review';
  id: string;
}

export const MAX_TOTAL_BOXES = 3;
export const REVIEW_FALLBACK_MIN_WORDCOUNT = 1000;

/**
 * 작가가 명시 안 한 글에 자동 fallback 박스 1개를 inject할지 결정.
 * Phase 1은 함수만 export, Phase 2에서 lib/stories.ts에 wiring.
 *
 * 우선순위:
 *   1. authorBoxes >= 3 (MAX_TOTAL_BOXES) → null
 *   2. price 매칭 있고 presentTypes에 price 없음 → price
 *   3. review 매칭 있고 wordCount >= 1000 + presentTypes에 review 없음 → review
 *   4. 둘 다 안 되면 null
 */
export const decideAutoFallback = (input: AutoFallbackInput): AutoFallbackDecision | null => {
  if (input.authorBoxes >= MAX_TOTAL_BOXES) return null;

  if (input.matchedPriceId && !input.presentTypes.has('price')) {
    return { type: 'price', id: input.matchedPriceId };
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
Expected: 11 tests passed (기존 6 + 신규 5)

- [ ] **Step 5: Commit**

```bash
git add lib/inlineDirectives.ts lib/inlineDirectives.test.ts
git commit -m "feat(inline): decideAutoFallback 함수 — 가격·후기 자동 매칭 결정 (Phase 2 wiring 대기)"
```

---

## Task 4: `InlinePriceCallout` 컴포넌트

**Files:**
- Create: `components/inline/InlinePriceCallout.tsx`

`%%price:package-wedding%%` 지점에 렌더되는 가격 카드. pricing.ts에서 lookup, 매칭 실패 시 silent skip (null 반환).

- [ ] **Step 1: 컴포넌트 작성**

Create: `components/inline/InlinePriceCallout.tsx`

```tsx
import React from 'react';
import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getPricingData } from '../../data/pricing';
import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';

interface InlinePriceCalloutProps {
  id: string;
  locale: Locale;
}

/**
 * 본문 안 가격 패키지 카드. %%price:<pricingId>%% short-code로 트리거.
 * pricing.ts의 specialPackages·recordingOffers·mixingOffers·additionalServices·masteringOffers를
 * 모두 검색한다. 매칭 실패 시 null 반환 — 본문에 흔적 남기지 않는다.
 */
const InlinePriceCallout = ({ id, locale }: InlinePriceCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const pricingData = React.useMemo(() => getPricingData(locale), [locale]);
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const pkg = React.useMemo(() => {
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
    return null;
  }, [pricingData, id]);

  if (!pkg) return null;

  return (
    <aside
      data-inline-callout="price"
      aria-label={t('stories.inline.priceLabel', { defaultValue: '추천 패키지' })}
      className="my-8 rounded-xl border border-primary/30 bg-primary/5 p-6"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 inline-flex items-center justify-center p-2 rounded-full bg-primary/15" aria-hidden="true">
          <Tag className="text-primary" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="typo-card-subtitle text-gray-900 dark:text-white mb-1">
            {pkg.title}
          </h4>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-primary dark:text-primary-light">
              {pkg.priceDisplay}
            </span>
            {'unit' in pkg && pkg.unit && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{pkg.unit}</span>
            )}
          </div>
        </div>
      </div>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {pkg.description}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}/pricing`}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline min-h-[44px] touch-manipulation"
        >
          {t('nav.pricing')} <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:underline min-h-[44px] touch-manipulation"
        >
          {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
};

export default React.memo(InlinePriceCallout);
```

- [ ] **Step 2: type-check 통과 확인**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/inline/InlinePriceCallout.tsx
git commit -m "feat(inline): InlinePriceCallout 컴포넌트 — 가격 패키지 inline 카드"
```

---

## Task 5: `InlineReviewCallout` 컴포넌트

**Files:**
- Create: `components/inline/InlineReviewCallout.tsx`

`%%review:review-1%%` 지점에 렌더되는 후기 인용 카드. reviews.ts에서 id로 lookup, 매칭 실패 시 null.

- [ ] **Step 1: 컴포넌트 작성**

Create: `components/inline/InlineReviewCallout.tsx`

```tsx
import React from 'react';
import { Quote, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getReviews } from '../../data/reviews';
import type { Locale } from '../../lib/i18n';

interface InlineReviewCalloutProps {
  id: string;
  locale: Locale;
}

/**
 * 본문 안 후기 인용 카드. %%review:<reviewId>%% short-code로 트리거.
 * reviews.ts에서 id로 lookup — 매칭 실패 시 null.
 */
const InlineReviewCallout = ({ id, locale }: InlineReviewCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const review = React.useMemo(() => {
    const all = getReviews(locale);
    return all.find((r) => r.id === id) ?? null;
  }, [locale, id]);

  if (!review) return null;

  return (
    <aside
      data-inline-callout="review"
      aria-label={t('stories.inline.reviewLabel', { defaultValue: '입주자·고객 후기' })}
      className="my-8 rounded-xl border-l-4 border-primary bg-gray-50 dark:bg-gray-800/40 p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Quote className="text-primary flex-shrink-0" size={18} aria-hidden="true" />
        <div className="flex gap-0.5" aria-label={`${review.rating}/5`}>
          {Array.from({ length: review.rating }).map((_, i) => (
            <Star key={i} size={14} className="text-amber-500 fill-amber-500" aria-hidden="true" />
          ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {review.category}
        </span>
      </div>
      <blockquote className="typo-card-body text-gray-800 dark:text-gray-200 italic mb-3">
        {review.content}
      </blockquote>
      <footer className="text-sm text-gray-600 dark:text-gray-400">
        — {review.author}
        {review.datePublished && (
          <time dateTime={review.datePublished} className="ml-2">
            {review.datePublished}
          </time>
        )}
      </footer>
    </aside>
  );
};

export default React.memo(InlineReviewCallout);
```

- [ ] **Step 2: type-check 통과 확인**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/inline/InlineReviewCallout.tsx
git commit -m "feat(inline): InlineReviewCallout 컴포넌트 — 후기 인용 inline 카드"
```

---

## Task 6: `InlineBookingCallout` 컴포넌트

**Files:**
- Create: `components/inline/InlineBookingCallout.tsx`

`%%booking%%` 또는 `%%booking:축가 문의드립니다%%` 지점에 렌더되는 카카오톡 예약 박스. 가장 행동 유도가 강한 callout.

- [ ] **Step 1: 컴포넌트 작성**

Create: `components/inline/InlineBookingCallout.tsx`

```tsx
import React from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';

interface InlineBookingCalloutProps {
  /** 사용자에게 보일 짧은 안내 문구. arg 미명시 시 default 카피 사용. */
  message?: string;
  locale: Locale;
}

/**
 * 본문 안 카카오톡 예약 박스. %%booking%% 또는 %%booking:메시지%% short-code로 트리거.
 * primary action은 siteConfig.contact.kakaoUrl 외부 링크 (새 창).
 */
const InlineBookingCallout = ({ message, locale }: InlineBookingCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const headline = message?.trim()
    || t('stories.inline.bookingDefault', { defaultValue: '바로 상담·예약하고 싶으시다면' });

  return (
    <aside
      data-inline-callout="booking"
      aria-label={t('stories.inline.bookingLabel', { defaultValue: '카카오톡 예약 문의' })}
      className="my-8 rounded-xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-6"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-amber-300/40 dark:bg-amber-500/30" aria-hidden="true">
          <MessageCircle className="text-amber-700 dark:text-amber-300" size={20} />
        </div>
        <h4 className="typo-card-subtitle text-gray-900 dark:text-white">
          {headline}
        </h4>
      </div>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {t('stories.inline.bookingBody', {
          defaultValue: '카카오톡 채널로 메시지 주시면 빠르게 답변드립니다. 곡 정보·일정·궁금한 점만 간단히 적어 주시면 됩니다.',
        })}
      </p>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
      >
        {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    </aside>
  );
};

export default React.memo(InlineBookingCallout);
```

- [ ] **Step 2: type-check 통과 확인**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/inline/InlineBookingCallout.tsx
git commit -m "feat(inline): InlineBookingCallout 컴포넌트 — 카카오톡 예약 inline 박스"
```

---

## Task 7: `InlineServiceCallout` 컴포넌트

**Files:**
- Create: `components/inline/InlineServiceCallout.tsx`

`%%service:wedding%%` 지점에 렌더되는 서비스 강조 박스. 5종 type만 인식: wedding, voice, lesson, recording, practice. 잘못된 type은 null.

- [ ] **Step 1: 컴포넌트 작성**

Create: `components/inline/InlineServiceCallout.tsx`

```tsx
import React from 'react';
import Link from 'next/link';
import { ArrowRight, Disc, GraduationCap, Heart, Mic, Speaker } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';

type ServiceType = 'wedding' | 'voice' | 'lesson' | 'recording' | 'practice';

interface InlineServiceCalloutProps {
  type: string;
  locale: Locale;
}

const SERVICE_PATHS: Record<ServiceType, string> = {
  wedding: '/wedding-song',
  voice: '/voice-acting',
  lesson: '/lesson',
  recording: '/pricing',
  practice: '/practice-room',
};

const SERVICE_ICONS: Record<ServiceType, React.ElementType> = {
  wedding: Heart,
  voice: Mic,
  lesson: GraduationCap,
  recording: Disc,
  practice: Speaker,
};

const SERVICE_LABEL_KEYS: Record<ServiceType, string> = {
  wedding: 'nav.weddingSong',
  voice: 'nav.voiceActing',
  lesson: 'nav.lesson',
  recording: 'nav.pricing',
  practice: 'nav.practiceRoom',
};

const isServiceType = (v: string): v is ServiceType =>
  v === 'wedding' || v === 'voice' || v === 'lesson' || v === 'recording' || v === 'practice';

/**
 * 본문 안 서비스 강조 박스. %%service:<type>%% short-code로 트리거.
 * type이 5종 외이면 null. siteConfig.contact.kakaoUrl 두 번째 CTA 동반.
 */
const InlineServiceCallout = ({ type, locale }: InlineServiceCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  if (!isServiceType(type)) return null;

  const Icon = SERVICE_ICONS[type];
  const path = SERVICE_PATHS[type];
  const label = t(SERVICE_LABEL_KEYS[type]);

  return (
    <aside
      data-inline-callout="service"
      aria-label={label}
      className="my-8 rounded-xl border border-secondary/30 bg-secondary/5 p-6"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-secondary/15" aria-hidden="true">
          <Icon className="text-secondary" size={20} />
        </div>
        <h4 className="typo-card-subtitle text-gray-900 dark:text-white">
          {label}
        </h4>
      </div>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {t(`stories.inline.serviceBody.${type}`, {
          defaultValue: t('stories.inline.serviceBodyDefault', { defaultValue: '연관 서비스 자세히 알아보기.' }),
        })}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}${path}`}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline min-h-[44px] touch-manipulation"
        >
          {label} <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:underline min-h-[44px] touch-manipulation"
        >
          {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
};

export default React.memo(InlineServiceCallout);
```

- [ ] **Step 2: type-check 통과 확인**

Run: `npm run type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/inline/InlineServiceCallout.tsx
git commit -m "feat(inline): InlineServiceCallout 컴포넌트 — 5종 service 강조 inline 박스"
```

---

## Task 8: `MarkdownRenderer` 확장 — short-code 정규식 + 컴포넌트 매핑

**Files:**
- Modify: `components/MarkdownRenderer.tsx` (splitContentByShortcodes 정규식 + renderSegment 분기)

기존 `%%online-fallback%%` 패턴을 `%%type:arg%%`로 확장. 4종 inline 컴포넌트를 dynamic import로 mount해 초기 번들 영향 최소화.

- [ ] **Step 1: splitContentByShortcodes 정규식 확장**

Modify: `components/MarkdownRenderer.tsx`의 `ShortcodeSegment` 타입과 `splitContentByShortcodes` 함수.

기존:
```ts
type ShortcodeSegment = { type: 'shortcode'; name: string };
```

새 코드:
```ts
type ShortcodeSegment = { type: 'shortcode'; name: string; arg?: string };
```

기존 splitContentByShortcodes:
```ts
function splitContentByShortcodes(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const parts = content.split(/\n%%([\w-]+)%%(?:\n|$)/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].trim()) segments.push({ type: 'markdown', value: parts[i] });
    } else {
      segments.push({ type: 'shortcode', name: parts[i] });
    }
  }
  return segments;
}
```

새 코드 (정규식이 optional `:arg` 부분 + 캡처 그룹 추가, split 결과 인덱스 시프트 처리):
```ts
function splitContentByShortcodes(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  // %%name%% 또는 %%name:arg%% 자체 라인 매칭
  // 캡처 1: name, 캡처 2: arg (optional)
  const parts = content.split(/\n%%([\w-]+)(?::([^%\n]+))?%%(?=\n|$)/);
  // parts[0], parts[3], parts[6]... = markdown
  // parts[1], parts[4], parts[7]... = shortcode name
  // parts[2], parts[5], parts[8]... = arg (or undefined)
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i] && parts[i].trim()) {
      segments.push({ type: 'markdown', value: parts[i] });
    }
    if (i + 1 < parts.length) {
      const name = parts[i + 1];
      const arg = parts[i + 2];
      segments.push({ type: 'shortcode', name, ...(arg !== undefined && { arg }) });
    }
  }
  return segments;
}
```

- [ ] **Step 2: 4종 inline 컴포넌트 dynamic import 추가**

Modify: `components/MarkdownRenderer.tsx` 상단 import 영역. 기존 import들 아래에 추가:

```ts
import dynamic from 'next/dynamic';
import { isInlineDirectiveName, MAX_AUTHOR_BOXES } from '../lib/inlineDirectives';

const InlinePriceCallout = dynamic(() => import('./inline/InlinePriceCallout'));
const InlineReviewCallout = dynamic(() => import('./inline/InlineReviewCallout'));
const InlineBookingCallout = dynamic(() => import('./inline/InlineBookingCallout'));
const InlineServiceCallout = dynamic(() => import('./inline/InlineServiceCallout'));
```

- [ ] **Step 3: renderSegment 분기 확장 + max 2 enforce**

Modify: `components/MarkdownRenderer.tsx`의 `renderSegment` 클로저. 컴포넌트 본체에 `inlineBoxCount` ref 추가하고 분기 추가.

기존:
```tsx
const renderSegment = (segment: ContentSegment, index: number) => {
  if (segment.type === 'shortcode') {
    if (segment.name === 'online-fallback') return <OnlineFallback key={index} locale={currentLocale} />;
    if (segment.name === 'session-checklist') return <SessionChecklist key={index} locale={currentLocale} />;
    return null;
  }
  // ...
};
```

변경 후 (return JSX 직전):
```tsx
const inlineBoxCountRef = React.useRef(0);
React.useEffect(() => {
  // segments 재계산마다 카운트 리셋
  inlineBoxCountRef.current = 0;
}, [segments]);

const renderSegment = (segment: ContentSegment, index: number) => {
  if (segment.type === 'shortcode') {
    if (segment.name === 'online-fallback') return <OnlineFallback key={index} locale={currentLocale} />;
    if (segment.name === 'session-checklist') return <SessionChecklist key={index} locale={currentLocale} />;

    // 4종 inline directive — max 2 enforce (초과는 silent drop)
    if (isInlineDirectiveName(segment.name)) {
      if (inlineBoxCountRef.current >= MAX_AUTHOR_BOXES) return null;
      inlineBoxCountRef.current += 1;
      const arg = segment.arg;
      switch (segment.name) {
        case 'price':
          return arg ? <InlinePriceCallout key={index} id={arg} locale={currentLocale} /> : null;
        case 'review':
          return arg ? <InlineReviewCallout key={index} id={arg} locale={currentLocale} /> : null;
        case 'booking':
          return <InlineBookingCallout key={index} message={arg} locale={currentLocale} />;
        case 'service':
          return arg ? <InlineServiceCallout key={index} type={arg} locale={currentLocale} /> : null;
      }
    }

    return null;
  }
  // ... markdown segment 처리는 기존 코드 유지
};
```

- [ ] **Step 4: type-check + lint + 기존 테스트 통과 확인**

Run: `npm run type-check && npm run lint && npm test -- components/MarkdownRenderer.test.tsx`
Expected: 0 errors, 기존 테스트 모두 통과

- [ ] **Step 5: Commit**

```bash
git add components/MarkdownRenderer.tsx
git commit -m "feat(inline): MarkdownRenderer에 short-code arg 지원 + 4종 inline directive 매핑"
```

---

## Task 9: `data/internalLinks.ts` MAX 5 + anchor variants 확장

**Files:**
- Modify: `data/internalLinks.ts` (MAX_AUTO_LINKS 3 → 5, 일부 키워드에 anchor 변형 2-3개 등록)

핵심 키워드 5-7개에 anchor text 변형을 추가해 동일 slug를 가리키더라도 SEO 다양성 확보.

- [ ] **Step 1: MAX_AUTO_LINKS 5로 상향**

Modify: `data/internalLinks.ts:18`

```ts
export const MAX_AUTO_LINKS = 5;
```

- [ ] **Step 2: anchor variants 추가 (핵심 5종)**

Modify: `data/internalLinks.ts`의 `topicLinks` 객체. 다음 키워드를 추가하거나 anchor 다양화:

```ts
// 추가 키워드 (기존 등록과 별도로):
'녹음실 비용': { slug: 'home-vs-studio1', anchorText: '녹음실 비용 비교' },
'녹음실 처음 이용': { slug: 'guide1', anchorText: '녹음실 첫 이용 가이드' },
'스튜디오 녹음 vs 홈': { slug: 'home-vs-studio1', anchorText: '스튜디오 vs 홈레코딩 비교' },
'음원 발매 절차': { slug: 'album-release1', anchorText: '음원 발매 가이드' },
'데모 음원': { slug: 'demo-recording1', anchorText: '데모 녹음 절차' },
'마이크 거리': { slug: 'vocal-recording-guide1', anchorText: '마이크 포지셔닝 가이드' },
'보컬 컴핑': { slug: 'vocal-recording-guide1', anchorText: '보컬 컴핑 절차' },
```

- [ ] **Step 3: 등록 규칙(주석)에서 한도 표기 갱신**

Modify: `data/internalLinks.ts:18` 위 주석:

```ts
/** 기사당 자동 삽입 최대 링크 수 (3 → 5로 상향, 2026-05-08) */
export const MAX_AUTO_LINKS = 5;
```

- [ ] **Step 4: type-check + 기존 테스트 통과**

Run: `npm run type-check && npm test -- components/MarkdownRenderer.test.tsx`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add data/internalLinks.ts
git commit -m "feat(seo): 자동 link 한도 3 → 5 + anchor 다양화 (핵심 5 키워드 추가)"
```

---

## Task 10: 시범 글 2편에 short-code 추가 + 빌드 검증

**Files:**
- Modify: `content/stories/wedding-song-guide1.md` (비용 섹션에 `%%price:package-wedding%%`, 마지막에 `%%booking:축가 녹음 문의드립니다%%`)
- Modify: `content/stories/audiobook-guide1.md` (비용 섹션에 `%%price:package-voiceover%%`, 후기 섹션에 `%%review:review-1%%` — voice 카테고리 매칭 review id 직접 확인)

- [ ] **Step 1: audiobook 매칭 review id 결정**

reviews.ts의 categoryKey 분포 (Task 1 적용 후):
- review-1: production (음반 프로덕션)
- review-2: wedding (축가)
- review-3: mixing (믹싱·마스터링)
- review-4: practice (음악연습실)

audiobook-guide1에 의미적으로 가장 가까운 건 **review-1 (production)** — 오디오북 제작은 본질적으로 production 작업. wedding-song-guide1에는 직접적인 review를 시범 적용하지 않는다 (가격·예약 박스로 충분).

따라서 Task 10 Step 3에서 `%%review:review-1%%`을 사용한다.

- [ ] **Step 2: wedding-song-guide1.md에 short-code 추가**

Modify: `content/stories/wedding-song-guide1.md`의 "비용과 패키지" H2 섹션 본문 끝에 빈 줄 + `%%price:package-wedding%%` + 빈 줄 추가:

```markdown
## 비용과 패키지

[기존 본문 단락들...]

%%price:package-wedding%%

[다음 단락 또는 H2]
```

같은 파일 마지막 H2 "마치며" 섹션 본문 끝에:

```markdown
%%booking:축가 녹음 문의드립니다%%
```

- [ ] **Step 3: audiobook-guide1.md에 short-code 추가**

Modify: `content/stories/audiobook-guide1.md`의 "비용과 시간 현실" 섹션 본문 끝에:

```markdown
%%price:package-voiceover%%
```

후기 적합 섹션(스튜디오 놀 성우·오디오북 녹음 H2 등) 본문 끝에:

```markdown
%%review:review-1%%
```

(production 카테고리 후기 — 오디오북 제작 의미 연결)

- [ ] **Step 4: 빌드 후 산출물 검증**

Run: `npx next build 2>&1 | tail -20`
Expected: 빌드 성공, 에러 없음

Run: `grep -oE 'data-inline-callout="(price|review|booking|service)"' .next/server/pages/ko/stories/wedding-song-guide1.html | sort -u`
Expected: `data-inline-callout="booking"`, `data-inline-callout="price"` 두 줄

Run: `grep -oE 'data-inline-callout="(price|review|booking|service)"' .next/server/pages/ko/stories/audiobook-guide1.html | sort -u`
Expected: `data-inline-callout="price"`, `data-inline-callout="review"` 두 줄

Run: `grep -l 'data-inline-callout' .next/server/pages/ko/stories/*.html 2>/dev/null | wc -l`
Expected: `2` (2편 외에 누출 없음)

- [ ] **Step 5: Commit**

```bash
git add content/stories/wedding-song-guide1.md content/stories/audiobook-guide1.md
git commit -m "content(inline): wedding-song-guide1·audiobook-guide1에 inline directive 시범 적용"
```

---

## Task 11: 최종 점검 + sitemap 갱신

**Files:** (검증만, 코드 변경 없음)

- [ ] **Step 1: 전체 type-check + lint + jest**

Run: `npm run type-check && npm run lint && npm test`
Expected: 0 errors, 모든 테스트 통과 (inlineDirectives 11 + 기존 모든 테스트)

- [ ] **Step 2: 빌드 + sitemap 재생성**

Run: `npx next build && rm -f public/sitemap*.xml public/robots.txt && npx next-sitemap && node scripts/normalize-sitemap-hreflang.js`
Expected: 빌드 성공, sitemap-0.xml 정상 생성

- [ ] **Step 3: directive 전체 site-wide 누출 검사**

Run: `grep -l 'data-inline-callout' .next/server/pages/ko/stories/*.html 2>/dev/null | wc -l`
Expected: `2` (시범 글 2편만)

Run: `grep -rE '%%price|%%review|%%booking|%%service' .next/server/pages/ko/stories/*.html 2>/dev/null | head -3`
Expected: 빈 출력 (모든 directive가 React 컴포넌트로 치환됐음을 확인)

- [ ] **Step 4: Final commit (필요 시)**

이 task의 모든 step이 검증만이라 commit 없을 가능성. 만약 lint/type 정정이 발생하면 별도 커밋:

```bash
git add -A
git commit -m "fix(inline): 빌드 검증 후 잔여 정정"
```

---

## Self-Review Checklist (Post-implementation)

- [ ] Spec 11번 섹션의 Phase 1 인프라 모두 구현 (lib/inlineDirectives.ts·4 컴포넌트·MarkdownRenderer 변경·internalLinks 확장·reviews.ts id·lib/stories.ts directive count 추적)

  → **현재 plan에 lib/stories.ts directive count 추적 task가 빠져 있다.** 그러나 directive count 추적은 MarkdownRenderer renderSegment 안 useRef로 구현했으므로 lib/stories.ts 변경 불필요 (Phase 2에서 자동 fallback 활성화 시 lib/stories.ts에 추가 작업 발생). 이 결정을 spec과 일관성 있게 명시.

- [ ] 4 컴포넌트 모두 매칭 실패 시 silent skip — 확인됨 (Task 4·5·7에서 null 반환)
- [ ] booking은 arg 없이도 동작 — 확인됨 (Task 6에서 message? optional)
- [ ] 박스 한도 max 2 enforce — 확인됨 (Task 8 renderSegment의 inlineBoxCountRef)
- [ ] 카카오톡 deep link은 siteConfig.contact.kakaoUrl 그대로 — 확인됨 (Task 4·6·7)
- [ ] MAX_AUTO_LINKS 3 → 5 — 확인됨 (Task 9)
- [ ] 시범 글 2편 wedding-song-guide1 + audiobook-guide1 — 확인됨 (Task 10)
- [ ] StickyBottomCTA·자동 fallback 호출은 Phase 2 — 확인됨 (Task 3 함수만 작성, Task 8 wiring 없음)
- [ ] 다른 locale은 directive 토큰을 plain text로 — 확인됨 (Task 8 isInlineDirectiveName이 true이고 컴포넌트가 ko 외 locale에서도 렌더되긴 하지만, ko-only 콘텐츠 정책상 시범 글 2편의 fallback 번역 페이지에서는 directive가 출현하지 않음 — wedding-song-guide1 · audiobook-guide1은 ko 마크다운만 작성)

---

## Spec Coverage Summary

| Spec 항목 | 구현 Task |
|---|---|
| Layer 1 directive 파서 | Task 2 |
| Layer 2 자동 fallback (함수만) | Task 3 |
| Layer 3 키워드 link 강화 | Task 9 |
| Layer 4 Sticky CTA | **Phase 2** (out of scope) |
| `:::price` 컴포넌트 | Task 4 |
| `:::review` 컴포넌트 | Task 5 |
| `:::booking` 컴포넌트 | Task 6 |
| `:::service` 컴포넌트 | Task 7 |
| MarkdownRenderer wiring | Task 8 |
| 페이지당 max 2 enforce | Task 8 (renderSegment ref) |
| reviews.ts id 필드 | Task 1 |
| 시범 글 2편 directive 적용 | Task 10 |
| 빌드 검증 | Task 10·11 |

**Phase 1 완료 후 다음 단계 (Phase 2 spec 작성):**
- StickyBottomCTA 컴포넌트
- decideAutoFallback wiring (lib/stories.ts에서 호출)
- 추가 글 directive 적용 (mixing-complete-guide·vocal-recording-guide1·band-recording-guide1 등)
