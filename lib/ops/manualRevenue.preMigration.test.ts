/** @jest-environment node */

/**
 * 배포가 마이그레이션 0065(소프트 삭제 칸)보다 먼저 나가도 대시보드·매출 화면이 통째로 죽지 않는다 —
 * 수기 매출 조회만 실패해 `manualMissing`으로 알리고 나머지 매출은 그대로 나온다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { loadManualRevenueRows } from './manualRevenue';
import { loadRevenueSnapshot } from './revenueSnapshot';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  // 0065 이전 상태의 DB — 소프트 삭제 칸이 없다.
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && !f.startsWith('0065_')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());

it('삭제 칸이 없는 DB에서 수기 매출 조회는 던지고, 스냅샷은 manualMissing으로 견딘다', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(loadManualRevenueRows({ from: new Date('2026-09-01T00:00:00+09:00'), toExclusive: new Date('2026-10-01T00:00:00+09:00') })).rejects.toThrow();
  const snapshot = await loadRevenueSnapshot(new Date('2026-09-15T00:00:00+09:00'));
  expect(snapshot.manualMissing).toBe(true);
  expect(snapshot.net).toBe(0);
});
