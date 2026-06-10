/** @jest-environment node */

import { getRedisRestConfig, incrWithExpire, RedisRestError } from './redisRest';

const originalEnv = process.env;
const originalFetch = global.fetch;

describe('redisRest rate limit adapter', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KV_REST_API_URL: 'https://redis.example.com/',
      KV_REST_API_TOKEN: 'secret-token',
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ result: url.includes('/incr/') ? 1 : 1 }),
      } as unknown as Response;
    });
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('reads deployment-compatible KV_REST_API env names', () => {
    expect(getRedisRestConfig()).toEqual({
      url: 'https://redis.example.com',
      token: 'secret-token',
    });
  });

  it('increments a key and applies expiry only for a new bucket', async () => {
    const count = await incrWithExpire({ key: 'rate_limit_contact:fp:abc', windowSeconds: 120 });

    expect(count).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(String(calls[0][0])).toBe('https://redis.example.com/incr/rate_limit_contact%3Afp%3Aabc');
    expect(String(calls[1][0])).toBe('https://redis.example.com/expire/rate_limit_contact%3Afp%3Aabc/120');
    expect(calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token' },
      cache: 'no-store',
    });
  });

  it('does not refresh expiry for an existing bucket', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ result: 2 }),
    } as unknown as Response));

    const count = await incrWithExpire({ key: 'og:rl:127.0.0.1', windowSeconds: 60 });

    expect(count).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when Redis REST returns an error response', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'unavailable',
      json: async () => ({ error: 'unavailable' }),
    } as unknown as Response));

    await expect(incrWithExpire({ key: 'rate_limit_contact:ip:127.0.0.1', windowSeconds: 900 }))
      .rejects
      .toThrow(RedisRestError);
  });
});
