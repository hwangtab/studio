/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { decideCreatorAccount } from './creatorAccountDecision';

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
});

afterEach(() => client.close());

const seedCreator = async (email: string, name = '옛이름'): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name }).returning();
  return creator.id;
};

const seedProject = async (
  creatorId: string,
  overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {},
): Promise<string> => {
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    creatorId,
    slug: `slug-${crypto.randomUUID()}`,
    title: '제목',
    summary: '요약',
    content: '본'.repeat(210),
    coverUrl: '/uploads/funding/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date('2026-10-01T00:00:00Z'),
    endAt: new Date('2026-10-31T00:00:00Z'),
    reviewStatus: 'submitted',
    ...overrides,
  }).returning();
  return project.id;
};

const seedToken = async (creatorId: string, tokenHash: string, expiresAt = new Date('2099-01-01T00:00:00Z')) => {
  await mockDb.insert(schema.fundingCreatorTokens).values({ tokenHash, creatorId, expiresAt });
};

const readCreator = async (creatorId: string) => {
  const [row] = await mockDb.select().from(schema.fundingCreators).where(eq(schema.fundingCreators.id, creatorId));
  return row;
};

const countTokens = async (creatorId: string): Promise<number> => {
  const rows = await mockDb.select().from(schema.fundingCreatorTokens)
    .where(eq(schema.fundingCreatorTokens.creatorId, creatorId));
  return rows.length;
};

const REASON = '개설자가 오타를 알려 옴';

describe('decideCreatorAccount — 이름', () => {
  it('승인된 프로젝트가 있어도 이름을 바꾼다 (본인 잠금이 막는 자리를 운영자가 푼다)', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const projectId = await seedProject(creatorId, { reviewStatus: 'approved', status: 'auto' });

    const result = await decideCreatorAccount(projectId, 'set_creator_name', { value: '새이름', reason: REASON });

    expect(result.ok).toBe(true);
    expect((await readCreator(creatorId)).name).toBe('새이름');
  });

  it('그 개설자의 승인된 프로젝트 전부를 재검증 대상으로 돌려준다 (지금 보는 하나가 아니다)', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const a = await seedProject(creatorId, { slug: 'approved-a', reviewStatus: 'approved', status: 'auto' });
    await seedProject(creatorId, { slug: 'approved-b', reviewStatus: 'approved', status: 'auto' });
    await seedProject(creatorId, { slug: 'draft-c', reviewStatus: 'draft' });
    // 다른 개설자의 승인된 프로젝트는 섞이면 안 된다.
    const otherId = await seedCreator('other@example.com', '남');
    await seedProject(otherId, { slug: 'other-approved', reviewStatus: 'approved', status: 'auto' });

    const result = await decideCreatorAccount(a, 'set_creator_name', { value: '새이름', reason: REASON });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.revalidateSlugs].sort()).toEqual(['approved-a', 'approved-b']);
  });

  it('사유가 없으면 거부하고 아무것도 바꾸지 않는다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const projectId = await seedProject(creatorId);

    const result = await decideCreatorAccount(projectId, 'set_creator_name', { value: '새이름', reason: '   ' });

    expect(result).toMatchObject({ ok: false, code: 'incomplete' });
    expect((await readCreator(creatorId)).name).toBe('옛이름');
  });

  it('경합(읽은 뒤 다른 주체가 먼저 바꿈)이면 409로 판정한다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const projectId = await seedProject(creatorId);
    // 판정이 개설자 행을 읽은 **뒤** 다른 주체가 이름을 바꾼 상황. 읽기만 옛 값으로
    // 돌려주고 DB는 새 값을 갖게 해서 낙관적 잠금(WHERE에 건 옛 이름)이 0행이 되게 한다.
    const stale = await readCreator(creatorId);
    await mockDb.update(schema.fundingCreators).set({ name: '남이바꾼이름' })
      .where(eq(schema.fundingCreators.id, creatorId));

    jest.spyOn(mockDb, 'select').mockImplementationOnce((() => ({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => [{ creator: stale }] }) }) }),
    })) as never);

    const result = await decideCreatorAccount(projectId, 'set_creator_name', { value: '새이름', reason: REASON });

    expect(result).toMatchObject({ ok: false, code: 'conflict' });
    expect((await readCreator(creatorId)).name).toBe('남이바꾼이름');
  });

  it('길이 제한을 넘으면 거부한다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const projectId = await seedProject(creatorId);

    const result = await decideCreatorAccount(projectId, 'set_creator_name', { value: '가'.repeat(41), reason: REASON });

    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    expect((await readCreator(creatorId)).name).toBe('옛이름');
  });
});

