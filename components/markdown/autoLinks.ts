import { MAX_AUTO_LINKS, topicLinks } from '../../data/internalLinks';
import { buyerIntentHubSlugs } from '../../data/buyerIntentHubs';

// topicLinks의 대상 slug 중 buyerIntentHub에 등재된 것은 /guides/ 라우트(ko 전용 SSG),
// 나머지는 /stories/ 라우트다. 종류 판별은 하드코딩 목록이 아니라 hub 등재 여부로 한다.
const HUB_SLUGS = new Set<string>(buyerIntentHubSlugs);

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
 *
 * 대상 slug가 buyerIntentHub면 /guides/, 아니면 /stories/로 라우팅합니다.
 * guides는 ko 전용 SSG라 ko 외 locale 본문에서는 hub 링크를 삽입하지 않습니다.
 */
export const autoLinkKeywords = (text: string, currentSlug?: string, locale: string = 'ko'): string => {
  let result = text;
  let count = 0;
  const linkedSlugs = new Set<string>();
  const sortedKeywords = Object.keys(topicLinks).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    if (count >= MAX_AUTO_LINKS) break;
    const { slug, anchorText } = topicLinks[keyword];
    if (slug === currentSlug || linkedSlugs.has(slug)) continue;

    // buyerIntentHub은 /guides/ 라우트이며 ko에서만 SSG된다. 다른 locale 본문에
    // 삽입하면 404가 되므로 건너뛴다.
    const isHub = HUB_SLUGS.has(slug);
    if (isHub && locale !== 'ko') continue;
    const basePath = isHub ? '/guides/' : '/stories/';

    const exclusionRanges = collectExclusionRanges(result);
    const re = new RegExp(escapeRegexLiteral(keyword), 'g');

    for (const match of result.matchAll(re)) {
      if (typeof match.index !== 'number') continue;
      if (isOffsetExcluded(match.index, exclusionRanges)) continue;

      result = result.slice(0, match.index) +
        `[${anchorText}](${basePath}${slug})` +
        result.slice(match.index + keyword.length);
      linkedSlugs.add(slug);
      count += 1;
      break;
    }
  }

  return result;
};
