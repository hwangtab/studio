// 회전 사실(rotating facts)의 단일 소스 + 인라인 토큰 치환기.
//
// 배경: 전화번호 0507→010 전환(2026-06-10)에 4회 스윕·180+파일 수정이 들었다.
// 본문 마크다운에는 %%phone%% 토큰만 쓰고, 실제 값은 여기서만 관리한다 —
// 다음 번호 변경은 이 파일 한 줄 수정으로 끝난다.
//
// 치환은 반드시 "raw 파일을 읽는 지점"에서 일어난다 (렌더러가 아니라):
//   lib/stories.ts(페이지·RSS·llms), lib/sitemap/storyMeta.js(사이트맵),
//   scripts/generate-story-catalog.js, scripts/audit-thin-content.js,
//   scripts/content-quality-check.js, scripts/gsc-pseo-audit.mjs
// 모든 소비처가 같은 치환 텍스트를 보므로 thin-content 글자 수 판정의
// "사이트맵 제외 ⇔ noindex" 불변식이 유지된다. 새 raw 리더를 추가하면 여기도 배선할 것.
//
// 주의: 이 토큰은 인라인 텍스트 치환이다. 컴포넌트를 렌더하는 블록 shortcode
// (%%session-checklist%% 등, components/markdown/contentSegments.ts)와는 별개 계층.
// CJS인 이유: next-sitemap.config.js·scripts/*.js가 플레인 node로 실행되기 때문
// (lib/sitemap/*.js와 같은 관례). TS에서는 allowJs로 그대로 import한다.
//
// 정본 대조: docs/wiki/entities/naver-place.md (전화), lib/factGuards.ts가
// 구번호·하드코딩을 CI에서 차단한다. 값 변경 시 위키도 함께 갱신할 것.

const CANONICAL_FACTS = {
  phone: '010-4255-7893',
  phoneIntl: '+82-10-4255-7893',
};

const FACT_TOKENS = {
  '%%phone%%': CANONICAL_FACTS.phone,
  '%%phone-intl%%': CANONICAL_FACTS.phoneIntl,
};

// 정규식을 맵 키에서 파생 — 맵과 정규식을 따로 손보다 어긋나면 치환 콜백이
// undefined를 반환해 본문에 'undefined'가 박히는 사고가 나므로 반드시 파생 유지.
const FACT_TOKEN_REGEX = new RegExp(
  Object.keys(FACT_TOKENS)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);

const applyFactTokens = (text) =>
  typeof text === 'string' ? text.replace(FACT_TOKEN_REGEX, (match) => FACT_TOKENS[match]) : text;

module.exports = { CANONICAL_FACTS, FACT_TOKENS, applyFactTokens };
