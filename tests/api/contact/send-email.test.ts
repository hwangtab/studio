/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/contact/send-email';

const originalEnv = process.env;
const originalFetch = global.fetch;

const createRequest = (overrides: Partial<NextApiRequest> = {}): NextApiRequest =>
  ({
    method: 'POST',
    headers: {
      origin: 'https://www.studionol.co.kr',
      referer: 'https://www.studionol.co.kr/ko/contact',
      'content-type': 'application/json',
      'user-agent': 'UnitTestBrowser/1.0',
      'accept-language': 'en-US,en;q=0.9',
    },
    body: {
      name: 'Test User',
      phone: '+82 10 1234 5678',
      email: 'test@example.com',
      message: 'This is a valid inquiry message for testing.',
      company: '',
    },
    socket: {
      remoteAddress: '',
    },
    ...overrides,
  } as unknown as NextApiRequest);

const createResponse = () => {
  let statusCode = 200;
  let jsonBody: unknown;
  const headers: Record<string, string> = {};

  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = String(value);
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonBody = payload;
      return this;
    },
  } as unknown as NextApiResponse;

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => jsonBody as Record<string, unknown>,
    getHeader: (name: string) => headers[name.toLowerCase()],
  };
};

const mockFetchForRedisAndResend = (options: { redisCount?: number; redisOk?: boolean } = {}) => {
  const { redisCount = 1, redisOk = true } = options;
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://mock-kv.local/')) {
      if (!redisOk) {
        return {
          ok: false,
          status: 500,
          text: async () => 'redis unavailable',
          json: async () => ({ error: 'redis unavailable' }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => '',
        // 파이프라인 응답: [INCR 결과, EXPIRE NX 결과].
        json: async () => [{ result: redisCount }, { result: 1 }],
      } as unknown as Response;
    }

    return {
      ok: true,
      status: 200,
      text: async () => '',
    } as unknown as Response;
  });
};

describe('contact send-email api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SITE_URL: 'https://www.studionol.co.kr',
      KV_REST_API_URL: 'https://mock-kv.local',
      KV_REST_API_TOKEN: 'mock-token',
      RESEND_API_KEY: 're_test_key',
    };

    mockFetchForRedisAndResend();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('rejects non-POST requests with an Allow header', async () => {
    const req = createRequest({ method: 'GET' });
    const { res, getStatus, getBody, getHeader } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(405);
    expect(getHeader('allow')).toBe('POST');
    expect(getBody().message).toBe('Method not allowed');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses fingerprint-based bucket when client ip is unknown', async () => {
    const req = createRequest();
    const { res, getStatus, getBody } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(200);
    expect(getBody().success).toBe(true);

    const pipelineCall = (global.fetch as jest.Mock).mock.calls.find(([input]) =>
      String(input).startsWith('https://mock-kv.local/pipeline')
    );
    expect(pipelineCall).toBeDefined();

    const commands = JSON.parse(pipelineCall![1].body as string) as string[][];
    const [incrCmd, expireCmd] = commands;
    expect(incrCmd[0]).toBe('INCR');
    expect(expireCmd[0]).toBe('EXPIRE');

    const rateLimitKey = incrCmd[1];
    expect(rateLimitKey).toMatch(/^rate_limit_contact:fp:[a-f0-9]{24}$/);
    expect(rateLimitKey).not.toContain('unknown');
    expect(expireCmd[1]).toBe(rateLimitKey);
    expect(expireCmd[2]).toBe('120');
    expect(expireCmd[3]).toBe('NX');
  });

  it('accepts English names with periods and commas (Dr. Smith, Smith Jr.)', async () => {
    const testCases = [
      { name: 'Dr. Smith', desc: 'title with period' },
      { name: 'John A. Smith', desc: 'middle initial' },
      { name: 'Smith, John', desc: 'inverted name with comma' },
      { name: 'Mary-Jane O\'Brien Jr.', desc: 'complex name' },
    ];

    for (const { name } of testCases) {
      jest.clearAllMocks();
      mockFetchForRedisAndResend();

      const req = createRequest({ body: { name, phone: '+82 10 1234 5678', email: 'test@example.com', message: 'Valid inquiry message here.', company: '' } });
      const { res, getStatus } = createResponse();
      await handler(req, res);
      expect(getStatus()).toBe(200);
    }
  });

  it('uses the current phone number in the delivered email html', async () => {
    const req = createRequest();
    const { res, getStatus } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(200);
    const resendCall = (global.fetch as jest.Mock).mock.calls.find(([input]) =>
      String(input).startsWith('https://api.resend.com/')
    );
    expect(resendCall).toBeDefined();

    const body = JSON.parse(String(resendCall?.[1]?.body)) as { html?: string };
    expect(body.html).toContain('010-4255-7893');
    expect(body.html).toContain('href="tel:01042557893"');
    expect(body.html).not.toContain('050713843144');
  });

  it('returns 403 for disallowed origins before rate limiting', async () => {
    const req = createRequest({
      headers: {
        origin: 'https://evil.example',
        referer: 'https://evil.example/form',
        'content-type': 'application/json',
      } as NextApiRequest['headers'],
    });
    const { res, getStatus, getBody } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(403);
    expect(getBody().message).toBe('Forbidden');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 503 when configured Redis REST rate limiting fails', async () => {
    mockFetchForRedisAndResend({ redisOk: false });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const req = createRequest();
    const { res, getStatus, getBody } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(503);
    expect(getBody().message).toBe('Service temporarily unavailable. Please try again later.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('returns 429 before email delivery when the rate limit is exceeded', async () => {
    mockFetchForRedisAndResend({ redisCount: 6 });
    const req = createRequest();
    const { res, getStatus, getBody } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(429);
    expect(getBody().message).toBe('Too many requests. Please try again later.');
    const fetchCalls = (global.fetch as jest.Mock).mock.calls.map(([input]) => String(input));
    expect(fetchCalls.some((url) => url.startsWith('https://api.resend.com/'))).toBe(false);
  });

  it('falls back to in-memory rate limiting when Redis REST is not configured', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const req = createRequest({
      headers: {
        origin: 'https://www.studionol.co.kr',
        referer: 'https://www.studionol.co.kr/ko/contact',
        'content-type': 'application/json',
        'user-agent': 'UnitTestBrowser/InMemoryFallback',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const { res, getStatus, getBody } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(200);
    expect(getBody().success).toBe(true);
    const fetchCalls = (global.fetch as jest.Mock).mock.calls.map(([input]) => String(input));
    expect(fetchCalls.some((url) => url.startsWith('https://mock-kv.local/'))).toBe(false);
    expect(fetchCalls.some((url) => url.startsWith('https://api.resend.com/'))).toBe(true);
    warnSpy.mockRestore();
  });
});
