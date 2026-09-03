import { toHeadingId } from './headings';

export interface ExtractedHeading {
  id: string;
  text: string;
  level: number;
}

// 실제 렌더 경로(마크다운 파서)는 텍스트 노드의 HTML 엔티티를 디코드한 뒤
// MarkdownRenderer가 그 결과 텍스트로 toHeadingId를 계산한다. 여기서는 raw 마크다운
// 문자열을 그대로 다루므로, 같은 결과를 얻으려면 동일한 엔티티 디코드를 직접 적용해야
// 한다(디코더가 다르면 &amp; 같은 엔티티가 있는 헤딩에서 TOC id와 실제 id가 어긋난다).
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

const decodeHtmlEntities = (raw: string): string =>
  raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const codePoint =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      if (Number.isNaN(codePoint)) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    const lower = entity.toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower)
      ? NAMED_ENTITIES[lower]
      : match;
  });

// 헤딩 텍스트에서 인라인 마크다운 마커를 제거해 렌더된 텍스트와 동일한 slug를 얻는다.
// (MarkdownRenderer는 렌더된 children 텍스트로 id를 만들므로 여기서도 표시 텍스트를 복원해야
//  앵커 id가 일치한다.)
const stripInlineMarkdown = (raw: string): string =>
  decodeHtmlEntities(raw)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 이미지 → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크 → 텍스트
    .replace(/`([^`]+)`/g, '$1') // 인라인 코드
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // 굵게
    .replace(/(\*|_)(.*?)\1/g, '$2') // 기울임
    .replace(/~~(.*?)~~/g, '$1') // 취소선
    .replace(/\s+#+\s*$/, '') // 후행 ATX 닫힘 #
    .trim();

/**
 * 마크다운 본문에서 헤딩을 추출한다. 코드펜스(``` ~~~) 내부는 건너뛴다.
 * MarkdownRenderer의 toHeadingId와 동일한 slug를 계산해 목차 앵커가 실제 헤딩 id와 일치한다.
 *
 * @param minLevel 포함할 최소 헤딩 레벨(기본 2 = `##`)
 * @param maxLevel 포함할 최대 헤딩 레벨(기본 3 = `###`)
 */
export const extractMarkdownHeadings = (
  content: string,
  { minLevel = 2, maxLevel = 3 }: { minLevel?: number; maxLevel?: number } = {}
): ExtractedHeading[] => {
  if (!content) return [];

  const lines = content.split('\n');
  const headings: ExtractedHeading[] = [];
  let inFence = false;
  let fenceMarker = '';

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      continue;
    }
    if (inFence) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (!headingMatch) continue;

    const level = headingMatch[1].length;
    if (level < minLevel || level > maxLevel) continue;

    const text = stripInlineMarkdown(headingMatch[2]);
    if (!text) continue;

    // id는 MarkdownRenderer가 DOM에 부여하는 toHeadingId와 동일해야 앵커가 작동한다.
    // 중복 텍스트 헤딩은 렌더 DOM에서도 같은 id를 가지므로 getElementById가 첫 요소로
    // 이동한다(허용 가능한 degrade). React key는 소비 측에서 index로 처리.
    headings.push({ id: toHeadingId(text), text, level });
  }

  return headings;
};
