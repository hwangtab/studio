import { CANONICAL_FACTS } from '../../lib/factTokens';

// 본문의 전화번호를 tap-to-call 링크로 승격한다.
//
// 왜 필요한가: 마크다운 본문은 %%phone%% 토큰을 쓰고 lib/factTokens가 파싱 전에 평문으로
// 치환한다. 그래서 스토리 86편에서 전화번호가 "010-4255-7893"이라는 글자로만 남아
// 모바일에서 탭해도 걸리지 않고 lead_click_phone도 발화하지 않았다. pSEO 트래픽이 실제로
// 착지하는 면이 스토리인데, 로컬 고객의 1순위 전환 행동인 전화가 거기서만 죽어 있던 셈이다.
//
// 치환을 factTokens 단계에서 하지 않는 이유: applyFactTokens는 frontmatter를 포함한 파일
// 전체에 적용되고 lib/stories·sitemap·audit 스크립트가 모두 그 결과를 파싱한다. 거기에
// 마크다운 링크 문법을 주입하면 title·summary 같은 메타 값이 오염된다. 그래서 본문 렌더
// 직전(autoLinkKeywords와 같은 계층)에서만 변환한다.

const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
const escapeRegexLiteral = (raw: string): string => raw.replace(REGEX_META_CHARS, '\\$&');

// 이미 링크인 곳·코드·헤딩은 건너뛴다. autoLinks.ts와 같은 정책이다 —
// 특히 [텍스트](tel:...) 안의 번호를 다시 링크로 감싸면 마크다운이 깨진다.
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

const isOffsetExcluded = (offset: number, ranges: Array<[number, number]>): boolean =>
  ranges.some(([start, end]) => offset >= start && offset < end);

/** tel: href는 하이픈·공백을 빼는 게 안전하다(일부 다이얼러가 그대로 넣으면 실패). */
const toTelHref = (display: string): string => `tel:${display.replace(/[^0-9+]/g, '')}`;

/**
 * 본문 평문 전화번호를 [번호](tel:번호)로 바꾼다. 표시 문자열은 그대로 두어
 * 사람이 읽는 형태(010-4255-7893)를 유지한다.
 */
export const linkPhoneNumbers = (text: string): string => {
  const targets = [CANONICAL_FACTS.phone, CANONICAL_FACTS.phoneIntl].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );

  let result = text;
  for (const display of targets) {
    // 매 치환마다 오프셋이 밀리므로 뒤에서부터 처리한다.
    const ranges = collectExclusionRanges(result);
    const matches = [...result.matchAll(new RegExp(escapeRegexLiteral(display), 'g'))]
      .filter((m) => typeof m.index === 'number' && !isOffsetExcluded(m.index, ranges))
      .reverse();

    for (const match of matches) {
      const at = match.index as number;
      result =
        result.slice(0, at) +
        `[${display}](${toTelHref(display)})` +
        result.slice(at + display.length);
    }
  }
  return result;
};
