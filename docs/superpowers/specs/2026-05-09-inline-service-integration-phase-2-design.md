# Inline Service Integration — Phase 2 Design Spec

**Date**: 2026-05-09
**Status**: Approved (사용자 OK 받음)
**Owner**: Studio NOL (황경하)
**Builds on**: `2026-05-08-inline-service-integration-design.md` (Phase 1)

## 1. 배경

Phase 1에서 short-code parser·4 컴포넌트·MarkdownRenderer wiring·키워드 link MAX 5 인프라가 완성됐다. 작가가 directive를 명시한 시범 2편에서는 inline 서비스 박스가 정상 발현됨을 확인했다.

남은 작업:
- 작가가 directive 안 쓴 1,728편에도 자연스러운 가격·후기 박스가 자동 발화하도록 wiring (Phase 1에서 함수만 export, 호출 안 함)
- 본문 끝에 도달하기 전 conversion 캡처를 위한 sticky bottom CTA
- HowTo schema가 적용된 5편 중 시범 안 한 3편에 directive 명시 (자동 fallback이 못 잡을 정확한 위치 의도)

세 작업은 모두 Phase 1 인프라 위에 얹어지며, 같은 spec에 묶어 한 흐름으로 진행한다.

## 2. 목표·비목표

**Goals**
- 작가 명시 없는 글 약 60%(recording/mixing/production/vocal/instrument 카테고리)에 자동으로 가격 박스 1개 발화
- 본문 첫 H2 이후 사용자가 viewport 밖으로 스크롤하면 sticky bottom CTA 노출, dismiss 가능
- HowTo 5편 중 시범 안 한 3편에 directive 적용 (작가 의도 위치)
- ScrollProgress 회귀(PSI Forced reflow 9079ms) 재발 방지 — IntersectionObserver 기반

**Non-goals**
- 본문 키워드 detection 기반 매칭 (false-positive로 link spam 회귀 위험)
- 카카오톡 prefill 메시지 분기 (Phase 1 결정 유지 — siteConfig.contact.kakaoUrl 그대로)
- 다른 locale의 자동 fallback (ko만 활성화, 다른 locale은 directive만)
- StickyCTA의 다단계·prompts·multi-step (단순 두 버튼 + dismiss)

## 3. 결정 사항 (사용자 컨펌 완료)

1. **Phase 2 범위**: 3가지 모두 한 spec (StickyCTA + 자동 fallback wiring + 추가 글 directive)
2. **StickyCTA trigger**: IntersectionObserver
3. **자동 fallback 매칭 정책**: categoryKey 단순 매핑 + lesson categoryKey는 hub의 pricingFallback 카드 reuse
4. **추가 글 directive**: HowTo 적용된 5편 중 시범 안 한 3편 (mixing/vocal/band-recording)

## 4. 아키텍처

```
┌─────────────────────────────────────────────────┐
│ Layer 4 — StickyBottomCTA (NEW)                 │
│   본문 첫 H2 직후 invisible marker <div>        │
│   IntersectionObserver: marker가 viewport 위로  │
│     올라가면 sticky 노출                        │
│   dismiss(24h TTL) + 카카오톡 + 가격 페이지     │
├─────────────────────────────────────────────────┤
│ Layer 2 — 자동 fallback WIRING (NEW)            │
│   getStoryDetail에서:                           │
│     parseInlineDirectives → authorBoxes·types  │
│     PRICING_BY_CATEGORY[categoryKey] → priceId │
│     REVIEW_BY_CATEGORY[categoryKey] → reviewId │
│     decideAutoFallback() → 결정                 │
│     injectAutoFallbackMarker() → 본문 변형      │
│   inject 위치: 마지막 H2 직전 (본문 끝 wrap-up 전)│
└─────────────────────────────────────────────────┘
                  ↓ 변경 없음
        Phase 1 인프라 (parser · 4 컴포넌트 · renderer wiring · keyword links)
```

## 5. 자산 명세

