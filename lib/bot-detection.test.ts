import { BOT_PATTERN } from './bot-detection';

describe('BOT_PATTERN', () => {
  const botCases: [string, string][] = [
    ['Claude-User/1.0', 'Claude-User/1.0'],
    ['Perplexity-User/1.0', 'Perplexity-User/1.0'],
    ['MistralAI-User/1.0', 'MistralAI-User/1.0'],
    ['Claude-SearchBot', 'Claude-SearchBot'],
    ['OAI-SearchBot', 'OAI-SearchBot'],
    ['ChatGPT-User', 'ChatGPT-User'],
    ['PerplexityBot', 'PerplexityBot'],
    ['Googlebot', 'Googlebot'],
  ];

  test.each(botCases)('matches bot UA: %s', (_label, ua) => {
    expect(BOT_PATTERN.test(ua)).toBe(true);
  });

  const humanCases: [string, string][] = [
    [
      'Chrome desktop (Windows)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    ],
    [
      'Safari iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ],
    [
      'Android WebView',
      'Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36',
    ],
    [
      // 제조사명에 "bot"이 들어간 실제 휴대폰(2026-10-22 리뷰 — 봇으로 오판해 언어 감지를 건너뛰었다)
      'Chrome on CUBOT',
      'Mozilla/5.0 (Linux; Android 13; CUBOT P80) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    ],
  ];

  test.each(humanCases)('does not match real browser UA: %s', (_label, ua) => {
    expect(BOT_PATTERN.test(ua)).toBe(false);
  });

  test('still matches generic "...Bot" crawlers', () => {
    expect(BOT_PATTERN.test('Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)')).toBe(true);
    expect(BOT_PATTERN.test('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)')).toBe(true);
  });
});
