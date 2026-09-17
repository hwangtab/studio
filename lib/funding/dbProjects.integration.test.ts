/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { getDbFundingProject, listDbFundingProjects } from './dbProjects';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const seed = async (over: Partial<schema.NewFundingProjectRow> = {}) => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ email: `${Math.random()}@example.com`, name: '가나다' }).returning();
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    slug: 'demo', creatorId: creator.id, title: '제목', summary: '요약', content: '본문',
    coverUrl: '/images/funding/demo/cover.webp',
    goalAmount: 1000000,
    startAt: new Date('2026-10-01T01:00:00Z'),
    endAt: new Date('2026-10-31T14:59:59Z'),
    reviewStatus: 'approved', status: 'auto',
    ...over,
  }).returning();
  await mockDb.insert(schema.fundingRewards).values([
    { projectId: project.id, rewardId: 'mp3', title: 'MP3', description: '설명', amount: 10000, estimatedDelivery: '2026-11', sortOrder: 1 },
    { projectId: project.id, rewardId: 'cd', title: 'CD', description: '설명', amount: 30000, totalQuantity: 100, requiresShipping: true, estimatedDelivery: '2026-12', sortOrder: 0 },
  ]);
  return project;
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

describe('dbProjects', () => {
  it('승인된 프로젝트를 FundingProject로 돌려준다', async () => {
    await seed();
    const p = await getDbFundingProject('demo');
    expect(p).not.toBeNull();
    expect(p!.title).toBe('제목');
    expect(p!.cover).toBe('/images/funding/demo/cover.webp');
    expect(p!.content).toBe('본문');
    // ISO 문자열이어야 한다 — 화면·상태 판정이 문자열을 파싱한다.
    expect(p!.startAt).toBe('2026-10-01T01:00:00.000Z');
    expect(p!.ogImage).toBeNull();
  });

  it('리워드를 sortOrder 순으로 싣는다', async () => {
    await seed();
    const p = await getDbFundingProject('demo');
    expect(p!.rewards.map((r) => r.id)).toEqual(['cd', 'mp3']);
    expect(p!.rewards[0]).toMatchObject({ amount: 30000, totalQuantity: 100, requiresShipping: true });
    expect(p!.rewards[1]).toMatchObject({ totalQuantity: null, requiresShipping: false, downloads: [] });
  });

  it('승인되지 않은 프로젝트는 없는 것으로 취급한다', async () => {
    await seed({ reviewStatus: 'submitted', status: 'auto' });
    expect(await getDbFundingProject('demo')).toBeNull();
    expect(await listDbFundingProjects()).toHaveLength(0);
  });

  it('리워드가 없는 행은 목록에서 조용히 빠진다', async () => {
    const [creator] = await mockDb.insert(schema.fundingCreators)
      .values({ email: 'x@example.com', name: '가나' }).returning();
    await mockDb.insert(schema.fundingProjects).values({
      slug: 'broken', creatorId: creator.id, title: '제목', summary: '요약', content: '본문',
      coverUrl: '/c.webp', goalAmount: 1000, startAt: new Date('2026-10-01T01:00:00Z'),
      endAt: new Date('2026-10-31T14:59:59Z'), reviewStatus: 'approved', status: 'auto',
    });
    // 검증에 걸리는 행 하나가 목록 전체를 터뜨리면 안 된다.
    await expect(listDbFundingProjects()).resolves.toEqual([]);
  });

  it('downloads JSON을 그대로 싣는다', async () => {
    const project = await seed({ slug: 'dl' });
    await mockDb.update(schema.fundingRewards)
      .set({ downloads: JSON.stringify([{ label: 'MP3 320kbps', key: 'demo/abc/album.zip' }]) })
      .where(and(
        eq(schema.fundingRewards.projectId, project.id),
        eq(schema.fundingRewards.rewardId, 'mp3'),
      ));
    const p = await getDbFundingProject('dl');
    expect(p!.rewards.find((r) => r.id === 'mp3')!.downloads).toEqual([
      { label: 'MP3 320kbps', key: 'demo/abc/album.zip' },
    ]);
  });
});