| 자산 | Phase 2 status | 위치 | 책임 |
|---|---|---|---|
| `StickyBottomCTA` | NEW | components/inline/StickyBottomCTA.tsx | marker visible toggle, dismiss state, 두 버튼 |
| `lib/storyAutoFallback.ts` | NEW | matchPricingForCategory · matchReviewForCategory · injectAutoFallbackMarker · constants | categoryKey → packageId/reviewId 매핑 + 본문 inject |
| `lib/storyAutoFallback.test.ts` | NEW | TDD | 매핑·inject 위치·edge cases |
| `lib/stories.ts` (`getStoryDetail`) | MODIFY | 자동 fallback 호출 wiring | parse → match → decide → inject 흐름 |
| `pages/[locale]/stories/[id].tsx` | MODIFY | StickyBottomCTA 마운트 + marker | 본문 첫 H2 marker 위치, observer 트리거 |
| `components/inline/InlinePriceCallout.tsx` | MODIFY | hub의 pricingFallback도 lookup | lesson-monthly id 처리 |
| `content/stories/{mixing-complete-guide,vocal-recording-guide1,band-recording-guide1}.md` | MODIFY | directive 시범 적용 | 작가 명시 위치 + 카카오톡 booking |

## 6. categoryKey → 매핑 정책

```ts
// lib/storyAutoFallback.ts
export const PRICING_BY_CATEGORY: Readonly<Record<string, string>> = {
  recording: 'recording-pro',
  vocal: 'recording-pro',
  mixing: 'mixing-level1',
  production: 'recording-daylock',
  instrument: 'recording-hourly',
  lesson: 'lesson-monthly',  // pricingFallback id (hub 재사용)
  // event/feedback/business/region → 매칭 없음 (silent skip)
};

export const REVIEW_BY_CATEGORY: Readonly<Record<string, string>> = {
  production: 'review-1',
  mixing: 'review-3',
  practice: 'review-4',
  // wedding/lesson/voice 등은 직접 매핑되는 review 없음 (silent skip)
};

export const matchPricingForCategory = (categoryKey: string): string | null =>
  PRICING_BY_CATEGORY[categoryKey] ?? null;

export const matchReviewForCategory = (categoryKey: string): string | null =>
  REVIEW_BY_CATEGORY[categoryKey] ?? null;
```

## 7. 자동 fallback inject 위치

본문에서 마지막 H2(`## ` 시작 라인)를 찾아 그 직전에 short-code 라인 + 빈 줄 inject. 이유:
- 마지막 H2는 보통 "마치며"·"스튜디오 놀 소개" 같은 wrap-up 섹션
- 그 직전 inject가 본문 흐름 자연스러움 + 사용자가 끝까지 읽기 전 박스 노출
- 모든 글이 일관되게 wrap-up H2 패턴 보유

매칭 H2 없으면 (드문 경우) 본문 끝에 append.

```ts
export const injectAutoFallbackMarker = (
  content: string,
  marker: string  // 예: '%%price:recording-pro%%'
): string => {
  const lines = content.split('\n');
  // 뒤에서부터 첫 H2 찾기
  let lastH2 = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^## /.test(lines[i])) {
      lastH2 = i;
      break;
    }
  }
  const insert = ['', marker, ''];
  if (lastH2 === -1) {
    // 매칭 H2 없으면 본문 끝
    return [...lines, ...insert].join('\n');
  }
  return [
    ...lines.slice(0, lastH2),
    ...insert,
    ...lines.slice(lastH2),
  ].join('\n');
};
```

## 8. lib/stories.ts wiring

```ts
// lib/stories.ts : getStoryDetail
import { parseInlineDirectives, decideAutoFallback } from './inlineDirectives';
import {
  matchPricingForCategory,
  matchReviewForCategory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';

// ... 기존 로직 유지 (frontmatter 파싱, content 추출 등)

const parsed = parseInlineDirectives(contentToProcess);
const matchedPriceId = matchPricingForCategory(baseStory.categoryKey);
const matchedReviewId = matchReviewForCategory(baseStory.categoryKey);
const wordCount = computeWordCount(contentToProcess, requestedLocale);  // 기존 [id].tsx wordCount 로직을 lib로 이동

const fallback = decideAutoFallback({
  authorBoxes: parsed.authorBoxes,
  presentTypes: parsed.presentTypes,
  storyCategoryKey: baseStory.categoryKey,
  wordCount,
  matchedPriceId,
  matchedReviewId,
});

let finalContent = contentToProcess;
if (fallback) {
  const marker = `%%${fallback.type}:${fallback.id}%%`;
  finalContent = injectAutoFallbackMarker(contentToProcess, marker);
}
```

