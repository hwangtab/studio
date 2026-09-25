/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { loadCreatorShipping, type CreatorShippingRow } from './creatorShipping';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const DAY = 24 * 60 * 60 * 1000;

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

// ── 시드 헬퍼 ────────────────────────────────────────────────────────────────
// 이 파일 계열(creatorProjectList.integration.test.ts, reviewDecision.integration.test.ts)에
// seedApprovedProject/seedLiveProjectWithPledge/seedClosedProjectWithPledge에 해당하는
// 헬퍼가 없어 새로 만들었다. reviewDecision.integration.test.ts의 seedCreator/seedProject/
// seedReward 관례를 그대로 따르고, 여기에 주문·후원 시드를 더했다.

const seedCreator = async (email: string, name = '개설자'): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name }).returning();
  return creator.id;
};

const seedProject = async (
  creatorId: string,
  overrides: Partial<typeof schema.fundingProjects.$inferInsert> = {},
): Promise<{ id: string; slug: string }> => {
  const slug = `slug-${crypto.randomUUID()}`;
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    creatorId,
    slug,
    title: '제목',
    summary: '요약',
    content: '본'.repeat(210),
    coverUrl: '/uploads/funding/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date(Date.now() - DAY),
    endAt: new Date(Date.now() + DAY),
    reviewStatus: 'approved',
    status: 'auto',
    ...overrides,
  }).returning();
  return { id: project.id, slug: project.slug };
};

const seedReward = async (
  projectId: string,
  overrides: Partial<typeof schema.fundingRewards.$inferInsert> = {},
): Promise<string> => {
  const rewardId = (overrides.rewardId as string | undefined) ?? 'basic';
  await mockDb.insert(schema.fundingRewards).values({
    projectId,
    rewardId,
    title: '기본 리워드',
    description: '설명',
    amount: 30_000,
    requiresShipping: true,
    estimatedDelivery: '2026-11-01',
    ...overrides,
  });
  return rewardId;
};

