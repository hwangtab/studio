/** @jest-environment node */

/**
 * 문의 제출 제한을 실제 SQLite(in-memory)에 대고 검증한다.
 *
 * lib/booking/rate-limit.test.ts와 같은 방식 — 모킹으로는 "인스턴스가 여러 개여도
 * 카운터가 공유되는가", "창이 지나면 리셋되는가" 같은 성질이 드러나지 않는다.
 * 이 테스트가 지키는 것은 2026-09-04에 확인된 사고다: 프로덕션에 공유 저장소가 없어
 * 메모리 폴백으로 떨어지면서 "15분에 5회"가 인스턴스마다 따로 세이고 있었다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest } from 'next';

import * as schema from '../../db/schema';
import { rateLimits } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { checkContactRateLimit, CONTACT_RATE_LIMIT_ERROR } from './rateLimit';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');

/** 신뢰하는 헤더는 x-vercel-forwarded-for 하나뿐이다(rateLimit.ts getClientIP). */
const requestFrom = (ip: string | null, headers: Record<string, string> = {}): NextApiRequest =>
  ({
    headers: { ...(ip ? { 'x-vercel-forwarded-for': ip } : {}), ...headers },
    socket: { remoteAddress: undefined },
  }) as unknown as NextApiRequest;

const submit = (req: NextApiRequest) => checkContactRateLimit(req);

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
  process.env.TURSO_DATABASE_URL = 'libsql://test';
  process.env.TURSO_AUTH_TOKEN = 'test-token';
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

afterAll(() => {
  client.close();
});

describe('checkContactRateLimit — 공유 저장소(Turso)', () => {
  it('카운터를 프로세스가 아니라 rate_limits 테이블에 남긴다', async () => {
    await submit(requestFrom('1.2.3.4'));

    const row = await mockDb.query.rateLimits.findFirst({
      where: eq(rateLimits.key, 'rate_limit_contact:ip:1.2.3.4'),
    });
    expect(row?.count).toBe(1);
  });

  it('15분 안에 5번까지는 통과하고 6번째를 막는다', async () => {
    const req = requestFrom('1.2.3.4');
    for (let i = 0; i < 5; i += 1) {
      await expect(submit(req)).resolves.toBeUndefined();
    }

    await expect(submit(req)).rejects.toThrow(CONTACT_RATE_LIMIT_ERROR.exceeded);
  });

  // 이것이 이 변경의 핵심이다. 메모리 카운터였다면 인스턴스가 갈릴 때 리셋됐다.
  it('모듈이 새로 로드돼도(=다른 인스턴스) 카운터가 이어진다', async () => {
    const req = requestFrom('1.2.3.4');
    for (let i = 0; i < 5; i += 1) await submit(req);

    jest.resetModules();
    const freshInstance = await import('./rateLimit');

    await expect(freshInstance.checkContactRateLimit(req)).rejects.toThrow(
      CONTACT_RATE_LIMIT_ERROR.exceeded,
    );
  });

  it('IP가 다르면 서로의 한도에 영향을 주지 않는다', async () => {
    const first = requestFrom('1.2.3.4');
    for (let i = 0; i < 5; i += 1) await submit(first);
    await expect(submit(first)).rejects.toThrow(CONTACT_RATE_LIMIT_ERROR.exceeded);

    await expect(submit(requestFrom('5.6.7.8'))).resolves.toBeUndefined();
  });

  it('창이 지나면 다시 받아준다', async () => {
    const req = requestFrom('1.2.3.4');
    for (let i = 0; i < 5; i += 1) await submit(req);
    await expect(submit(req)).rejects.toThrow(CONTACT_RATE_LIMIT_ERROR.exceeded);

    await mockDb.update(rateLimits).set({ expiresAt: 1 });

    await expect(submit(req)).resolves.toBeUndefined();
  });

  // IP를 못 얻으면 요청 지문으로 폴백하되 한도를 3회/2분으로 좁힌다(rateLimit.ts).
  it('IP를 못 얻으면 지문 키로 더 좁은 한도를 적용한다', async () => {
    const headers = { 'user-agent': 'bot/1.0', 'accept-language': 'ko' };
    const req = requestFrom(null, headers);

    for (let i = 0; i < 3; i += 1) await expect(submit(req)).resolves.toBeUndefined();
    await expect(submit(req)).rejects.toThrow(CONTACT_RATE_LIMIT_ERROR.exceeded);

    const rows = await mockDb.select().from(rateLimits);
    expect(rows[0].key).toMatch(/^rate_limit_contact:fp:/);
  });
});

describe('checkContactRateLimit — 저장소가 없을 때', () => {
  it('Turso 설정이 없으면 메모리 폴백으로 내려가되 여전히 제한은 건다', async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    jest.resetModules();
    const isolated = await import('./rateLimit');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const req = requestFrom('9.9.9.9');
    for (let i = 0; i < 5; i += 1) await isolated.checkContactRateLimit(req);
    await expect(isolated.checkContactRateLimit(req)).rejects.toThrow(
      CONTACT_RATE_LIMIT_ERROR.exceeded,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('in-memory limiter fallback'));
    expect(await mockDb.select().from(rateLimits)).toHaveLength(0);
    warn.mockRestore();
  });
});
