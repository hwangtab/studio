# Inline Service Integration — Design Spec

**Date**: 2026-05-08
**Status**: Approved (사용자 OK 받음 · Phase 1 진행)
**Owner**: Studio NOL (황경하)

## 1. 배경

스토리 1,730편의 본문과 사이트 서비스(가격·후기·예약·관련 작업)를 잇는 동선이 본문 끝 카드 4종(StoryCTA / RelatedPortfolioInline / RelatedStoriesSection / FAQ)에만 의지하고 있다. 본문 안에서는 자동 키워드 link 3개가 전부다. 본문 흐름을 따라 읽다가 즉시 행동(예약·문의)으로 넘어갈 수 있는 inline 통합이 부재한 상태.

한편 한 달 전 사용자가 직접 200+ 마크다운 link spam을 제거한 이력이 있다. 이번 통합은 **link spam 회귀를 막으면서** 본문 흐름과 의미적으로 맞물리는 자연스러운 발화만 추가하는 게 핵심.

## 2. 목표·비목표

**Goals**
- 본문 흐름 안에서 가격·후기·예약·서비스를 자연스럽게 노출
- 작가가 의도한 위치에 명시적으로 박스를 박을 수 있는 directive 시스템
- 작가가 명시 안 한 글에도 안전한 자동 fallback 매칭 (max 1개)
- 본문 50% 스크롤 시 sticky bottom CTA로 완독 직전 사용자 캡처
- 모든 박스에 카카오톡 연결 — siteConfig.contact.kakaoUrl 그대로 사용

**Non-goals**
- 모든 글에 자동 박스 무차별 삽입
- 새 콘텐츠(가격·후기) 작성 — 기존 reviews.ts·pricing.ts 재배선
- 다국어 directive 파싱 — ko 우선, 다른 locale은 기존 자동 link만 적용
- 카카오톡 prefill 메시지 분기 — 사용자 결정 "카톡 1" (기본 채널 URL 그대로)

## 3. 노출 한도 정책

페이지당 callout 박스 합계 **max 3개**:
- 작가 directive 박스: max 2개 (작가 의도 우선)
- 자동 fallback 박스: 작가 박스가 3개 미만일 때만 1개 추가 (가격 우선, 후기는 본문 1,000자 이상에서만)

별도 적용:
- 자동 키워드 link: 기존 3 → **5**로 한도 상향, anchor text 다양화
- Sticky bottom CTA: 페이지당 1개, dismissible (localStorage 24시간 TTL)

## 4. 아키텍처 — 4 Layer

```
Layer 4 — Sticky Bottom CTA (자동, JS scroll trigger)
   본문 50% 스크롤 → 하단 sticky 바
   카카오톡 + 가격 페이지 두 버튼, dismiss 가능

Layer 3 — 자동 키워드 link 강화 (기존 internalLinks.ts 재사용)
   MAX_AUTO_LINKS 3 → 5, anchor text 다양화

Layer 2 — 자동 fallback 박스 (페이지당 max 1)
   본문에 가격 키워드("35만원" 등) 매칭 → :::price 자동 삽입
   본문 길이 ≥ 1,000자 + 카테고리 매칭 후기 있음 → :::review 옵션
   매칭 실패 시 silent skip

Layer 1 — Markdown Directive (작가 명시, 페이지당 max 2)
   :::price{id=package-wedding}      → InlinePriceCallout
   :::review{id=review-3}            → InlineReviewCallout
   :::booking[축가 녹음 문의]        → InlineBookingCallout
   :::service{type=wedding}          → InlineServiceCallout
```

## 5. Directive 신택스

기존 markdown-to-jsx의 overrides 메커니즘을 활용한다. 사용자 정의 컴포넌트 등록.

- 작가가 본문에 `:::price{id=package-wedding}` 형태로 박스 위치를 명시
- 신택스는 `:::<type>{key=value, key2=value2}` 또는 `:::<type>[content]`
- 한 줄 단위로 인식 (multi-line 미지원, YAGNI)
- 신택스 오류 시 plain text로 떨어짐 (콘텐츠 안전)

### 예시 (wedding-song-guide1.md 시범 적용)