ko 외 locale: 자동 fallback도 ko 기준 categoryKey로 적용 (현재 categoryKey는 locale-independent).

## 9. StickyBottomCTA 동작

- Mount: `pages/[locale]/stories/[id].tsx`의 article 컴포넌트 끝 직후
- Trigger marker: 같은 페이지에서 article 컴포넌트 **시작 직전** invisible `<div ref={markerRef} aria-hidden data-sticky-trigger />`을 둔다. 본문 markdown을 변형하지 않고 React 트리로만 marker를 배치 — article 시작 위치(대략 hero 바로 아래, 본문 첫 H2 위쪽)가 viewport 위로 올라가는 시점이 곧 사용자가 본문 읽기에 진입한 시점
- IntersectionObserver:
  - `rootMargin: '0px'`, `threshold: 0`
  - `isIntersecting=false` AND `boundingClientRect.top < 0` → marker가 viewport 위로 올라감 → sticky show
  - 그 외 (marker가 viewport 안 또는 아래) → sticky hide
- Dismiss: 닫기 버튼 → localStorage `sticky-cta-dismissed-until` = now + 24h. 페이지 마운트 시 TTL 체크
- 콘텐츠 (한국어):
  - 헤드라인: "예약·문의는 카카오톡으로"
  - primary: "카카오톡 채널로 문의" → siteConfig.contact.kakaoUrl
  - secondary: "가격 보기" → /{locale}/pricing
  - dismiss: `[X]`
- a11y: `role="region"` + `aria-label="고정 문의 바"`, focus는 막지 않음
- 모바일/데스크톱 모두 fixed bottom-4 sm:bottom-8, max-w-2xl 가운데 정렬
- 다른 locale에서도 노출 (text는 i18n key, default value Korean)

## 10. InlinePriceCallout lesson-monthly 보강

현재 InlinePriceCallout은 pricing.ts pool만 lookup. lesson 카테고리 자동 fallback이 `lesson-monthly` id로 들어오면 매칭 실패 → silent skip.

해결: InlinePriceCallout이 hub의 pricingFallback 카드(`buyerIntentHubs.ts`의 `vocal-beginners-guide.pricingFallback`)도 검색하도록 작은 변경:

```ts
import { buyerIntentHubs } from '../../data/buyerIntentHubs';

const hubFallback = Object.values(buyerIntentHubs)
  .map((h) => h.pricingFallback)
  .find((f) => f?.id === id);
if (hubFallback) {
  // hubFallback 카드 렌더 (기존 pkg lookup 결과와 같은 구조)
}
```

## 11. 데이터 흐름

```
content/stories/X.md (frontmatter + body)
        ↓
lib/stories.ts : getStoryDetail
   1. parseInlineDirectives(content) → { authorBoxes, presentTypes }
   2. matchPricing/Review(categoryKey) → matchedPriceId, matchedReviewId
   3. computeWordCount(content) → wordCount
   4. decideAutoFallback(...) → fallback or null
   5. fallback이면 injectAutoFallbackMarker(content, %%type:id%%)
        ↓
StoryDetail { content (with auto marker if any) }
        ↓
MarkdownRenderer (Phase 1 인프라 그대로 — author/auto 구분 없이 같은 처리)
        ↓
pages/[locale]/stories/[id].tsx
   <div data-sticky-trigger ref={markerRef} aria-hidden /> ← article 시작 직전
   <article>...본문 렌더...</article>
   <StickyBottomCTA markerRef={markerRef} />  ← article 끝 직후
```

## 12. 에러·falsy guard

