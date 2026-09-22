/** @jest-environment node */
/**
 * setFulfillment을 실 DB(in-memory libSQL)로 본다.
 * 관리자 경로의 네 규칙(살아 있는 주문 집합·환불 요청 차단·delivered_at의 COALESCE/NULL·
 * 경합을 막는 WHERE)은 tests/api/admin/funding/pledges/setFulfillment.integration.test.ts가
 * 이미 이 함수를 거쳐 고정한다(관리자 라우트가 setFulfillment를 호출하도록 옮겼다).
 * 여기서는 이 서비스가 새로 들인 것 — 개설자 actor의 소유 검사와 마크다운 프로젝트 격리 —
 * 을 확인한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { setFulfillment } from './fulfillment';

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

// ── 시드 헬퍼 ── creatorShipping.integration.test.ts의 관례를 그대로 따른다.

const seedCreator = async (): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ email: `creator-${crypto.randomUUID()}@example.com`, name: '개설자' }).returning();
  return creator.id;
};

const seedProject = async (creatorId: string): Promise<string> => {
  const slug = `slug-${crypto.randomUUID()}`;
  await mockDb.insert(schema.fundingProjects).values({
    creatorId,
    slug,
    title: '제목',
    summary: '요약',
    content: '본'.repeat(210),
    coverUrl: '/uploads/funding/cover.webp',
    goalAmount: 1_000_000,
    startAt: new Date(Date.now() - 2 * DAY),
    endAt: new Date(Date.now() - DAY),
    reviewStatus: 'approved',
    status: 'auto',
  });
  return slug;
};

const seedOrder = async (
  overrides: Partial<typeof schema.orders.$inferInsert> = {},
): Promise<string> => {
  const [order] = await mockDb.insert(schema.orders).values({
    orderNo: `FND-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
    type: 'funding',
    customerName: '홍길동',
    customerPhone: '010-1234-5678',
    customerEmail: 'backer@example.com',
    itemAmount: 30_000,
    vatAmount: 0,
    totalAmount: 30_000,
    status: 'paid',
    manageToken: crypto.randomUUID(),
    ...overrides,
  }).returning();
  return order.id;
};

/** 프로젝트 slug와 주문 상태를 받아 후원 1건을 심는다. */
const seedPledgeRow = async (
  projectSlug: string,
  overrides: Partial<typeof schema.fundingPledges.$inferInsert> = {},
  orderOverrides: Partial<typeof schema.orders.$inferInsert> = {},
): Promise<string> => {
  const orderId = await seedOrder(orderOverrides);
  const [pledge] = await mockDb.insert(schema.fundingPledges).values({
    orderId,
    projectSlug,
    rewardId: 'basic',
    rewardTitle: '기본 리워드',
    unitAmount: 30_000,
    quantity: 1,
    paymentMethod: 'toss',
    holdExpiresAt: new Date(Date.now() + DAY),
    fulfillmentStatus: 'none',
    ...overrides,
  }).returning();
  return pledge.id;
};

/** creatorId가 개설한 프로젝트에 후원 1건을 심는다. */
const seedPledge = async (
  opts: { creatorId: string; refundRequestedAt?: Date },
): Promise<{ pledgeId: string }> => {
  const slug = await seedProject(opts.creatorId);
  const pledgeId = await seedPledgeRow(slug, {
    refundRequestedAt: opts.refundRequestedAt,
  });
  return { pledgeId };
};

/** 대응하는 funding_projects 행이 없는(=md 정본) 프로젝트의 후원. */
const seedMarkdownProjectPledge = async (): Promise<{ pledgeId: string }> => {
  const pledgeId = await seedPledgeRow('keep-singing-for-palestine');
  return { pledgeId };
};

const readDeliveredAt = async (pledgeId: string): Promise<number | null> => {
  const r = await client.execute({ sql: 'SELECT delivered_at FROM funding_pledges WHERE id = ?', args: [pledgeId] });
  return (r.rows[0] as unknown as { delivered_at: number | null }).delivered_at;
};

it('개설자는 자기 프로젝트의 후원만 바꿀 수 있다', async () => {
  const creatorA = await seedCreator();
  const creatorB = await seedCreator();
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  const result = await setFulfillment({
    pledgeId, status: 'shipped', actor: { kind: 'creator', creatorId: creatorB },
  });
  expect(result).toMatchObject({ ok: false, code: 'forbidden' });
});

it('개설자도 관리자와 같은 환불 요청 차단을 지난다', async () => {
  // 환불 요청이 들어온 건은 누가 눌러도 막힌다.
  const creatorA = await seedCreator();
  const { pledgeId } = await seedPledge({ creatorId: creatorA, refundRequestedAt: new Date() });
  const result = await setFulfillment({
    pledgeId, status: 'delivered', actor: { kind: 'creator', creatorId: creatorA },
  });
  expect(result).toMatchObject({ ok: false, code: 'refund_requested' });
});

it('delivered로 가면 delivered_at이 찍히고 되돌리면 지워진다', async () => {
  const creatorA = await seedCreator();
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  await setFulfillment({ pledgeId, status: 'delivered', actor: { kind: 'admin' } });
  expect(await readDeliveredAt(pledgeId)).not.toBeNull();
  await setFulfillment({ pledgeId, status: 'shipped', actor: { kind: 'admin' } });
  expect(await readDeliveredAt(pledgeId)).toBeNull();
});

it('운송장만 고쳐 다시 저장해도 첫 전달 시각이 밀리지 않는다', async () => {
  const creatorA = await seedCreator();
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  await setFulfillment({ pledgeId, status: 'delivered', actor: { kind: 'admin' } });
  const first = await readDeliveredAt(pledgeId);
  await setFulfillment({ pledgeId, status: 'delivered', trackingNumber: '1234', actor: { kind: 'admin' } });
  expect(await readDeliveredAt(pledgeId)).toEqual(first);
});

it('마크다운 프로젝트의 후원은 개설자 경로로 닿지 않는다', async () => {
  // 기존 26건이 "배송지는 개설자에게 제공되지 않는다"에 동의한 사람들이다. project_slug가
  // funding_projects에 대응 행을 갖지 않으므로 어떤 creatorId를 대도 소유 검사가 실패한다.
  const creatorA = await seedCreator();
  const { pledgeId } = await seedMarkdownProjectPledge();
  const result = await setFulfillment({
    pledgeId, status: 'shipped', actor: { kind: 'creator', creatorId: creatorA },
  });
  expect(result).toMatchObject({ ok: false });
});
