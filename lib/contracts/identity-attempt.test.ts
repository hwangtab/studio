/** @jest-environment node */

/**
 * 본인 확인 시도 제한을 실제 SQLite(in-memory)에서 검증한다.
 *
 * 이 제한의 핵심은 "창이 지나도 누적은 남는가"다. 창 단위 제한만 있으면 15분마다 카운터가
 * 0이 되고, 링크 유효기간 7일이면 6,700번을 시도할 수 있다 — 네 자리 조합의 3분의 2다.
 * 모킹으로는 이 성질이 검증되지 않아 실제 테이블에 대고 돌린다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { rateLimits } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { checkIdentityAttempt, resetIdentityAttempts } from './admin-rate-limit';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const CONTRACT = 'c1';
const WINDOW_KEY = `sign_identity:${CONTRACT}`;
const TOTAL_KEY = `sign_identity_total:${CONTRACT}`;

let client: Client;

/** 15분이 지나간 상황 — 창 카운터만 만료시킨다. */
const passWindow = async () => {
  await mockDb.update(rateLimits).set({ expiresAt: 1 }).where(eq(rateLimits.key, WINDOW_KEY));
};

const attempt = () => checkIdentityAttempt(CONTRACT);

const attemptTimes = async (times: number) => {
  const verdicts = [];
  for (let i = 0; i < times; i += 1) verdicts.push(await attempt());
  return verdicts;
};

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

afterAll(() => {
  client.close();
});

describe('본인 확인 시도 제한', () => {
  it('창 안에서 10회까지는 통과시킨다', async () => {
    expect(await attemptTimes(10)).toEqual(Array(10).fill('ok'));
  });

  it('11회째부터 창 제한에 걸린다', async () => {
    await attemptTimes(10);
    expect(await attempt()).toBe('throttled');
  });

  /**
   * 이번 수정의 핵심. 창이 새로 열려도 누적은 이어진다.
   */
  it('창이 지나도 누적 시도는 이어서 센다', async () => {
    await attemptTimes(10);
    await passWindow();

    // 새 창이 열려 창 제한은 풀린다.
    expect(await attempt()).toBe('ok');

    const total = await mockDb.query.rateLimits.findFirst({ where: eq(rateLimits.key, TOTAL_KEY) });
    expect(total?.count).toBe(11);
  });

  it('누적 20회를 넘으면 잠근다 — 창을 아무리 새로 열어도', async () => {
    let verdicts: string[] = [];
    // 창을 계속 갈아 끼우며 시도한다. 창 제한만 있었다면 전부 통과했을 경로다.
    for (let round = 0; round < 3; round += 1) {
      verdicts = verdicts.concat(await attemptTimes(10));
      await passWindow();
    }

    expect(verdicts.slice(0, 20)).not.toContain('locked');
    expect(verdicts[20]).toBe('locked');
    expect(verdicts.slice(20)).toEqual(Array(10).fill('locked'));
  });

  it('네 자리 조합(1만 개)에 한참 못 미치는 지점에서 막힌다', async () => {
    const verdicts = await attemptTimes(25);
    const allowed = verdicts.filter((v) => v === 'ok').length;

    // 20번 안에 네 자리를 맞힐 확률은 0.2%다.
    expect(allowed).toBeLessThanOrEqual(20);
  });

  describe('잠금 해제', () => {
    it('재발송(시도 기록 삭제) 후 다시 처음부터', async () => {
      for (let round = 0; round < 3; round += 1) {
        await attemptTimes(10);
        await passWindow();
      }
      expect(await attempt()).toBe('locked');

      await resetIdentityAttempts(CONTRACT);

      expect(await attempt()).toBe('ok');
      const total = await mockDb.query.rateLimits.findFirst({
        where: eq(rateLimits.key, TOTAL_KEY),
      });
      expect(total?.count).toBe(1);
    });

    it('본인 확인에 성공하면 창·누적 카운터가 모두 지워진다', async () => {
      await attemptTimes(5);
      await resetIdentityAttempts(CONTRACT);

      expect(
        await mockDb.query.rateLimits.findFirst({ where: eq(rateLimits.key, WINDOW_KEY) }),
      ).toBeUndefined();
      expect(
        await mockDb.query.rateLimits.findFirst({ where: eq(rateLimits.key, TOTAL_KEY) }),
      ).toBeUndefined();
    });
  });

  it('계약마다 따로 센다 — 한 건이 잠겨도 다른 계약은 멀쩡하다', async () => {
    for (let round = 0; round < 3; round += 1) {
      await attemptTimes(10);
      await passWindow();
    }
    expect(await attempt()).toBe('locked');
    expect(await checkIdentityAttempt('other-contract')).toBe('ok');
  });
});
