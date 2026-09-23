/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { loadCreatorProjectStats } from './creatorStats';
// eslint-disable-next-line import/first
import { getDbFundingProject } from './dbProjects';
// eslint-disable-next-line import/first
import { buildPublicStatus } from './publicStatus';
// eslint-disable-next-line import/first
import { buildFundingPayoutPreview } from './payout';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let seq = 0;

const seedProject = async (over: Partial<schema.NewFundingProjectRow> = {}) => {
  seq += 1;
  const [creator] = await mockDb
    .insert(schema.fundingCreators)
    .values({ email: `c${seq}@example.com`, name: '개설자' })
    .returning();
  const [project] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      slug: `demo-${seq}`,
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
      ...over,
    })
    .returning();
  await mockDb.insert(schema.fundingRewards).values([
    { projectId: project.id, rewardId: 'cd', title: 'CD', description: '설명', amount: 30_000, totalQuantity: 100, requiresShipping: true, estimatedDelivery: '2026-12', sortOrder: 0 },
    { projectId: project.id, rewardId: 'mp3', title: 'MP3', description: '설명', amount: 10_000, estimatedDelivery: '2026-11', sortOrder: 1 },
  ]);
  return { creatorId: creator.id, project };
};

/**
 * 후원 1건. 후원자 이름·응원 메시지·연락처·배송지를 **전부 채워 넣는다** — 비어 있으면
 * 이 값들이 집계에 새어 나오는 회귀를 테스트가 못 잡는다
 * (`dbProjects.integration.test.ts`의 화이트리스트 테스트와 같은 이유).
 */
