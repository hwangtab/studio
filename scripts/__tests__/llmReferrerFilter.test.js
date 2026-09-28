const { LLM_REFERRER_REGEX, LLM_REFERRER_REGEX_SOURCE } = require('../llmReferrerFilter');

describe('LLM_REFERRER_REGEX', () => {
  test.each([
    'chatgpt.com',
    'chat.openai.com',
    'perplexity.ai',
    'www.perplexity.ai',
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
  ])('%s는 LLM 레퍼러로 판정한다', (source) => {
    expect(LLM_REFERRER_REGEX.test(source)).toBe(true);
  });

  test.each([
    'google.com',
    'bing.com',
    'naver.com',
    'm.search.naver.com',
    '(direct)',
    'facebook.com',
    'chatgpt.com.evil.example',
  ])('%s는 LLM 레퍼러가 아니다', (source) => {
    expect(LLM_REFERRER_REGEX.test(source)).toBe(false);
  });

  test('GA4 stringFilter에 그대로 넘길 수 있는 문자열이다', () => {
    expect(typeof LLM_REFERRER_REGEX_SOURCE).toBe('string');
    // RE2가 지원하지 않는 lookaround·backreference가 섞이지 않았는지 확인.
    expect(LLM_REFERRER_REGEX_SOURCE).not.toMatch(/\(\?[=!<]/);
    expect(LLM_REFERRER_REGEX_SOURCE).not.toMatch(/\\[1-9]/);
  });
});
