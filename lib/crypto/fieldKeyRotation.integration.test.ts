/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { createCipheriv, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { decryptFieldWithKey, deriveKeyId, encryptFieldWithKey } from './fieldCrypto';
// eslint-disable-next-line import/first
import { ENCRYPTED_FIELD_TARGETS, rotateFieldKey } from './fieldKeyRotation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let seq = 0;

const OLD_KEY = Buffer.alloc(32, 3);
const NEW_KEY = Buffer.alloc(32, 9);

/** 주민등록번호 형태가 아닌 임의 문자열만 쓴다. */
const secretOf = (n: number) => `sierra-tango-${n}`;

/** 판본 v1 값 — 운영 DB에 이미 들어 있는 형식이라 회전이 이것부터 받아야 한다. */
const makeV1 = (plaintext: string, key: Buffer): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
};

const seedCreator = async (enc: string | null): Promise<string> => {
  seq += 1;
  const [creator] = await mockDb
    .insert(schema.fundingCreators)
    .values({ email: `rot${seq}@example.com`, name: '개설자', taxType: 'withholding', residentNumberEnc: enc })
    .returning();
  return creator.id;
};

const storedOf = async (id: string): Promise<string | null> => {
  const [row] = await mockDb
    .select({ enc: schema.fundingCreators.residentNumberEnc })
    .from(schema.fundingCreators)
    .where(eq(schema.fundingCreators.id, id));
  return row?.enc ?? null;
};

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => {
  client.close();
});

/**
 * **대상 목록의 모든 타깃을 실제로 한 행씩 회전시킨다.**
 *
 * label만 확인하는 테스트로는 `valueColumn`(읽는 컬럼)과 `valueField`(쓰는 SET 키)가
 * 갈린 것을 못 잡는다 — 갈리면 A를 읽어 B에 쓰고, 값 두 개를 한 번에 잃는다.
 * 새 암호화 필드를 목록에 더하면 여기 seeder도 함께 더해야 한다(없으면 아래 테스트가 선다).
 */
const SEEDERS: Record<string, (enc: string) => Promise<string>> = {
  'funding_creators.resident_number_enc': (enc) => seedCreator(enc),
};

it('모든 타깃에 seeder가 있다 — 목록에 더하고 검증을 빠뜨리면 여기서 선다', () => {
  expect(ENCRYPTED_FIELD_TARGETS.map((t) => t.label).sort()).toEqual(Object.keys(SEEDERS).sort());
});

describe.each(ENCRYPTED_FIELD_TARGETS.map((t) => [t.label, t] as const))('대상 %s', (label, target) => {
  it('읽은 컬럼과 쓰는 컬럼이 같다', () => {
    const table = target.table as unknown as Record<string, unknown>;
    expect(table[target.valueField]).toBe(target.valueColumn);
  });

  it('실제로 한 행이 새 키로 다시 잠긴다', async () => {
    const secret = `target-${label}`;
    const id = await SEEDERS[label](encryptFieldWithKey(secret, OLD_KEY));

    const summary = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true, targets: [target] });
    expect(summary).toMatchObject({ rotated: 1, skipped: 0, failed: 0 });

    const [row] = await mockDb
      .select({ value: target.valueColumn })
      .from(target.table)
      .where(eq(target.idColumn, id));
    expect(decryptFieldWithKey(String(row.value), NEW_KEY)).toBe(secret);
  });
});

describe('dry-run', () => {
  it('기본값은 dry-run이고 아무것도 쓰지 않는다', async () => {
    const id = await seedCreator(encryptFieldWithKey(secretOf(1), OLD_KEY));
    const before = await storedOf(id);

    const summary = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY });

    expect(summary.apply).toBe(false);
    expect(summary.rotated).toBe(1);
    expect(summary.failed).toBe(0);
    expect(await storedOf(id)).toBe(before);
    // 옛 키로 여전히 열린다 = 손대지 않았다.
    expect(decryptFieldWithKey(before as string, OLD_KEY)).toBe(secretOf(1));
  });
});

describe('--apply', () => {
  it('옛 키 v2 값과 v1 값을 모두 새 키로 다시 잠근다', async () => {
    const v2Id = await seedCreator(encryptFieldWithKey(secretOf(2), OLD_KEY));
    const v1Id = await seedCreator(makeV1(secretOf(3), OLD_KEY));
    await seedCreator(null); // 값이 없는 행은 아예 대상이 아니다

    const summary = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true });

    expect(summary).toMatchObject({ apply: true, rotated: 2, skipped: 0, failed: 0 });
    expect(summary.byTarget[0]).toMatchObject({ scanned: 2, rotated: 2 });

    for (const [id, secret] of [[v2Id, secretOf(2)], [v1Id, secretOf(3)]] as const) {
      const stored = (await storedOf(id)) as string;
      expect(stored.split(':')[0]).toBe('v2');
      expect(stored.split(':')[1]).toBe(deriveKeyId(NEW_KEY));
      expect(decryptFieldWithKey(stored, NEW_KEY)).toBe(secret);
    }
  });

  it('재실행하면 이미 새 키인 행을 건너뛴다 — 두 번 돌려도 안전하다', async () => {
    const id = await seedCreator(encryptFieldWithKey(secretOf(4), OLD_KEY));
    await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true });
    const afterFirst = await storedOf(id);

    const second = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true });

    expect(second).toMatchObject({ rotated: 0, skipped: 1, failed: 0 });
    // 건너뛴 행은 재암호화되지 않는다 — 문자열이 그대로다.
    expect(await storedOf(id)).toBe(afterFirst);
  });

  it('중단된 회전을 이어서 돌린다 — 남은 행만 바뀐다', async () => {
    const done = await seedCreator(encryptFieldWithKey(secretOf(5), NEW_KEY));
    const left = await seedCreator(encryptFieldWithKey(secretOf(6), OLD_KEY));
    const doneBefore = await storedOf(done);

    const summary = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true });

    expect(summary).toMatchObject({ rotated: 1, skipped: 1, failed: 0 });
    expect(await storedOf(done)).toBe(doneBefore);
    expect(decryptFieldWithKey((await storedOf(left)) as string, NEW_KEY)).toBe(secretOf(6));
  });
});

