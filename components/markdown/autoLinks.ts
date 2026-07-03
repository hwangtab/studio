import { MAX_AUTO_LINKS, topicLinks } from '../../data/internalLinks';

const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
const escapeRegexLiteral = (raw: string): string => raw.replace(REGEX_META_CHARS, '\\$&');

// 자동 링크 삽입에서 제외할 본문 영역(이미 링크인 곳, 코드 펜스, 인라인 코드, 헤딩 줄).
// 헤딩 줄을 제외하는 이유: 헤딩 안에 링크가 주입되면 렌더 헤딩 텍스트가 원문과 달라져
// 헤딩 id(및 이를 참조하는 목차·딥링크 앵커)가 어긋난다. UX상으로도 헤딩 속 링크는 부자연.
const EXCLUSION_PATTERNS: RegExp[] = [
  /!?\[[^\]\n]*\]\([^)\n]*\)/g,
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /^#{1,6}[^\n]*/gm,
];

const collectExclusionRanges = (text: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = [];
  for (const pattern of EXCLUSION_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (typeof match.index === 'number') {
        ranges.push([match.index, match.index + match[0].length]);
      }
    }
  }
  return ranges;
};

const isOffsetExcluded = (offset: number, ranges: Array<[number, number]>): boolean => (
  ranges.some(([start, end]) => offset >= start && offset < end)
);

/**
 * 본문에서 topicLinks 키워드의 첫 유효 등장만 내부 링크로 변환합니다.
 * 기존 링크/이미지/코드 영역과 자기 자신 slug는 건너뜁니다.
 */
export const autoLinkKeywords = (text: string, currentSlug?: string): string => {
  let result = text;
  let count = 0;
  const linkedSlugs = new Set<string>();
  const sortedKeywords = Object.keys(topicLinks).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    if (count >= MAX_AUTO_LINKS) break;
    const { slug, anchorText } = topicLinks[keyword];
    if (slug === currentSlug || linkedSlugs.has(slug)) continue;

    const exclusionRanges = collectExclusionRanges(result);
    const re = new RegExp(escapeRegexLiteral(keyword), 'g');

    for (const match of result.matchAll(re)) {
      if (typeof match.index !== 'number') continue;
      if (isOffsetExcluded(match.index, exclusionRanges)) continue;

      result = result.slice(0, match.index) +
        `[${anchorText}](/stories/${slug})` +
        result.slice(match.index + keyword.length);
      linkedSlugs.add(slug);
      count += 1;
      break;
    }
  }

  return result;
};
