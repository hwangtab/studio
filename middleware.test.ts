/** @jest-environment node */

describe('middleware redirects', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 307 for locale negotiation redirects', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.studionol.co.kr';

    const { NextRequest } = await import('next/server');
    const { middleware } = await import('./middleware');

    const request = new NextRequest('https://www.studionol.co.kr/', {
      headers: {
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/en');
    expect(response.headers.get('vary')).toContain('Accept-Language');
  });

  it('returns 308 for host normalization without locale negotiation', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.studionol.co.kr';
    process.env = { ...process.env, NODE_ENV: 'production' };

    const { NextRequest } = await import('next/server');
    const { middleware } = await import('./middleware');

    const request = new NextRequest('https://studionol.co.kr/ko/about');
    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/ko/about');
    expect(response.headers.get('vary')).toBeNull();
  });
});

describe('middleware bot routing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each([
    ['GPTBot/3.0 (+https://openai.com/gptbot]', 'GPTBot'],
    ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.asp)', 'facebookexternalhit'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'googlebot'],
    ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'bingbot'],
    ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://claude.com/claudebot)', 'claudebot'],
    ['PerplexityBot/0.1 (+https://perplexity.ai/perplexitybot)', 'perplexitybot'],
  ])(
    'redirects %s bot to /ko regardless of Accept-Language',
    async (userAgent, _botName) => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://www.studionol.co.kr';

      const { NextRequest } = await import('next/server');
      const { middleware } = await import('./middleware');

      // Use path WITHOUT locale prefix — bot routing only applies to uncategorized paths
      const request = new NextRequest('https://www.studionol.co.kr/stories/sample', {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': userAgent,
        },
      });

      const response = middleware(request);
      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/ko/stories/sample');
    },
  );

  it('does not redirect non-bot users via bot routing', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.studionol.co.kr';

    const { NextRequest } = await import('next/server');
    const { middleware } = await import('./middleware');

    // Non-bot on path without locale prefix → locale negotiation (307)
    const request = new NextRequest('https://www.studionol.co.kr/stories/sample', {
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });

    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/en/stories/sample');
  });
});