본문 "비용과 패키지" 섹션 끝에 추가:
```markdown
## 비용과 패키지

축가 녹음은 보통 시간 단위 대여와 올인원 패키지 두 가지로 운영됩니다. 스튜디오 놀은 후자에 집중합니다.

:::price{id=package-wedding}

이 패키지는 녹음 2시간과 보컬 튠, 믹싱·마스터링까지 한 번에 묶여 추가 비용이 없습니다.

:::booking[축가 녹음 문의드립니다]
```

## 6. 컴포넌트 명세

| 컴포넌트 | Phase | 위치 | Props | 의존 데이터 |
|---|---|---|---|---|
| `InlinePriceCallout` | 1 | components/inline/InlinePriceCallout.tsx | `id: string` | pricing.ts (specialPackages·recordingOffers·mixingOffers) |
| `InlineReviewCallout` | 1 | components/inline/InlineReviewCallout.tsx | `id: string` | reviews.ts (id 필드 신규 추가) |
| `InlineBookingCallout` | 1 | components/inline/InlineBookingCallout.tsx | `message?: string` | siteConfig.contact.kakaoUrl |
| `InlineServiceCallout` | 1 | components/inline/InlineServiceCallout.tsx | `type: 'wedding' \| 'voice' \| 'lesson' \| 'recording' \| 'practice'` | navLabels + siteConfig |
| `StickyBottomCTA` | **2** | components/inline/StickyBottomCTA.tsx | (locale prop만) | siteConfig.contact.kakaoUrl |

모든 박스의 visual language는 기존 HubLinkCallout과 동일 (bg-primary/5, border-primary/30, BookMarked icon 패턴).

## 7. 데이터 흐름

```
.md frontmatter + body
        ↓
lib/stories.ts : getStoryDetail
   - directive 마커 카운트 (max 2 enforce)
   - 자동 fallback 결정: authorBoxes < 3 일 때 가격/후기 매칭 1개 inject
        ↓
StoryDetail { content (with markers), boxLimit, autoFallback }
        ↓
components/MarkdownRenderer.tsx
   - markdown-to-jsx overrides에 4 directive 등록
   - markers를 React 컴포넌트로 치환
   - internalLinks.ts 자동 link MAX 3 → 5 적용
        ↓
pages/[locale]/stories/[id].tsx
   - 본문 렌더 + <StickyBottomCTA /> 마운트 (Phase 2)
```

## 8. 자동 fallback 로직

```ts
// lib/inlineDirectives.ts (신규)

interface DirectiveCount {
  total: number;
  byType: Record<DirectiveType, number>;
}

parseDirectives(content: string): {
  content: string;       // markers 삽입된 본문
  authorBoxes: number;   // 작가가 명시한 박스 수 (max 2 enforce — 초과는 silent drop)
  hasPriceCallout: boolean;
  hasReviewCallout: boolean;
}

// 자동 fallback (추후 Phase 2에서 활성화 — Phase 1은 인프라만)
decideAutoFallback({
  content,
  authorBoxes,
  hasPriceCallout,
  hasReviewCallout,
  storyCategoryKey,
  wordCount,
}): {
  fallbackType: 'price' | 'review' | null;
  fallbackId: string | null;
  insertAfterParagraph: number;
}

// 우선순위:
// 1. authorBoxes ≥ 3 → 자동 fallback 없음
// 2. content에 가격 패턴(/(\d{1,3}만원|\d{2,4},\d{3}원)/) 매칭 + hasPriceCallout=false
//    → pricing.ts에서 매칭되는 패키지 1개 lookup → :::price 추가
// 3. wordCount > 1000 + hasReviewCallout=false + 매칭 후기 있음
//    → reviews.ts에서 storyCategoryKey 매칭 후기 1개 lookup → :::review 추가
// 4. 둘 다 매칭 시 가격 우선 (transactional intent가 더 높음)
```

## 9. 에러·falsy guard

- directive `id`가 데이터에 없으면 silent skip (false-positive 방지)
- directive 신택스 오류 (오타·중첩) → plain text fallback
- 박스 한도 초과 시 초과분 silent drop, 작가 의도 우선 (자동 fallback이 먼저 양보)
- 다른 locale에서는 directive 토큰을 plain text로 처리 (ko만 매칭 활성화)
- StickyCTA dismissed 1회 → localStorage 24시간 TTL
- StickyCTA scroll observer는 IntersectionObserver 우선, 미지원 환경은 throttled scroll listener fallback

