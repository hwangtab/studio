/** @jest-environment node */
/**
 * 마이그레이션 전 DB(표 없음)의 판정 — drizzle 0.45는 libsql 오류를 감싸 던져서 "no such table" 문구가
 * error.message가 아니라 error.cause에 있다. String(error)만 보면 놓쳐 표가 없는 정상 상황을 장애로 기록한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { loadBusinessProfile } from './businessProfile';
// eslint-disable-next-line import/first
import { isShopArtist } from './creatorEligibility';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  await client.execute('PRAGMA foreign_keys = OFF');
});

afterEach(() => {
  client.close();
  jest.restoreAllMocks();
});

it('사업자 정보 표가 없으면 unavailable이고 오류로 기록하지 않는다', async () => {
  await client.execute('DROP TABLE creator_business_profiles');
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await loadBusinessProfile('c1')).toBe('unavailable');
  expect(error).not.toHaveBeenCalled();
});

it('상점 아티스트 표가 없으면 거짓이고 오류로 기록하지 않는다', async () => {
  await client.execute('DROP TABLE shop_artists');
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await isShopArtist('c1')).toBe(false);
  expect(error).not.toHaveBeenCalled();
});

it('상점 아티스트 조회가 다른 이유로 실패하면 참(번호를 남기는 쪽)이고 기록한다', async () => {
  mockDb = { select: () => { throw new Error('connection reset'); } } as never;
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await isShopArtist('c1')).toBe(true);
  expect(error).toHaveBeenCalled();
});
