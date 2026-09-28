// LLM 리퍼러 판정 — GA4 sessionSource가 AI 챗봇/어시스턴트에서 왔는지 판별하는 정규식.
//
// 2026-09-28: inListFilter 정확 일치 6종(chatgpt.com, perplexity.ai, perplexity,
// copilot.com, gemini.google.com, notebooklm.google.com)에서 FULL_REGEXP로 교체했다.
// 정확 일치는 claude.ai, chat.openai.com, copilot.microsoft.com, www.perplexity.ai 같은
// 서브도메인·별칭을 전부 놓쳤다 — GA4가 sessionSource에 실제로 어떤 문자열을 넣는지는
// 브라우저·앱마다 다르고(예: 데스크톱 Perplexity 앱은 "perplexity", 웹은 "perplexity.ai"
// 또는 "www.perplexity.ai"), 정확 일치 목록은 그 변주를 하나씩 手동 등재해야 하는 구조다.
//
// 이 파일이 scripts/ga4-fetch.mjs와 그 테스트(llmReferrerFilter.test.js)의 유일한 출처다.
// 목록을 늘릴 땐 여기 하나만 고치면 된다.
//
// 패턴: (도메인 전체 일치) 또는 (임의의 서브도메인 접두사 + '.' + 도메인).
// GA4 stringFilter matchType FULL_REGEXP는 RE2 문법이며 전체 문자열 일치를 요구한다 —
// 이 정규식에 이미 박아 둔 ^/$ 앵커는 FULL_REGEXP 모드에서는 사실상 중복이지만(RE2의
// FullMatch가 어차피 전체 일치를 강제한다), JS RegExp로 로컬에서 테스트할 때도 같은
// "전체 문자열 일치" 동작을 내도록 일부러 남겨 뒀다 — GA4 밖에서 이 상수를 재사용해도
// 같은 판정 기준을 유지하기 위함이다.
const LLM_REFERRER_DOMAINS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'perplexity',
  'claude.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'copilot.com',
  'notebooklm.google.com',
  'grok.com',
  'chat.deepseek.com',
  'chat.mistral.ai',
  'meta.ai',
];

const escapedDomains = LLM_REFERRER_DOMAINS.map((d) => d.replace(/\./g, '\\.')).join('|');

// GA4 dimensionFilter.stringFilter.value로 그대로 넘기는 문자열 패턴(RE2).
const LLM_REFERRER_REGEX_SOURCE = `(^|.*\\.)(${escapedDomains})$`;

// 로컬 검증·테스트용 JS RegExp — 위 소스 문자열과 동일한 판정을 낸다.
const LLM_REFERRER_REGEX = new RegExp(LLM_REFERRER_REGEX_SOURCE);

module.exports = {
  LLM_REFERRER_DOMAINS,
  LLM_REFERRER_REGEX_SOURCE,
  LLM_REFERRER_REGEX,
};
