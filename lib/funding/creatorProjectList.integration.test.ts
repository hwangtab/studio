/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { listProjectsForCreator } from './creatorProjectList';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const creatorWithProject = async (email: string, slug: string) => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name: '가나' }).returning();
  await mockDb.insert(schema.fundingProjects).values({
    slug, creatorId: creator.id, title: `${slug} 제목`, summary: '요약', content: '본문',
    coverUrl: '/c.webp', goalAmount: 1000, startAt: new Date('2026-10-01T01:00:00Z'),
    endAt: new Date('2026-10-31T14:59:59Z'),
  });
  return creator.id;
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

afterEach(() => client.close());

describe('listProjectsForCreator', () => {
  it('자기 프로젝트만 돌려준다', async () => {
    const mine = await creatorWithProject('mine@example.com', 'mine');
    await creatorWithProject('other@example.com', 'other');
    const list = await listProjectsForCreator(mine);
    expect(list.map((p) => p.slug)).toEqual(['mine']);
    expect(list[0].reviewStatus).toBe('draft');
  });

  it('프로젝트가 없으면 빈 배열', async () => {
    const [creator] = await mockDb.insert(schema.fundingCreators)
      .values({ email: 'empty@example.com', name: '가나' }).returning();
    expect(await listProjectsForCreator(creator.id)).toEqual([]);
  });
});
