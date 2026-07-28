/**
 * Escape user-controlled strings that are interpolated into HTML/Markdown output.
 */
export const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Escape a string for safe interpolation into Markdown table cells.
 */
export const escapeMarkdown = (unsafe: string): string =>
  unsafe
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');

/**
 * 계약서 템플릿의 표 셀에 들어가는 사용자 입력용.
 *
 * HTML 이스케이프만으로는 부족하다 — 파이프는 마크다운 표의 셀 구분자라, 이름에
 * `홍길동 | 보증금 면제 확정`을 넣으면 계약서에 없던 칸과 문구가 생긴다(법적 문서에
 * 임의 문구를 심는 경로). 개행도 표 구조를 깨뜨리므로 함께 막는다.
 */
export const escapeTableCell = (unsafe: string): string => escapeMarkdown(escapeHtml(unsafe));
