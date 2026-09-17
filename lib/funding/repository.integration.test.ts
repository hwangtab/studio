/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import type { FundingProject } from './shape';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// jest.mock 팩토리는 `mock` 접두사가 붙은 변수만 참조할 수 있다(babel-plugin-jest-hoist).
const mockMdProjects: FundingProject[] = [];
jest.mock('./projects', () => {
  const actual = jest.requireActual('./projects');
  return {
    ...actual,
    getFundingProject: (slug: string) => mockMdProjects.find((p) => p.slug === slug) ?? null,
    getAllFundingProjects: () => mockMdProjects,
  };
});

// eslint-disable-next-line import/first
import { getAllFundingProjectsAsync, getFundingProjectAsync, getListableFundingProjectsAsync } from './repository';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const md = (slug: string, title: string) => parseFundingProject(`---
slug: ${slug}
title: ${title}
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    estimatedDelivery: 2026-12
---
`, slug);

const seedDb = async (slug: string, title: string, over: Partial<schema.NewFundingProjectRow> = {}) => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ email: `${slug}@example.com`, name: '가나' }).returning();
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    slug, creatorId: creator.id, title, summary: '요약', content: '본문', coverUrl: '/c.webp',
    goalAmount: 100000, startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    reviewStatus: 'approved', status: 'auto', ...over,
  }).returning();
  await mockDb.insert(schema.fundingRewards).values({
    projectId: project.id, rewardId: 'cd', title: 'CD', description: 'd',
    amount: 30000, estimatedDelivery: '2026-12', sortOrder: 0,
  });
};

beforeEach(async () => {
  mockMdProjects.length = 0;
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('repository', () => {
  it('md에 있으면 md를 쓴다', async () => {
    mockMdProjects.push(md('both', '파일 제목'));
    await seedDb('both', 'DB 제목');
    const p = await getFundingProjectAsync('both');
    expect(p!.title).toBe('파일 제목');
  });

  it('md에 없으면 DB를 본다', async () => {
    await seedDb('only-db', 'DB 제목');
    const p = await getFundingProjectAsync('only-db');
    expect(p!.title).toBe('DB 제목');
  });

  it('목록은 둘을 합치고 slug가 겹치면 md만 남긴다', async () => {
    mockMdProjects.push(md('both', '파일 제목'));
    await seedDb('both', 'DB 제목');
    await seedDb('only-db', 'DB 제목2');
    const all = await getAllFundingProjectsAsync();
    expect(all.map((p) => p.slug).sort()).toEqual(['both', 'only-db']);
    expect(all.find((p) => p.slug === 'both')!.title).toBe('파일 제목');
  });

  it('공개 목록은 hidden과 draft를 뺀다', async () => {
    await seedDb('live-one', '공개');
    await seedDb('hidden-one', '숨김', { hidden: true });
    await seedDb('draft-one', '초안', { status: 'draft' });
    const list = await getListableFundingProjectsAsync(NOW);
    expect(list.map((p) => p.slug)).toEqual(['live-one']);
  });

  it('DB가 죽어도 md는 계속 읽힌다', async () => {
    mockMdProjects.push(md('file-only', '파일 제목'));
    client.close(); // 이후 모든 DB 호출이 던진다
    await expect(getFundingProjectAsync('file-only')).resolves.not.toBeNull();
    await expect(getFundingProjectAsync('missing')).resolves.toBeNull();
    await expect(getAllFundingProjectsAsync()).resolves.toHaveLength(1);
  });
});