const seedOrder = async (
  overrides: Partial<typeof schema.orders.$inferInsert> = {},
): Promise<string> => {
  const [order] = await mockDb.insert(schema.orders).values({
    orderNo: `FND-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
    type: 'funding',
    customerName: '홍길동',
    customerPhone: '010-1234-5678',
    customerEmail: 'backer-default@example.com',
    itemAmount: 30_000,
    vatAmount: 0,
    totalAmount: 30_000,
    status: 'paid',
    manageToken: crypto.randomUUID(),
    ...overrides,
  }).returning();
  return order.id;
};

const seedPledge = async (
  orderId: string,
  projectSlug: string,
  rewardId: string,
  overrides: Partial<typeof schema.fundingPledges.$inferInsert> = {},
): Promise<string> => {
  const [pledge] = await mockDb.insert(schema.fundingPledges).values({
    orderId,
    projectSlug,
    rewardId,
    rewardTitle: '기본 리워드',
    unitAmount: 30_000,
    quantity: 1,
    paymentMethod: 'toss',
    holdExpiresAt: new Date(Date.now() + DAY),
    shippingName: '기본배송이름',
    shippingPhone: '010-0000-1111',
    shippingPostcode: '03000',
    shippingAddress1: '기본배송주소1',
    shippingAddress2: '기본배송주소2',
    shippingMemo: '기본배송메모',
    fulfillmentStatus: 'preparing',
    trackingCompany: '기본택배사',
    trackingNumber: '1234567890',
    ...overrides,
  }).returning();
  return pledge.id;
};

/** 마감 전(upcoming/live 상관없이 여기선 live)의 승인된 프로젝트만 필요할 때. */
const seedApprovedProject = async (opts: { creatorId: string }): Promise<{ projectId: string }> => {
  const { id } = await seedProject(opts.creatorId);
  return { projectId: id };
};

const seedLiveProjectWithPledge = async (
  opts: { shippingName?: string; shippingAddress1?: string } = {},
): Promise<{ creatorId: string; projectId: string }> => {
  const creatorId = await seedCreator(`creator-${crypto.randomUUID()}@example.com`);
  const { id: projectId, slug } = await seedProject(creatorId, {
    startAt: new Date(Date.now() - DAY),
    endAt: new Date(Date.now() + DAY),
  });
  const rewardId = await seedReward(projectId);
  const orderId = await seedOrder({ status: 'paid' });
  await seedPledge(orderId, slug, rewardId, {
    shippingName: opts.shippingName ?? '기본배송이름',
    shippingAddress1: opts.shippingAddress1 ?? '기본배송주소1',
  });
  return { creatorId, projectId };
};

const seedClosedProjectWithPledge = async (opts: {
  shippingName?: string;
  shippingAddress1?: string;
  requiresShipping?: boolean;
  refundRequestedAt?: Date;
  projectStatus?: typeof schema.fundingProjects.$inferInsert['status'];
  orderStatus?: typeof schema.orderStatusEnum[number];
  supporterEmail?: string;
  orderNo?: string;
  unitAmount?: number;
  fulfillmentStatus?: typeof schema.fulfillmentStatusEnum[number];
} = {}): Promise<{ creatorId: string; projectId: string }> => {
  const creatorId = await seedCreator(`creator-${crypto.randomUUID()}@example.com`);
  const { id: projectId, slug } = await seedProject(creatorId, {
    startAt: new Date(Date.now() - 2 * DAY),
    endAt: new Date(Date.now() - DAY),
    ...(opts.projectStatus ? { status: opts.projectStatus } : {}),
  });
  const rewardId = await seedReward(projectId, { requiresShipping: opts.requiresShipping ?? true });
  const orderId = await seedOrder({
    status: opts.orderStatus ?? 'paid',
    customerEmail: opts.supporterEmail ?? 'backer-default@example.com',
    ...(opts.orderNo ? { orderNo: opts.orderNo } : {}),
  });
  await seedPledge(orderId, slug, rewardId, {
    shippingName: opts.shippingName ?? '기본배송이름',
    shippingAddress1: opts.shippingAddress1 ?? '기본배송주소1',
    unitAmount: opts.unitAmount ?? 30_000,
    fulfillmentStatus: opts.fulfillmentStatus ?? 'preparing',
    ...(opts.refundRequestedAt ? { refundRequestedAt: opts.refundRequestedAt } : {}),
  });
  return { creatorId, projectId };
};

// ── 테스트 ──────────────────────────────────────────────────────────────────

it('남의 프로젝트는 null이다', async () => {
  const creatorA = await seedCreator('a@example.com');
  const creatorB = await seedCreator('b@example.com');
  const { projectId } = await seedApprovedProject({ creatorId: creatorA });
  expect(await loadCreatorShipping(creatorB, projectId)).toBeNull();
});

it('모금 중에는 집계만 주고 배송지를 한 줄도 내보내지 않는다', async () => {
  // 모금 중 셀프 취소가 자유로워 주소가 들어왔다 나갔다 한다. 그때 개설자가 볼 이유가 없다.
  const { creatorId, projectId } = await seedLiveProjectWithPledge({
    shippingName: '홍길동', shippingAddress1: '서울시 은평구 어딘가',
  });

  const view = await loadCreatorShipping(creatorId, projectId);

  expect(view!.state).toBe('before_close');
  expect(JSON.stringify(view)).not.toContain('홍길동');
  expect(JSON.stringify(view)).not.toContain('은평구');
  expect(view!.summary.backerCount).toBe(1);
});

it('마감 뒤에는 배송지를 준다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({
    shippingName: '홍길동', shippingAddress1: '서울시 은평구 어딘가',
  });

  const view = await loadCreatorShipping(creatorId, projectId);

  expect(view!.state).toBe('open');
  const rows = (view as { rows: CreatorShippingRow[] }).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].shippingName).toBe('홍길동');
  expect(rows[0].shippingAddress1).toBe('서울시 은평구 어딘가');
});

it('배송이 필요 없는 리워드는 목록에 없다', async () => {
  // 디지털 전용 리워드는 배송지 자체가 없다.
  const { creatorId, projectId } = await seedClosedProjectWithPledge({ requiresShipping: false });
  const view = await loadCreatorShipping(creatorId, projectId);
  expect((view as { rows: CreatorShippingRow[] }).rows).toHaveLength(0);
});

it('환불된 후원은 목록에 없다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({ orderStatus: 'refunded' });
  const view = await loadCreatorShipping(creatorId, projectId);
  expect((view as { rows: CreatorShippingRow[] }).rows).toHaveLength(0);
});

it('결제 정보와 서포터 이메일은 어떤 경로로도 실리지 않는다', async () => {
  // 발송에 필요 없다. props에 실리면 __NEXT_DATA__로 페이지 소스에 나간다.
  const { creatorId, projectId } = await seedClosedProjectWithPledge({
    supporterEmail: 'backer@example.com', orderNo: 'FND-20260921-ABCD1234', unitAmount: 33_000,
  });

  const view = await loadCreatorShipping(creatorId, projectId);
  const json = JSON.stringify(view);

  expect(json).not.toContain('backer@example.com');
  expect(json).not.toContain('FND-20260921-ABCD1234');
  expect(json).not.toContain('33000');
});

it('행에 실리는 키가 화이트리스트와 정확히 같다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({});
  const view = await loadCreatorShipping(creatorId, projectId);
  const rows = (view as { rows: CreatorShippingRow[] }).rows;
  expect(Object.keys(rows[0]).sort()).toEqual([
    'fulfillmentStatus', 'pledgeId', 'quantity', 'rewardId', 'rewardTitle', 'shipHold',
    'shippingAddress1', 'shippingAddress2', 'shippingMemo', 'shippingName',
    'shippingPhone', 'shippingPostcode', 'trackingCompany', 'trackingNumber',
  ]);
});

// ── M1·M2 ───────────────────────────────────────────────────────────────────

it('운영자가 조기 종료해도 마감일 전이면 배송지가 나가지 않는다', async () => {
  // 셀프 취소(assessSelfCancel)는 날짜만 보므로, 여기서 주소를 내보내면 아직 취소가
  // 자유로운 후원의 이름·전화·주소가 개설자에게 나간다.
  const creatorId = await seedCreator(`creator-${crypto.randomUUID()}@example.com`);
  const { id: projectId, slug } = await seedProject(creatorId, {
    status: 'closed',
    startAt: new Date(Date.now() - DAY),
    endAt: new Date(Date.now() + DAY),
  });
  const rewardId = await seedReward(projectId);
  const orderId = await seedOrder({ status: 'paid' });
  await seedPledge(orderId, slug, rewardId, { shippingName: '홍길동' });

  const view = await loadCreatorShipping(creatorId, projectId);

  expect(view!.state).toBe('before_close');
  expect(JSON.stringify(view)).not.toContain('홍길동');
});

it('마감일이 지났으면 운영자 종료 여부와 무관하게 배송지가 나간다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({ projectStatus: 'closed' });
  const view = await loadCreatorShipping(creatorId, projectId);
  expect(view!.state).toBe('open');
  expect((view as { rows: CreatorShippingRow[] }).rows).toHaveLength(1);
});

it('환불을 기다리는 청약철회 건은 shipHold가 "발송금지"다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({
    refundRequestedAt: new Date(Date.now() - 60_000),
  });
  const view = await loadCreatorShipping(creatorId, projectId);
  expect((view as { rows: CreatorShippingRow[] }).rows[0].shipHold).toBe('발송금지');
});

it('청약철회 기록이 없으면 shipHold는 빈 칸이다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({});
  const view = await loadCreatorShipping(creatorId, projectId);
  expect((view as { rows: CreatorShippingRow[] }).rows[0].shipHold).toBe('');
});
