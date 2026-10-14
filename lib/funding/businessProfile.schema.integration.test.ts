/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  db = drizzle(client, { schema });
});

afterEach(() => client.close());

const seedCreator = async (): Promise<string> => {
  const [creator] = await db
    .insert(schema.fundingCreators)
    .values({ email: 'biz@example.com', name: '가나' })
    .returning();
  return creator.id;
};

const profileValues = (creatorId: string) => ({
  creatorId,
  businessNumber: '1234567890',
  businessName: '가나 스튜디오',
  representativeName: '홍길동',
});

describe('creator_business_profiles', () => {
  it('기본값: 미확인 상태이고 사업자등록증이 없다', async () => {
    const creatorId = await seedCreator();
    await db.insert(schema.creatorBusinessProfiles).values(profileValues(creatorId));
    const [row] = await db
      .select()
      .from(schema.creatorBusinessProfiles)
      .where(eq(schema.creatorBusinessProfiles.creatorId, creatorId));
    expect(row.ntsStatus).toBe('unverified');
    expect(row.certificateKey).toBeNull();
  });

  it('같은 creator_id로 두 번째 행은 PK 위반이다', async () => {
    const creatorId = await seedCreator();
    await db.insert(schema.creatorBusinessProfiles).values(profileValues(creatorId));
    await expect(db.insert(schema.creatorBusinessProfiles).values(profileValues(creatorId))).rejects.toThrow();
  });

  it('회귀 고정: fundingCreators 조회 결과에 사업자 칸이 없다', async () => {
    const creatorId = await seedCreator();
    await db.insert(schema.creatorBusinessProfiles).values(profileValues(creatorId));
    const creator = await db.query.fundingCreators.findFirst();
    const keys = Object.keys(creator ?? {});
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).not.toEqual(expect.arrayContaining(['businessNumber']));
    expect(keys.filter((k) => /business|nts|certificate/i.test(k))).toEqual([]);
  });
});