const seedPledge = async (
  slug: string,
  amount: number,
  opts: { rewardId?: string; quantity?: number; status?: 'paid' | 'partially_refunded' | 'pending' | 'refunded' } = {},
) => {
  seq += 1;
  const [order] = await mockDb
    .insert(schema.orders)
    .values({
      orderNo: `FND-${seq}`,
      type: 'funding',
      customerName: `후원자이름${seq}`,
      customerPhone: `010-1111-${String(seq).padStart(4, '0')}`,
      customerEmail: `backer${seq}@example.com`,
      itemAmount: amount,
      vatAmount: 0,
      totalAmount: amount,
      status: opts.status ?? 'paid',
      manageToken: `tok-${seq}`,
    })
    .returning();
  await mockDb.insert(schema.fundingPledges).values({
    orderId: order.id,
    projectSlug: slug,
    rewardId: opts.rewardId ?? 'cd',
    rewardTitle: 'CD',
    unitAmount: amount,
    quantity: opts.quantity ?? 1,
    paymentMethod: 'toss',
    holdExpiresAt: new Date('2026-01-02T00:00:00Z'),
    paidAt: new Date('2026-01-02T00:00:00Z'),
    supporterMessage: `응원메시지${seq}`,
    displayNamePublic: true,
    shippingName: `배송받는사람${seq}`,
    shippingPhone: `010-2222-${String(seq).padStart(4, '0')}`,
    shippingPostcode: '54999',
    shippingAddress1: '전주시 완산구 어딘가로 1',
    shippingAddress2: '2층',
    shippingMemo: '부재 시 경비실',
  });
  return order;
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

describe('loadCreatorProjectStats', () => {
  it('모금액·달성률·건수·리워드별 판매 수량을 집계한다', async () => {
    const { creatorId, project } = await seedProject();
    await seedPledge(project.slug, 30_000);
    await seedPledge(project.slug, 60_000, { quantity: 2 });
    await seedPledge(project.slug, 10_000, { rewardId: 'mp3' });
    // 살아 있는 후원이 아닌 것들 — 집계에 들어오면 안 된다.
    await seedPledge(project.slug, 500_000, { status: 'pending' });
    await seedPledge(project.slug, 500_000, { status: 'refunded' });

    const stats = await loadCreatorProjectStats(creatorId, project.id);
    expect(stats).not.toBeNull();
    expect(stats!.raisedAmount).toBe(100_000);
    expect(stats!.goalAmount).toBe(1_000_000);
    expect(stats!.percent).toBe(10);
    expect(stats!.backerCount).toBe(3);
    expect(stats!.rewards).toEqual([
      { rewardId: 'cd', title: 'CD', quantity: 3, totalQuantity: 100 },
      { rewardId: 'mp3', title: 'MP3', quantity: 1, totalQuantity: null },
    ]);
  });

  it('후원이 없으면 0원·0건이고 리워드 수량도 0이다', async () => {
    const { creatorId, project } = await seedProject();
    const stats = await loadCreatorProjectStats(creatorId, project.id);
    expect(stats).toMatchObject({ raisedAmount: 0, backerCount: 0, percent: 0 });
    expect(stats!.rewards.map((r) => r.quantity)).toEqual([0, 0]);
  });

  /**
   * 같은 seed로 세 경로를 돌려 대조한다. 갈리면 개설자가 보는 금액과 공개 페이지 금액이
   * 달라지고, 그건 개설자가 즉시 알아채는 종류의 사고다. 정산(`buildFundingPayoutPreview`)은
   * 환불을 **추가로** 차감하지만 gross·건수는 같은 집합을 센다 — 여기서는 환불이 없으므로
   * 세 수가 정확히 같아야 한다.
   */
  it('공개 상세·정산 미리보기와 같은 값을 낸다', async () => {
    const { creatorId, project } = await seedProject();
    await seedPledge(project.slug, 30_000);
    await seedPledge(project.slug, 45_000, { rewardId: 'mp3' });

    const stats = await loadCreatorProjectStats(creatorId, project.id);
    const publicProject = await getDbFundingProject(project.slug);
    const publicStatus = await buildPublicStatus(publicProject!, new Date('2026-01-15T00:00:00Z'));
    const payout = await buildFundingPayoutPreview(project.id);

    expect(stats!.raisedAmount).toBe(publicStatus.raisedAmount);
    expect(stats!.percent).toBe(publicStatus.percent);
    expect(stats!.backerCount).toBe(publicStatus.backerCount);
    expect(payout!.grossAmount).toBe(stats!.raisedAmount);
    expect(payout!.backerCount).toBe(stats!.backerCount);
  });

  /**
   * 개설자 약관 제8조 — "서포터의 개인정보는 스튜디오가 보유하며, 개설자에게 제공하지
   * 않습니다." `dbProjects.integration.test.ts`의 같은 모양 테스트와 짝이다: 화이트리스트로
   * 키 집합을 고정하고, 직렬화 문자열에 실제 값이 없는지도 확인한다.
   */
  it('후원자 이름·응원 메시지·연락처·배송지가 응답에 실리지 않는다', async () => {
    const { creatorId, project } = await seedProject();
    await seedPledge(project.slug, 30_000);

    const stats = await loadCreatorProjectStats(creatorId, project.id);
    expect(Object.keys(stats!).sort()).toEqual(['backerCount', 'goalAmount', 'percent', 'raisedAmount', 'rewards']);
    expect(Object.keys(stats!.rewards[0]).sort()).toEqual(['quantity', 'rewardId', 'title', 'totalQuantity']);

    // props는 __NEXT_DATA__ JSON으로 페이지 소스에 그대로 실린다 — 직렬화 결과로 확인한다.
    const serialized = JSON.stringify(stats);
    for (const secret of [
      // 'backer'만으로는 못 쓴다 — backerCount에 걸린다. 후원자 메일은 도메인으로 본다.
      '후원자이름', '응원메시지', '@example.com', '010-1111', '010-2222',
      '배송받는사람', '54999', '전주시 완산구', '경비실',
      'publicBackers', 'publicMessages', 'supporterMessage', 'customerName', 'shipping',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('남의 프로젝트는 볼 수 없다', async () => {
    const { project } = await seedProject();
    const other = await seedProject();
    await seedPledge(project.slug, 30_000);
    expect(await loadCreatorProjectStats(other.creatorId, project.id)).toBeNull();
  });

  /**
   * 승인 전에는 null — 화면이 구획 자체를 감춘다. 0원·0건을 보여주면 "모금이 열렸는데
   * 아무도 후원하지 않았다"로 읽혀, 심사도 끝나지 않은 개설자에게 없는 실패를 알린다.
   */
  it.each(['draft', 'submitted', 'changes_requested', 'rejected'] as const)('승인 전(%s)에는 null이다', async (reviewStatus) => {
    const { creatorId, project } = await seedProject({ reviewStatus, status: 'draft' });
    expect(await loadCreatorProjectStats(creatorId, project.id)).toBeNull();
  });

  it('없는 프로젝트 id는 null이다', async () => {
    const { creatorId } = await seedProject();
    expect(await loadCreatorProjectStats(creatorId, 'no-such-project')).toBeNull();
  });
});
