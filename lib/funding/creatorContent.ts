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

/**
 * 신뢰 숏코드가 든 줄을 지운다.
 *
 * **코드 펜스를 존중하지 않는다.** 렌더러도 존중하지 않기 때문이다 —
 * `components/markdown/contentSegments.ts`의 분리 정규식은 펜스를 모르고, 펜스 안의
 * `%%price:mixing-level1%%`도 그대로 컴포넌트로 그린다. 그러니 이쪽만 펜스를 존중하면
 * 백틱 세 개로 감싸는 것이 곧 우회가 된다.
 *
 * 잃는 것은 "마크다운 사용법을 설명하는 글이 자기 예시를 잃는 것"인데, 여기 목록은
 * 스튜디오 내부 숏코드 이름이라 펀딩 소개 글이 예시로 들 이유가 없다.
 *
 * 줄 판정은 렌더러와 **정확히 같은 모양**이다. `trim()`을 쓰지 않는다 — 렌더러는 줄 앞뒤
 * 공백을 허용하지 않아 ` %%price:x%%`를 평범한 글자로 그리는데, 이쪽만 지우면 개설자가
 * 쓴 글자가 말없이 사라진다.
 *
 * 빈 줄도 정리하지 않는다. 마크다운은 빈 줄이 둘이든 넷이든 같게 그리므로 고칠 것이 없고,
 * 한꺼번에 줄이면 코드 블록 안의 의도한 빈 줄까지 뭉갠다.
 */
export const stripTrustedDirectives = (content: string): string => {
  const LINE = /^%%([\w-]+)(?::([^%\n]+))?%%$/;
  return content
    .split('\n')
    .filter((line) => {
      const match = LINE.exec(line);
      return !(match && TRUSTED_SHORTCODE_NAMES.includes(match[1]));
    })
    .join('\n');
};
