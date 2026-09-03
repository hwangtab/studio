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

// 대소문자 정규화 — Vercel(리눅스)은 케이스 센서티브라 /Pricing/ → 트레일링 슬래시
// 제거 후 /ko/Pricing로 single 308되면 그 목적지가 404다(맥 로컬은 재현 안 됨).
// /KO/pricing도 소문자화 없이는 /ko/KO/pricing로 이중 프리픽스가 붙는다.
describe('middleware 대소문자 정규화 (non-production)', () => {
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

  it('trailing slash + 대문자 slug를 소문자 locale 경로로 단일 redirect', () => {
    // locale 프리픽스가 없는 요청이라 locale 협상도 함께 일어나 307(Vary)이 된다 —
    // 케이스 정규화 자체는 308 대상이지만(아래 /KO/pricing 케이스), 여기서 검증할
    // 핵심은 /ko/Pricing 같은 대문자 중간 상태를 거치지 않고 단일 redirect로 소문자
    // 목적지에 도달한다는 점이다(2-hop이면 리눅스에서 404가 난다).
    const request = new NextRequest('https://www.studionol.co.kr/Pricing/', {
      headers: { 'accept-language': 'ko' },
    });
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/ko/pricing');
  });

  it('대문자 locale 프리픽스는 이중 프리픽스 없이 소문자 locale로 308', () => {
    const request = new NextRequest('https://www.studionol.co.kr/KO/pricing');
    const response = middleware(request);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/ko/pricing');
  });

  it('쿼리스트링을 보존한다', () => {
    const request = new NextRequest('https://www.studionol.co.kr/KO/pricing?foo=Bar');
    const response = middleware(request);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/ko/pricing?foo=Bar');
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

// Next.js 빌드 산출물(_buildManifest.js, __NEXT_DATA__)에는 `/[locale]/contact` 같은
// 라우트 패턴이 URL처럼 들어 있어 스크래퍼가 이를 실제 URL로 오인해 요청한다.
// 로케일 프리픽스를 붙여주면 `/en/[locale]/contact`(404)가 만들어지고, 그 404 페이지가
// GA4 page_view를 쏴 분석 데이터를 오염시킨다(90일간 12건 관측). 또한 404 페이지의
// LanguageSwitcher가 이 깨진 URL을 클릭 가능한 링크로 재생산한다.
// → 대괄호가 든 경로는 어떤 처리보다 먼저 404로 끊는다.
describe('middleware matcher — 정적 파일 제외', () => {
  // 2026-07-28: IndexNow 키 파일(public/{KEY}.txt)이 matcher에 안 걸려 로케일
  // 프리픽스가 붙었고, /ko/{KEY}.txt로 307되면서 검색엔진이 키를 못 읽어 소유
  // 검증에 실패했다(네이버 403). 그동안 IndexNow 제출이 조용히 무효였다.
  const matcherSource = () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { config } = jest.requireActual('./middleware') as typeof import('./middleware');
    return (config.matcher as string[])[0];
  };

  const matches = (pathname: string) => {
    const source = matcherSource().replace(/^\//, '');
    return new RegExp(`^/${source}$`).test(pathname);
  };

  it('IndexNow 키 파일은 미들웨어를 타지 않는다 (로케일 프리픽스 금지)', () => {
    expect(matches('/9f2c1e8b7a4d4c62a5e3d8f1b6c9a0e4.txt')).toBe(false);
  });

  it('키를 교체해도 hex .txt면 계속 제외된다 (프로토콜상 8~128자)', () => {
    expect(matches('/abcdef0123456789.txt')).toBe(false);
    expect(matches('/0123456789abcdef0123456789abcdef0123456789abcdef.txt')).toBe(false);
  });

  it('일반 페이지는 여전히 미들웨어를 탄다', () => {
    expect(matches('/stories/unfinished-track1')).toBe(true);
    expect(matches('/pricing')).toBe(true);
  });

  it('hex가 아닌 루트 .txt는 제외 대상이 아니다', () => {
    expect(matches('/hello-world.txt')).toBe(true);
  });
});

/**
 * /admin/* 은 로케일 프리픽스를 받으면 안 되지만 보안 헤더는 받아야 한다.
 *
 * 예전에는 matcher의 negative lookahead에서 admin을 빼서 프리픽스를 막았는데,
 * 그러면 미들웨어가 아예 안 돌아 CSP·Permissions-Policy까지 함께 빠졌다.
 * next.config.mjs의 전역 헤더 블록에는 CSP가 없어서 관리자 화면만 무방비였다.
 * 이제 matcher에는 포함시키고 핸들러 초입에서 조기 반환한다 — 두 성질을 동시에
 * 만족해야 하므로 둘 다 검사한다.
 */
describe('middleware /admin — 프리픽스 없이 보안 헤더만', () => {
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

  const matches = (pathname: string) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { config } = jest.requireActual('./middleware') as typeof import('./middleware');
    const source = (config.matcher as string[])[0].replace(/^\//, '');
    return new RegExp(`^/${source}$`).test(pathname);
  };

  it('matcher에 포함된다 (미들웨어가 돌아야 헤더가 붙는다)', () => {
    expect(matches('/admin')).toBe(true);
    expect(matches('/admin/contracts')).toBe(true);
    expect(matches('/admin/contracts/abc/edit')).toBe(true);
  });

  it('CSP와 Permissions-Policy를 받는다', () => {
    const response = middleware(
      new NextRequest('https://www.studionol.co.kr/admin/contracts', {
        headers: { 'accept-language': 'ko' },
      }),
    );

    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Content-Security-Policy')).toContain("object-src 'none'");
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('로케일 프리픽스로 리다이렉트하지 않는다', () => {
    const response = middleware(
      new NextRequest('https://www.studionol.co.kr/admin/contracts', {
        headers: { 'accept-language': 'en-US,en;q=0.9' },
      }),
    );

    // 307/308이면 /en/admin/... 으로 끌려간 것이다.
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('middleware bracket path rejection (non-production)', () => {
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
    ['percent-encoded, no locale', 'https://www.studionol.co.kr/%5Blocale%5D/contact'],
    ['percent-encoded, with locale', 'https://www.studionol.co.kr/ko/%5Blocale%5D/contact'],
    ['literal brackets', 'https://www.studionol.co.kr/[locale]/about'],
    ['nested dynamic segment', 'https://www.studionol.co.kr/en/stories/category/[key]'],
  ])('returns bare 404 for bracket path (%s)', (_label, url) => {
    const request = new NextRequest(url, {
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    });

    const response = middleware(request);
    expect(response.status).toBe(404);
    // locale 프리픽스를 붙인 redirect를 절대 만들지 않는다
    expect(response.headers.get('location')).toBeNull();
  });

  it('leaves ordinary paths untouched', () => {
    const request = new NextRequest('https://www.studionol.co.kr/ko/contact');
    const response = middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
