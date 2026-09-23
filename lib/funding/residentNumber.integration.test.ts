/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { encryptField, FieldCryptoError, FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
// eslint-disable-next-line import/first
import { loadFundingResidentNumber } from './residentNumber';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let seq = 0;

/** 실제 번호가 아니라 형식만 같은 값이다. */
const RRN = '9901011234567';

const seed = async (over: Partial<schema.NewFundingCreator> = {}) => {
  seq += 1;
  const [creator] = await mockDb
    .insert(schema.fundingCreators)
    .values({ email: `rrn${seq}@example.com`, name: '개설자', taxType: 'withholding', ...over })
    .returning();
  const [project] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      slug: `rrn-${seq}`,
      creatorId: creator.id,
      title: '제목',
      summary: '요약',
      content: '본문',
      coverUrl: '/images/funding/demo/cover.webp',
      goalAmount: 1_000_000,
      startAt: new Date('2026-01-01T00:00:00Z'),
      endAt: new Date('2026-02-01T00:00:00Z'),
      reviewStatus: 'approved',
      status: 'auto',
    })
    .returning();
  return project;
};

let previousKey: string | undefined;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  previousKey = process.env[FIELD_CRYPTO_KEY_ENV];
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 7).toString('base64');
});

afterEach(() => {
  client.close();
  if (previousKey === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = previousKey;
});

it('등록된 번호를 복호화해 돌려준다', async () => {
  const project = await seed({ residentNumberEnc: encryptField(RRN) });
  expect(await loadFundingResidentNumber(project.id)).toBe(RRN);
});

it('등록이 없으면 null — 오류가 아니다', async () => {
  const project = await seed({ residentNumberEnc: null });
  expect(await loadFundingResidentNumber(project.id)).toBeNull();
});

it('없는 프로젝트도 null', async () => {
  expect(await loadFundingResidentNumber('없는-id')).toBeNull();
});

it('키가 바뀌었으면 auth_failed로 던진다 — 조용히 null로 접지 않는다', async () => {
  const project = await seed({ residentNumberEnc: encryptField(RRN) });
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 9).toString('base64');
  await expect(loadFundingResidentNumber(project.id)).rejects.toMatchObject({ code: 'auth_failed' });
});

it('키가 없으면 missing_key로 던진다', async () => {
  const project = await seed({ residentNumberEnc: encryptField(RRN) });
  delete process.env[FIELD_CRYPTO_KEY_ENV];
  await expect(loadFundingResidentNumber(project.id)).rejects.toBeInstanceOf(FieldCryptoError);
});
