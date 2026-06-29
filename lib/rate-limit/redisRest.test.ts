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
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => [{ result: 1 }, { result: 1 }],
    } as unknown as Response));
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

  it('increments and sets expiry atomically via a single pipeline request', async () => {
    const count = await incrWithExpire({ key: 'rate_limit_contact:fp:abc', windowSeconds: 120 });

    expect(count).toBe(1);
    // 단일 파이프라인 요청 — INCR 직후 인스턴스가 죽어 TTL 없는 키가 남는 경로를 제거.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(String(calls[0][0])).toBe('https://redis.example.com/pipeline');
    expect(calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    expect(JSON.parse(calls[0][1].body as string)).toEqual([
      ['INCR', 'rate_limit_contact:fp:abc'],
      ['EXPIRE', 'rate_limit_contact:fp:abc', '120', 'NX'],
    ]);
  });

  it('returns the INCR count for an existing bucket', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      // 기존 버킷: INCR=2, EXPIRE NX는 TTL이 이미 있어 0 반환.
      json: async () => [{ result: 2 }, { result: 0 }],
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

  it('throws when the pipeline payload is not an array', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ result: 1 }),
    } as unknown as Response));

    await expect(incrWithExpire({ key: 'rate_limit_contact:ip:127.0.0.1', windowSeconds: 900 }))
      .rejects
      .toThrow(RedisRestError);
  });
});