- categoryKey 매칭 실패 → matched*Id null → decideAutoFallback null → inject 안 함 (silent)
- 매칭 H2 없음 → 본문 끝 append (안전 fallback)
- StickyCTA marker가 못 찾으면 sticky 안 보임 (silent)
- IntersectionObserver 미지원 환경 → Studio NOL 타깃 브라우저에서 100% 지원, fallback 미구현 (YAGNI)
- localStorage 차단 환경 (시크릿 모드) → dismiss 동작 안 하지만 sticky 정상 노출
- 자동 fallback이 max 2 한도와 충돌하지 않도록: decideAutoFallback이 authorBoxes 기준 판단 (Phase 1 함수가 이미 처리)
- 작가 directive와 자동 fallback이 같은 type 중복: presentTypes로 이미 차단 (Phase 1 로직)
- ko 외 locale 글: 자동 fallback도 동일 적용 (categoryKey는 locale-independent)

## 13. 테스트 계획

**lib/storyAutoFallback.test.ts (TDD)**
- matchPricingForCategory: 6 매핑 + 매칭 안 되는 카테고리 (event 등) null
- matchReviewForCategory: 3 매핑 + 매칭 안 되는 카테고리 null
- injectAutoFallbackMarker: 마지막 H2 직전 inject, 매칭 H2 없으면 끝에 append, 빈 본문 처리

**components/inline/StickyBottomCTA.test.tsx**
- IntersectionObserver mock으로 visible/hidden 토글
- dismiss 클릭 → hidden + localStorage 기록
- 페이지 mount 시 localStorage TTL 체크 (만료 안 됨이면 hidden 유지)
- TTL 만료 후 다시 노출

**lib/stories.ts (integration)**
- getStoryDetail로 categoryKey=recording 글 → 자동 fallback %%price:recording-pro%% 발현
- categoryKey=event 글 → 자동 fallback 없음
- 작가 directive 2개 있는 글 → 자동 fallback 없음 (max 2 enforce)

**빌드 산출물 검증**
- 시범 글 3편의 SSR HTML에 정확한 callout 발현
- 자동 fallback이 활성될 글 sample 5편의 HTML에 1개 박스 발현
- 누출 검사 — 매칭 안 되는 카테고리 글에 박스 없음

## 14. 시범 적용 (3편)

각 글에 `%%price:<id>%%` + `%%booking:<message>%%` 2개 directive:

| 글 | price id | booking message |
|---|---|---|
| mixing-complete-guide.md | mixing-level1 | "믹싱·마스터링 견적 문의" |
| vocal-recording-guide1.md | recording-pro | "보컬 녹음 예약 문의" |
| band-recording-guide1.md | recording-daylock | "밴드 녹음 일정 문의" |

위치는 각 글의 "비용" 또는 "패키지" 섹션 끝 (작가 의도). 자동 fallback이 같은 글에 들어오는지 검증 — 작가 directive로 max 2 채워지면 자동 안 들어감 (정상).

## 15. 성능 고려

- StickyCTA: IntersectionObserver 기반, 매 frame 계산 0 — ScrollProgress 회귀 패턴 회피
- StickyCTA bundle: dynamic import로 분리 (initial bundle 영향 0)
- 자동 fallback inject: 빌드 시 1회 (getStoryDetail 캐시) — 런타임 0
- 1,730 글 빌드 시간 영향: parseInlineDirectives + injectAutoFallbackMarker (정규식 + split/join) ≈ 글당 1-3ms × 1,730 ≈ 2~5초 추가 예상

## 16. 마이그레이션·롤백

- 자동 fallback 활성화는 lib/stories.ts에 코드 추가 — 회귀 시 호출부 제거하면 Phase 1 상태로 복원
- StickyCTA 컴포넌트는 마운트만 안 하면 미노출 — 페이지 import 제거가 즉시 롤백
- 시범 글 directive 적용은 작가 콘텐츠 — markdown 라인 제거가 즉시 롤백
- InlinePriceCallout의 hub fallback lookup 추가는 backward-compatible

## 17. 미해결 질문

없음 — 4 핵심 결정 모두 확정.
