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
    process.env.NODE_ENV = 'production';

    const { NextRequest } = await import('next/server');
    const { middleware } = await import('./middleware');

    const request = new NextRequest('https://studionol.co.kr/ko/about');
    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://www.studionol.co.kr/ko/about');
    expect(response.headers.get('vary')).toBeNull();
  });
});
