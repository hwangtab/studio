import { toHeadingId } from './headings';

export interface ExtractedHeading {
  id: string;
  text: string;
  level: number;
}

// 헤딩 텍스트에서 인라인 마크다운 마커를 제거해 렌더된 텍스트와 동일한 slug를 얻는다.
// (MarkdownRenderer는 렌더된 children 텍스트로 id를 만들므로 여기서도 표시 텍스트를 복원해야
//  앵커 id가 일치한다.)
const stripInlineMarkdown = (raw: string): string =>
  raw
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