## 10. 카카오톡 연결

```ts
import { getSiteConfig } from '@/data/siteConfig';
const { contact: { kakaoUrl } } = getSiteConfig(locale);
```

모든 박스의 카카오톡 버튼은 동일 URL. 사용자 결정에 따라 prefill 메시지 분기 미적용.

## 11. 시범 적용 — Phase 1 스코프

**인프라 (코드)**:
- `lib/inlineDirectives.ts` 신규 — directive 파서 + decideAutoFallback **함수만** 작성. Phase 1에서는 호출하지 않고 export만 (Phase 2에서 활성화)
- `lib/inlineDirectives.test.ts` 신규 — 파서·decideAutoFallback unit test
- `components/MarkdownRenderer.tsx` 변경 — directive overrides 등록, MAX_AUTO_LINKS 3 → 5
- `data/internalLinks.ts` 변경 — anchor text variants 확장
- `components/inline/InlinePriceCallout.tsx` 신규
- `components/inline/InlineReviewCallout.tsx` 신규
- `components/inline/InlineBookingCallout.tsx` 신규
- `components/inline/InlineServiceCallout.tsx` 신규
- `data/reviews.ts` 변경 — `id` 필드 추가 (review-1 ~ review-N 형식)
- `lib/stories.ts` 변경 — getStoryDetail에서 directive 카운트 추적 (max 2 enforce)

**Phase 1에서 만들지 않는 것**:
- `StickyBottomCTA` 컴포넌트
- decideAutoFallback **호출** (함수만 export, 사용은 Phase 2에서 lib/stories.ts에 wiring)

**시범 글 directive 적용 (콘텐츠)**:
- `wedding-song-guide1.md` — 비용 섹션에 `:::price{id=package-wedding}`, 마지막에 `:::booking[축가 녹음 문의드립니다]`
- `audiobook-guide1.md` — 비용 섹션에 `:::price{id=package-voiceover}`, 후기 섹션에 `:::review{id=review-X}` (오디오북 또는 voice 카테고리 후기)

**Phase 2 (별도 spec)** — 본 문서 범위 밖:
- StickyBottomCTA 컴포넌트
- 자동 fallback 활성화 (decideAutoFallback 호출)
- 추가 글 directive 적용 (mixing-complete-guide·vocal-recording-guide1·band-recording-guide1 등)

분리 이유: StickyBottomCTA는 LCP/CLS·scroll observer 영향이 별도 risk라 Phase 1과 격리.

## 12. 테스트 계획

- `lib/inlineDirectives.test.ts` — 4종 directive 파싱, 한도 enforcement, locale 분기, 신택스 오류 fallback
- `components/MarkdownRenderer.test.tsx` 확장 — directive marker가 React 컴포넌트로 정확히 렌더되는지 snapshot
- 빌드 산출물 검증 — 시범 글 2편의 SSR HTML에 컴포넌트가 렌더되는지 grep 확인
- 누락 ID로 directive 입력 시 silent skip 동작 — unit test
- 다른 locale(en) 빌드 시 directive 토큰이 plain text로 떨어지는지 — unit test

## 13. 마이그레이션·롤백

- 신규 컴포넌트는 작가가 directive를 쓰지 않으면 활성화되지 않음 (opt-in)
- MAX_AUTO_LINKS 3 → 5는 코드 변경만으로 즉시 적용. 회귀 시 상수 되돌리면 끝
- reviews.ts에 id 필드 추가는 backward-compatible (기존 호출부에서 id 읽지 않음)
- Phase 1 롤백: 시범 글 2편의 directive 줄 제거 + 신규 import 제거

## 14. 추정 영향

- Bundle size: inline 컴포넌트 4종 ≈ 3-5 KB (gzip), MarkdownRenderer dynamic import에 합류
- 빌드 시간: directive 파싱은 마크다운 토큰 트리 한 번 더 순회 — 1,730 글에서도 ~수 초 추가 미만 예상
- LCP/CLS: 본문 안 박스라 above-the-fold 미영향. Phase 2 sticky CTA는 별도 측정

## 15. 미해결 질문

없음 — 박스 한도(B), 카카오톡(옵션 1), 스코프 분리(Phase 1·2) 모두 사용자 confirm 완료.
