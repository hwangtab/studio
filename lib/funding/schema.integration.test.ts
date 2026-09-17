/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let db: ReturnType<typeof drizzle<typeof schema>>;
let client: Client;

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sqlText = readFileSync(path.join(MIGRATIONS, file), 'utf-8');
    for (const stmt of sqlText.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
  db = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('펀딩 셀프 개설 스키마', () => {
  it('개설자 이메일은 유일하다', async () => {
    await db.insert(schema.fundingCreators).values({ email: 'a@example.com', name: '가나' });
    await expect(
      db.insert(schema.fundingCreators).values({ email: 'a@example.com', name: '다라' }),
    ).rejects.toThrow();
  });

  it('프로젝트 slug는 유일하고 심사 상태 기본값은 draft다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'b@example.com', name: '가나' }).returning();
    const [row] = await db.insert(schema.fundingProjects).values({
      slug: 'demo', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    expect(row.reviewStatus).toBe('draft');
    expect(row.status).toBe('draft');
    expect(row.hidden).toBe(false);

    await expect(
      db.insert(schema.fundingProjects).values({
        slug: 'demo', creatorId: creator.id, title: '다른 제목', summary: '요약',
        content: '본문', coverUrl: '/c.webp', goalAmount: 1000,
        startAt: new Date(), endAt: new Date(Date.now() + 1000),
      }),
    ).rejects.toThrow();
  });

  it('리워드는 (프로젝트, rewardId)로 유일하다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'c@example.com', name: '가나' }).returning();
    const [project] = await db.insert(schema.fundingProjects).values({
      slug: 'demo2', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    const reward = {
      projectId: project.id, rewardId: 'cd', title: 'CD', description: '설명',
      amount: 30000, estimatedDelivery: '2026-12', sortOrder: 0,
    };
    await db.insert(schema.fundingRewards).values(reward);
    await expect(db.insert(schema.fundingRewards).values(reward)).rejects.toThrow();
  });

  it('프로젝트를 지우면 리워드도 함께 지워진다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'd@example.com', name: '가나' }).returning();
    const [project] = await db.insert(schema.fundingProjects).values({
      slug: 'demo3', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    await db.insert(schema.fundingRewards).values({
      projectId: project.id, rewardId: 'cd', title: 'CD', description: '설명',
      amount: 30000, estimatedDelivery: '2026-12', sortOrder: 0,
    });
    await db.delete(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
    const left = await db.select().from(schema.fundingRewards);
    expect(left).toHaveLength(0);
  });

  it('정산은 프로젝트당 한 번만 기록된다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'e@example.com', name: '가나' }).returning();
    const [project] = await db.insert(schema.fundingProjects).values({
      slug: 'demo4', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    const payout = {
      projectId: project.id, grossAmount: 1000000, refundAmount: 0, supplyAmount: 909091,
      feeAmount: 90909, shareAmount: 818182, withholdingAmount: 27000, netAmount: 791182,
      backerCount: 30,
    };
    await db.insert(schema.fundingProjectPayouts).values(payout);
    await expect(db.insert(schema.fundingProjectPayouts).values(payout)).rejects.toThrow();
  });
});
