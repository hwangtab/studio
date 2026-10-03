/** @jest-environment node */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest } from 'next';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import {
  normalizeIpForRateLimit,
  recordAdminLoginFailure,
  reserveAdminLoginAttempt,
  reserveDownloadIdentityAttempt,
} from './admin-rate-limit';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const text = readFileSync(path.join(MIGRATIONS, file), 'utf-8');
    for (const statement of text.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM rate_limits');
});

afterAll(() => client.close());

const reqFrom = (ip: string) =>
  ({ headers: { 'x-vercel-forwarded-for': ip }, socket: {} }) as unknown as NextApiRequest;

describe('normalizeIpForRateLimit — IPv6는 /64로 묶는다', () => {
  it('IPv4는 그대로다', () => {
    expect(normalizeIpForRateLimit('203.0.113.7')).toBe('203.0.113.7');
  });

  it('IPv4-매핑 주소는 IPv4로 본다', () => {
    expect(normalizeIpForRateLimit('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('같은 /64 안의 주소는 같은 키다', () => {
    const a = normalizeIpForRateLimit('2001:db8:abcd:12::1');
    const b = normalizeIpForRateLimit('2001:0db8:abcd:0012:ffff:ffff:ffff:ffff');
    expect(a).toBe(b);
    expect(a).toBe('2001:db8:abcd:12::/64');
  });

  it('다른 /64는 다른 키다', () => {
    expect(normalizeIpForRateLimit('2001:db8:abcd:12::1')).not.toBe(normalizeIpForRateLimit('2001:db8:abcd:13::1'));
  });
});

describe('로그인 시도 예약 — 동시 요청에도 한도를 넘지 못한다', () => {
  it('같은 IP의 동시 60건 중 한도(30)까지만 대조에 닿는다', async () => {
    const results = await Promise.all(Array.from({ length: 60 }, () => reserveAdminLoginAttempt(reqFrom('203.0.113.9'))));
    expect(results.filter(Boolean)).toHaveLength(30);
  });

  it('같은 /64의 주소를 바꿔도 한도를 새로 받지 못한다', async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => reserveAdminLoginAttempt(reqFrom(`2001:db8:abcd:12::${i + 1}`))),
    );
    expect(results.filter(Boolean)).toHaveLength(30);
  });

  it('실패 기록은 subject를 또 올리지 않는다(이중 계수 방지)', async () => {
    await reserveAdminLoginAttempt(reqFrom('203.0.113.9'));
    await recordAdminLoginFailure(reqFrom('203.0.113.9'));
    const row = (await client.execute("SELECT count FROM rate_limits WHERE key = 'admin_login:ip:203.0.113.9'")).rows[0];
    expect(row.count).toBe(1);
  });
});

describe('서명본 다운로드 본인확인 예약', () => {
  it('동시 요청도 한도(10)를 넘으면 throttled다', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => reserveDownloadIdentityAttempt('c-dl')));
    expect(results.filter((v) => v === 'ok')).toHaveLength(10);
  });
});
