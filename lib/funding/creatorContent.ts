import { INLINE_DIRECTIVE_NAMES } from '../inlineDirectives';

/**
 * 개설자 본문에서 지워야 하는 이름들.
 *
 * 이것들은 **스튜디오가 자기 글에 쓰라고 만든 신뢰 장치**다 — 가격표, 예약 버튼, 서비스
 * 목록, 후기. 개설자 글에 그대로 뜨면 읽는 쪽은 그 프로젝트에 대한 스튜디오의 보증으로
 * 읽는다. `%%price:mixing-level1%%` 한 줄이면 남의 펀딩 페이지에 우리 가격표가 뜬다.
 *
 * 화이트리스트 밖 이름은 지우지 않는다 — 렌더러가 어차피 렌더하지 않으므로 화면 결과는
 * 같고, 우리가 지우면 개설자가 쓴 글자가 말없이 사라진 것이 된다.
 *
 * MarkdownRenderer의 목록이 늘면 여기도 늘려야 한다. `creatorContent.test.ts`가
 * `INLINE_DIRECTIVE_NAMES`와의 일치를 고정한다.
 */
export const TRUSTED_SHORTCODE_NAMES: readonly string[] = [
  'online-fallback',
  'session-checklist',
  'studio-more',
  'studio-services',
  'online-request',
  'vocal-mix-bridge',
  'practice-room-terms',
  ...INLINE_DIRECTIVE_NAMES,
];

const FENCE = /^```/;

/**
 * 독립 라인의 신뢰 숏코드를 지운다.
 *
 * `contentSegments.ts`의 분리 규칙(`(?:^|\n)%%name(:arg)?%%(?=\n|$)`)과 같은 모양을 쓰되,
 * 코드 펜스 안은 건너뛴다 — 마크다운 사용법을 설명하는 글이 자기 예시를 잃으면 안 된다.
 */
export const stripTrustedDirectives = (content: string): string => {
  const lines = content.split('\n');
  const out: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (!inFence) {
      const match = /^%%([\w-]+)(?::([^%\n]+))?%%$/.exec(line.trim());
      if (match && TRUSTED_SHORTCODE_NAMES.includes(match[1])) continue;
    }
    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
