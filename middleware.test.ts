/** @jest-environment node */

// middleware.ts는 모듈 평가 시점에 process.env(NEXT_PUBLIC_SITE_URL, NODE_ENV)를
// 읽어 const로 고정한다. 따라서 다른 env 조합을 테스트하려면 jest.resetModules
// 후 동적 import가 필수 — jest.mock으로는 격리되지 않는다.
// 동일 env를 공유하는 테스트는 한 describe 블록 안에서 모듈을 한 번만 import해
// 반복 비용을 줄인다.

type MiddlewareModule = typeof import('./middleware');
type NextServerModule = typeof import('next/server');

const loadMiddleware = async (env: Record<string, string | undefined>): Promise<{
  middleware: MiddlewareModule['middleware'];
  NextRequest: NextServerModule['NextRequest'];
}> => {
  jest.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  const [{ middleware }, { NextRequest }] = await Promise.all([
    import('./middleware'),
    import('next/server'),
  ]);
  return { middleware, NextRequest };
};

describe('middleware locale negotiation (non-production)', () => {
  const originalEnv = process.env;
  let middleware: MiddlewareModule['middleware'];
  let NextRequest: NextServerModule['NextRequest'];

  beforeAll(async () => {
    ({ middleware, NextRequest } = await loadMiddleware({
      NEXT_PUBLIC_SITE_URL: 'https://www.studionol.co.kr',
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 307 for locale negotiation redirects', () => {
    const request = new NextRequest('https://www.studionol.co.kr/', {
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    });

    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/en');
    expect(response.headers.get('vary')).toContain('Accept-Language');
  });
});

describe('middleware host normalization (production)', () => {
  const originalEnv = process.env;
  let middleware: MiddlewareModule['middleware'];
  let NextRequest: NextServerModule['NextRequest'];

  beforeAll(async () => {
    ({ middleware, NextRequest } = await loadMiddleware({
      NEXT_PUBLIC_SITE_URL: 'https://www.studionol.co.kr',
      NODE_ENV: 'production',
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 308 for host normalization without locale negotiation', () => {
    const request = new NextRequest('https://studionol.co.kr/ko/about');
    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/ko/about');
    expect(response.headers.get('vary')).toBeNull();
  });
});

describe('middleware bot routing (non-production)', () => {
  const originalEnv = process.env;
  let middleware: MiddlewareModule['middleware'];
  let NextRequest: NextServerModule['NextRequest'];

  beforeAll(async () => {
    ({ middleware, NextRequest } = await loadMiddleware({
      NEXT_PUBLIC_SITE_URL: 'https://www.studionol.co.kr',
    }));
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
    (userAgent, _botName) => {
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

  it('does not redirect non-bot users via bot routing', () => {
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

describe('middleware region redirect (non-production)', () => {
  const originalEnv = process.env;
  let middleware: MiddlewareModule['middleware'];
  let NextRequest: NextServerModule['NextRequest'];
  // 맵 자체는 일반 require로 충분 — 환경에 의존하지 않는 정적 JSON.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const regionRedirectMap = require('./lib/regionRedirectMap.json') as Record<string, string>;

  beforeAll(async () => {
    ({ middleware, NextRequest } = await loadMiddleware({
      NEXT_PUBLIC_SITE_URL: 'https://www.studionol.co.kr',
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 308 for mapped region slug under /ko', () => {
    const [srcSlug, destSlug] = Object.entries(regionRedirectMap)[0];
    const request = new NextRequest(`https://www.studionol.co.kr/ko/stories/${srcSlug}`);
    const response = middleware(request);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      `https://www.studionol.co.kr/ko/stories/${destSlug}`,
    );
  });

  it('preserves non-default locale prefix when redirecting', () => {
    const [srcSlug, destSlug] = Object.entries(regionRedirectMap)[0];
    const request = new NextRequest(`https://www.studionol.co.kr/en/stories/${srcSlug}`);
    const response = middleware(request);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      `https://www.studionol.co.kr/en/stories/${destSlug}`,
    );
  });

  it('handles trailing slash on mapped slug', () => {
    const [srcSlug, destSlug] = Object.entries(regionRedirectMap)[0];
    const request = new NextRequest(`https://www.studionol.co.kr/ko/stories/${srcSlug}/`);
    const response = middleware(request);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      `https://www.studionol.co.kr/ko/stories/${destSlug}`,
    );
  });

  it('passes through unmapped story slug without redirect', () => {
    // 광역 허브 자신(seoul1)은 redirect 맵에 없어야 한다 — 자기 자신으로 가는 루프 방지
    expect(regionRedirectMap['seoul1']).toBeUndefined();
    const request = new NextRequest('https://www.studionol.co.kr/ko/stories/seoul1');
    const response = middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
