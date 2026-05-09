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

export const MAX_TOTAL_BOXES = 3;
export const REVIEW_FALLBACK_MIN_WORDCOUNT = 1000;

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