describe('한 행이 실패해도 멈추지 않는다', () => {
  it('손상된 값·모르는 키·형식 위반이 섞여 있어도 나머지를 끝까지 돈다', async () => {
    const good = await seedCreator(encryptFieldWithKey(secretOf(7), OLD_KEY));

    const tampered = encryptFieldWithKey(secretOf(8), OLD_KEY).split(':');
    const bytes = Buffer.from(tampered[4], 'base64');
    bytes[0] ^= 0xff;
    tampered[4] = bytes.toString('base64');
    const brokenId = await seedCreator(tampered.join(':'));

    const strangerId = await seedCreator(encryptFieldWithKey(secretOf(9), Buffer.alloc(32, 1)));
    const plainId = await seedCreator('이건 암호문이 아니다');
    const good2 = await seedCreator(encryptFieldWithKey(secretOf(10), OLD_KEY));

    const summary = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true });

    expect(summary).toMatchObject({ rotated: 2, skipped: 0, failed: 3 });
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        { target: 'funding_creators.resident_number_enc', id: brokenId, code: 'auth_failed' },
        { target: 'funding_creators.resident_number_enc', id: strangerId, code: 'key_mismatch' },
        { target: 'funding_creators.resident_number_enc', id: plainId, code: 'malformed' },
      ]),
    );
    // 실패한 행은 손대지 않는다.
    expect(await storedOf(plainId)).toBe('이건 암호문이 아니다');
    for (const id of [good, good2]) {
      expect(decryptFieldWithKey((await storedOf(id)) as string, NEW_KEY)).toMatch(/^sierra-tango-/);
    }
  });

  it('요약에 평문도 암호문도 담기지 않는다 — id와 코드뿐이다', async () => {
    const secret = secretOf(11);
    const stored = encryptFieldWithKey(secret, Buffer.alloc(32, 1));
    await seedCreator(stored);

    const summary = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true });
    const json = JSON.stringify(summary);

    expect(json).not.toContain(secret);
    expect(json).not.toContain(stored.split(':')[4]);
    expect(json).not.toContain(OLD_KEY.toString('base64'));
    expect(Object.keys(summary.failures[0])).toEqual(['target', 'id', 'code']);
  });
});

describe('낙관적 잠금', () => {
  /**
   * 회전이 도는 중에 개설자가 번호를 다시 저장한 상황. 덮어쓰면 방금 입력한 값이 옛 값으로
   * 되돌아간다 — 그 사실은 아무 데도 기록되지 않는다.
   */
  it('읽은 뒤 값이 바뀐 행은 덮어쓰지 않고 changed로 남긴다', async () => {
    const raced = await seedCreator(encryptFieldWithKey(secretOf(12), OLD_KEY));
    const untouched = await seedCreator(encryptFieldWithKey(secretOf(13), OLD_KEY));
    const creatorsNewValue = encryptFieldWithKey('개설자가-방금-다시-넣은-값', NEW_KEY);

    // select가 끝난 직후(= 엔진이 옛 값을 손에 쥔 상태에서) 그 행을 바꿔 끼운다.
    const racingDb = {
      select: (columns: never) => ({
        from: (table: never) => ({
          where: async (predicate: never) => {
            const rows = await mockDb.select(columns).from(table).where(predicate);
            await mockDb
              .update(schema.fundingCreators)
              .set({ residentNumberEnc: creatorsNewValue })
              .where(eq(schema.fundingCreators.id, raced));
            return rows;
          },
        }),
      }),
      update: mockDb.update.bind(mockDb),
    } as unknown as Parameters<typeof rotateFieldKey>[0]['db'];

    const summary = await rotateFieldKey({ oldKey: OLD_KEY, newKey: NEW_KEY, apply: true, db: racingDb });

    expect(summary).toMatchObject({ rotated: 1, failed: 1 });
    expect(summary.failures).toEqual([
      { target: 'funding_creators.resident_number_enc', id: raced, code: 'changed' },
    ]);
    // 개설자가 넣은 값이 살아 있다.
    expect(await storedOf(raced)).toBe(creatorsNewValue);
    expect(decryptFieldWithKey((await storedOf(untouched)) as string, NEW_KEY)).toBe(secretOf(13));
  });
});
