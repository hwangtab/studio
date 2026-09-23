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

const seed = async (
  over: Partial<schema.NewFundingProjectRow> = {},
  creatorOver: Partial<schema.NewFundingCreator> = {},
) => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ email: `${Math.random()}@example.com`, name: '가나다', ...creatorOver }).returning();
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
    expect(p!.creator).toEqual({ name: '가나다' });
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

  it('목록도 개설자 이름을 싣는다', async () => {
    await seed({ slug: 'list-demo' }, { name: '목록개설자' });
    const list = await listDbFundingProjects();
    expect(list.find((p) => p.slug === 'list-demo')?.creator).toEqual({ name: '목록개설자' });
  });

  it('비공개 개설자 필드(이메일·연락처·정산)는 공개 프로젝트에 실리지 않는다', async () => {
    // adminProjects.integration.test.ts의 화이트리스트 테스트와 같은 이유로 값이 있는
    // mock을 쓴다 — 목이 비어 있으면 스프레드 회귀(...creator)를 못 잡는다.
    const project = await seed({ slug: 'creator-fields' }, {
      email: 'creator-fields@example.com',
      name: '민감정보개설자',
      contactName: '연락용이름',
      phone: '010-0000-0000',
      bio: '소개',
      links: JSON.stringify(['https://example.com']),
      taxType: 'withholding',
      payoutBankName: '국민은행',
      payoutAccount: '123-456-789012',
      payoutHolder: '정산예금주',
      // 암호문도 나가면 안 된다 — 나가는 순간 키가 유일한 방어가 된다.
      residentNumberEnc: 'v1:ZmFrZQ==:ZmFrZQ==:ZmFrZQ==',
    });

    const single = await getDbFundingProject('creator-fields');
    expect(single).not.toBeNull();
    expect(Object.keys(single!.creator!).sort()).toEqual(['name']);

    const list = await listDbFundingProjects();
    const listed = list.find((p) => p.slug === 'creator-fields');
    expect(listed).toBeDefined();
    expect(Object.keys(listed!.creator!).sort()).toEqual(['name']);

    // __NEXT_DATA__로 그대로 나가는 값이므로, 직렬화 결과에 다른 필드가 없는지도 확인한다.
    const serialized = JSON.stringify([single, listed]);
    expect(serialized).not.toContain('creator-fields@example.com');
    expect(serialized).not.toContain('연락용이름');
    expect(serialized).not.toContain('010-0000-0000');
    expect(serialized).not.toContain('withholding');
    expect(serialized).not.toContain('국민은행');
    expect(serialized).not.toContain('123-456-789012');
    expect(serialized).not.toContain('정산예금주');
    expect(serialized).not.toContain('residentNumber');
    expect(serialized).not.toContain('v1:ZmFrZQ==');
    expect(serialized).toContain('민감정보개설자'); // name만은 정상적으로 실린다.
    void project;
  });
});
