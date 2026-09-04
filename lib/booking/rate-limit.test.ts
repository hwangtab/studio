/** @jest-environment node */

/**
 * consumeRateLimit을 실제 SQLite(in-memory)에서 검증한다.
 *
 * lib/contracts/identity-attempt.test.ts와 같은 방식 — 모킹으로는 "창이 지나면 리셋되는가"
 * 같은 시간 기반 성질이 잘 드러나지 않아 실제 rate_limits 테이블에 대고 돌린다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { rateLimits, webhookEvents } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { consumeRateLimit } from './rate-limit';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const KEY = 'booking_create:ip:1.2.3.4';

let client: Client;

/** 창이 이미 지나간 상황을 만든다. */
const expireWindow = async () => {
  await mockDb.update(rateLimits).set({ expiresAt: 1 }).where(eq(rateLimits.key, KEY));
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
  await client.execute('DELETE FROM webhook_events');
});

afterAll(() => {
  client.close();
});

describe('consumeRateLimit', () => {
  it('한도 이내면 계속 허용하며 카운터를 늘린다', async () => {
    expect(await consumeRateLimit(KEY, 3, 3600)).toBe(true);
    expect(await consumeRateLimit(KEY, 3, 3600)).toBe(true);
    expect(await consumeRateLimit(KEY, 3, 3600)).toBe(true);

    const row = await mockDb.query.rateLimits.findFirst({ where: eq(rateLimits.key, KEY) });
    expect(row?.count).toBe(3);
  });

  it('한도를 넘으면 false를 반환한다', async () => {
    await consumeRateLimit(KEY, 3, 3600);
    await consumeRateLimit(KEY, 3, 3600);
    await consumeRateLimit(KEY, 3, 3600);

    expect(await consumeRateLimit(KEY, 3, 3600)).toBe(false);

    const row = await mockDb.query.rateLimits.findFirst({ where: eq(rateLimits.key, KEY) });
    expect(row?.count).toBe(4);
  });

  it('창이 지나면 카운터가 리셋되어 다시 허용한다', async () => {
    await consumeRateLimit(KEY, 3, 3600);
    await consumeRateLimit(KEY, 3, 3600);
    await consumeRateLimit(KEY, 3, 3600);
    expect(await consumeRateLimit(KEY, 3, 3600)).toBe(false);

    await expireWindow();

    expect(await consumeRateLimit(KEY, 3, 3600)).toBe(true);
    const row = await mockDb.query.rateLimits.findFirst({ where: eq(rateLimits.key, KEY) });
    expect(row?.count).toBe(1);
  });

  it('키가 다르면 서로 독립적으로 센다', async () => {
    await consumeRateLimit(KEY, 1, 3600);
    expect(await consumeRateLimit(KEY, 1, 3600)).toBe(false);
    expect(await consumeRateLimit('booking_create:ip:9.9.9.9', 1, 3600)).toBe(true);
  });
});

describe('consumeRateLimit — webhook_events lazy cleanup', () => {
  const WEBHOOK_KEY = 'webhook:ip:9.9.9.9';
  const NINETY_ONE_DAYS_AGO = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
  const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it('webhook: 키로 호출하면 90일 지난 webhook_events 행을 지운다', async () => {
    await mockDb.insert(webhookEvents).values([
      { eventKey: 'old:DONE', payload: '{}', processedAt: NINETY_ONE_DAYS_AGO },
      { eventKey: 'recent:DONE', payload: '{}', processedAt: ONE_DAY_AGO },
    ]);

    await consumeRateLimit(WEBHOOK_KEY, 120, 3600);

    const rows = await mockDb.query.webhookEvents.findMany();
    expect(rows.map((r) => r.eventKey)).toEqual(['recent:DONE']);
  });

  it('webhook: 접두사가 아닌 키는 webhook_events를 건드리지 않는다', async () => {
    await mockDb
      .insert(webhookEvents)
      .values({ eventKey: 'old:DONE', payload: '{}', processedAt: NINETY_ONE_DAYS_AGO });

    await consumeRateLimit(KEY, 3, 3600);

    const rows = await mockDb.query.webhookEvents.findMany();
    expect(rows.map((r) => r.eventKey)).toEqual(['old:DONE']);
  });
});
