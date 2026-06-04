/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/contact/send-email';

const incrMock = jest.fn();
const expireMock = jest.fn();

jest.mock('@vercel/kv', () => ({
  kv: {
    incr: (...args: unknown[]) => incrMock(...args),
    expire: (...args: unknown[]) => expireMock(...args),
  },
}));

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

    incrMock.mockResolvedValue(1);
    expireMock.mockResolvedValue(undefined);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    } as unknown as Response);
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('uses fingerprint-based bucket when client ip is unknown', async () => {
    const req = createRequest();
    const { res, getStatus, getBody } = createResponse();

    await handler(req, res);

    expect(getStatus()).toBe(200);
    expect(getBody().success).toBe(true);
    expect(incrMock).toHaveBeenCalledTimes(1);

    const [rateLimitKey] = incrMock.mock.calls[0];
    expect(rateLimitKey).toMatch(/^rate_limit_contact:fp:[a-f0-9]{24}$/);
    expect(String(rateLimitKey)).not.toContain('unknown');
    expect(expireMock).toHaveBeenCalledWith(rateLimitKey, 120);
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
      incrMock.mockResolvedValue(1);
      expireMock.mockResolvedValue(undefined);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' } as unknown as Response);

      const req = createRequest({ body: { name, phone: '+82 10 1234 5678', email: 'test@example.com', message: 'Valid inquiry message here.', company: '' } });
      const { res, getStatus } = createResponse();
      await handler(req, res);
      expect(getStatus()).toBe(200);
    }
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
    expect(incrMock).not.toHaveBeenCalled();
  });
});
