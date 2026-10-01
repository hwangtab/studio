/**
 * 마크다운 구문을 제거하고 순수 텍스트만 추출합니다.
 */
export const stripMarkdown = (content: string | null | undefined): string => {
  if (!content) return '';

  // 파일명처럼 밑줄이 낱말 안에 들어가는 글은 본문에서 `\_`로 이스케이프해 둔다(마크다운이 이탤릭으로
  // 읽지 않게). 아래 `_…_` 제거가 그 밑줄을 먹지 않도록 가려 두었다가 끝에서 `_`로 되돌린다.
  return content
    .replace(/\\_/g, '\u0001')
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\u0001/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * 텍스트를 지정된 길이에 맞춰 요약합니다.
 * @param text 요약할 텍스트
 * @param maxLength 최대 길이
 * @param options 마크다운 제거 여부 등 옵션
 */
export function summarizeText(
  text: string | null | undefined,
  maxLength: number = 100,
  options: { stripMarkdown?: boolean } = {}
): string {
  if (!text) return '';

  const plainText = options.stripMarkdown ? stripMarkdown(text) : text;

  if (plainText.length <= maxLength) return plainText;

  const lastSpaceIndex = plainText.lastIndexOf(' ', maxLength);
  const summary = plainText.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);

  return summary + '...';
}
