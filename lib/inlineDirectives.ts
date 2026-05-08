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
