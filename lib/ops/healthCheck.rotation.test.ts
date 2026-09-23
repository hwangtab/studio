/** @jest-environment node */
/**
 * 회전이 중간에 멈춘 상태를 매일 크론이 잡는지. `checkFieldCryptoKey`는 같은 키로 왕복만
 * 찌르므로 절반만 회전된 DB에서도 통과한다 — 그 구멍을 메우는 점검이다.
 *
 * 핵심 성질: **복호화하지 않는다.** keyId(앞 11글자)만 본다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { createCipheriv, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/** 복호화 호출을 센다 — 이 점검은 keyId만 읽어야 한다. */
const mockDecryptCalls = jest.fn();
jest.mock('../crypto/fieldCrypto', () => {
  const actual = jest.requireActual('../crypto/fieldCrypto');
  return {
    ...actual,
    decryptField: (...args: unknown[]) => { mockDecryptCalls(); return actual.decryptField(...args); },
    decryptFieldWithKey: (...args: unknown[]) => { mockDecryptCalls(); return actual.decryptFieldWithKey(...args); },
  };
});

// eslint-disable-next-line import/first
import { FIELD_CRYPTO_KEY_ENV, encryptFieldWithKey } from '../crypto/fieldCrypto';
// eslint-disable-next-line import/first
import { checkFieldKeyRotationPending, formatHealthReport } from './healthCheck';
const OLD_KEY_ENV = 'FUNDING_FIELD_KEY_OLD';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let seq = 0;

const CURRENT = Buffer.alloc(32, 4);
const PREVIOUS = Buffer.alloc(32, 5);

/** 주민등록번호 형태가 아닌 임의 문자열. */
const SECRET = 'oscar-papa-quebec';

const makeV1 = (key: Buffer): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(SECRET, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
};

const seedCreator = async (enc: string | null) => {
  seq += 1;
  await mockDb
    .insert(schema.fundingCreators)
    .values({ email: `rot-health${seq}@example.com`, name: '개설자', taxType: 'withholding', residentNumberEnc: enc });
};

const originalKey = process.env[FIELD_CRYPTO_KEY_ENV];
const originalOld = process.env[OLD_KEY_ENV];

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  process.env[FIELD_CRYPTO_KEY_ENV] = CURRENT.toString('base64');
  delete process.env[OLD_KEY_ENV];
  mockDecryptCalls.mockClear();
});

afterEach(() => {
  client.close();
  if (originalKey === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = originalKey;
  if (originalOld === undefined) delete process.env[OLD_KEY_ENV];
  else process.env[OLD_KEY_ENV] = originalOld;
});

it('전부 지금 키면 아무것도 보고하지 않는다', async () => {
  await seedCreator(encryptFieldWithKey(SECRET, CURRENT));
  await seedCreator(encryptFieldWithKey(SECRET, CURRENT));
  await seedCreator(null); // 값이 없는 행은 세지 않는다
  expect(await checkFieldKeyRotationPending()).toBeNull();
});

it('옛 키로 잠긴 행을 센다 — 개수가 맞는다', async () => {
  await seedCreator(encryptFieldWithKey(SECRET, CURRENT));
  await seedCreator(encryptFieldWithKey(SECRET, PREVIOUS));
  await seedCreator(encryptFieldWithKey(SECRET, PREVIOUS));

  const issue = (await checkFieldKeyRotationPending())!;
  expect(issue.title).toContain('2건');
  expect(issue.detail).toContain('funding_creators.resident_number_enc: 2건');
});

it('판본 v1 행도 센다 — 남아 있으면 안 되는 값이다', async () => {
  await seedCreator(makeV1(CURRENT));
  const issue = (await checkFieldKeyRotationPending())!;
  expect(issue.title).toContain('1건');
});

describe('문구는 두 경우를 가른다', () => {
  beforeEach(async () => {
    await seedCreator(encryptFieldWithKey(SECRET, PREVIOUS));
  });

  it('옛 키가 환경에 있으면 "회전 진행 중" — 정상 경과다', async () => {
    process.env[OLD_KEY_ENV] = PREVIOUS.toString('base64');
    const issue = (await checkFieldKeyRotationPending())!;
    expect(issue.severity).toBe('medium');
    expect(issue.title).toContain('회전이 진행 중');
    expect(issue.detail).toContain('rotate-field-key');
    expect(issue.detail).toContain(`${OLD_KEY_ENV}를 지우지 마세요`);
  });

  it('옛 키가 없으면 긴급 — 옛 키를 되찾는 것이 먼저다', async () => {
    const issue = (await checkFieldKeyRotationPending())!;
    expect(issue.severity).toBe('high');
    expect(issue.title).toContain('옛 키가 환경에 없습니다');
    expect(issue.detail).toContain('옛 키를 되찾을 수 있는지부터');
    expect(issue.detail).not.toContain('회전이 진행 중');
  });
});

it('복호화를 시도하지 않는다 — keyId만 읽는다', async () => {
  await seedCreator(encryptFieldWithKey(SECRET, PREVIOUS));
  await seedCreator(encryptFieldWithKey(SECRET, CURRENT));

  expect(await checkFieldKeyRotationPending()).not.toBeNull();

  expect(mockDecryptCalls).not.toHaveBeenCalled();
});

it('키가 없으면 비교 기준이 없으므로 건너뛴다 — 그 상태는 키 점검이 이미 보고한다', async () => {
  await seedCreator(encryptFieldWithKey(SECRET, PREVIOUS));
  delete process.env[FIELD_CRYPTO_KEY_ENV];
  expect(await checkFieldKeyRotationPending()).toBeNull();
});

it('메일 본문에 값·키·암호문이 실리지 않는다 — 개수와 대상 이름만', async () => {
  const stored = encryptFieldWithKey(SECRET, PREVIOUS);
  await seedCreator(stored);
  process.env[OLD_KEY_ENV] = PREVIOUS.toString('base64');

  const issue = (await checkFieldKeyRotationPending())!;
  const text = formatHealthReport({ issues: [issue], checkedAt: new Date('2026-09-23T00:00:00Z') });

  expect(text).toContain('1건');
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain(stored.split(':')[4]);
  expect(text).not.toContain(CURRENT.toString('base64'));
  expect(text).not.toContain(PREVIOUS.toString('base64'));
});