describe('decideCreatorAccount — 이메일', () => {
  it('이미 다른 개설자가 쓰는 주소는 거부한다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    await seedCreator('taken@example.com', '남');
    const projectId = await seedProject(creatorId);

    const result = await decideCreatorAccount(projectId, 'set_creator_email', { value: 'TAKEN@example.com', reason: REASON });

    expect(result).toMatchObject({ ok: false, code: 'duplicate_email' });
    expect((await readCreator(creatorId)).email).toBe('creator@example.com');
  });

  it('바꾸면 살아 있는 로그인 토큰을 전부 죽인다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const otherId = await seedCreator('other@example.com', '남');
    const projectId = await seedProject(creatorId);
    await seedToken(creatorId, 'hash-a');
    await seedToken(creatorId, 'hash-b');
    await seedToken(otherId, 'hash-other');

    const result = await decideCreatorAccount(projectId, 'set_creator_email', { value: 'new@example.com', reason: REASON });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revokedTokens).toBe(2);
    expect(await countTokens(creatorId)).toBe(0);
    // 남의 토큰은 건드리지 않는다.
    expect(await countTokens(otherId)).toBe(1);
    expect((await readCreator(creatorId)).email).toBe('new@example.com');
  });

  it('옛 주소와 새 주소를 둘 다 돌려준다 — 호출부가 양쪽에 알릴 수 있어야 한다', async () => {
    const creatorId = await seedCreator('old@example.com');
    const projectId = await seedProject(creatorId);

    const result = await decideCreatorAccount(projectId, 'set_creator_email', { value: ' New@Example.com ', reason: REASON });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previousValue).toBe('old@example.com');
    expect(result.creatorEmail).toBe('new@example.com');
  });

  it('경합(읽은 뒤 다른 주체가 먼저 바꿈)이면 409이고 토큰도 죽이지 않는다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const projectId = await seedProject(creatorId);
    await seedToken(creatorId, 'hash-a');
    // 이름 경로와 깨지는 방식이 다르다 — 여기는 UPDATE와 토큰 DELETE가 한 배치이고,
    // DELETE는 `updated_at = epoch` EXISTS로 "이 호출이 방금 쓴 행"만 지운다. 경합으로
    // UPDATE가 0행이면 그 EXISTS가 거짓이라 옛 링크가 그대로 살아 있어야 한다.
    const stale = await readCreator(creatorId);
    await mockDb.update(schema.fundingCreators).set({ email: 'someone-else-changed@example.com' })
      .where(eq(schema.fundingCreators.id, creatorId));

    jest.spyOn(mockDb, 'select').mockImplementationOnce((() => ({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => [{ creator: stale }] }) }) }),
    })) as never);

    const result = await decideCreatorAccount(projectId, 'set_creator_email', { value: 'new@example.com', reason: REASON });

    expect(result).toMatchObject({ ok: false, code: 'conflict' });
    expect((await readCreator(creatorId)).email).toBe('someone-else-changed@example.com');
    expect(await countTokens(creatorId)).toBe(1);
  });

  it('형식이 틀리면 거부한다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const projectId = await seedProject(creatorId);

    const result = await decideCreatorAccount(projectId, 'set_creator_email', { value: '골뱅이없음', reason: REASON });

    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    expect(await countTokens(creatorId)).toBe(0);
    expect((await readCreator(creatorId)).email).toBe('creator@example.com');
  });

  it('사유가 없으면 거부하고 토큰도 살려 둔다', async () => {
    const creatorId = await seedCreator('creator@example.com');
    const projectId = await seedProject(creatorId);
    await seedToken(creatorId, 'hash-a');

    const result = await decideCreatorAccount(projectId, 'set_creator_email', { value: 'new@example.com', reason: '' });

    expect(result).toMatchObject({ ok: false, code: 'incomplete' });
    expect(await countTokens(creatorId)).toBe(1);
  });
});

describe('decideCreatorAccount — 공통', () => {
  it('없는 프로젝트면 404 판정', async () => {
    const result = await decideCreatorAccount('없는id', 'set_creator_name', { value: '새이름', reason: REASON });
    expect(result).toMatchObject({ ok: false, code: 'not_found' });
  });
});
