/** @jest-environment node */
/**
 * 개설자가 자기 프로젝트의 배송 목록을 CSV로 내려받는 라우트를 실 DB(in-memory libSQL)로
 * 본다. 목 객체로는 증명할 수 없는 것들:
 *
 * 1) **남의 프로젝트는 404다** — `loadCreatorShipping`이 소유를 SQL JOIN으로 대조한다.
 * 2) **마감 전에는 409다** — 모금 중에는 셀프 취소가 자유로워 주소가 들락날락하므로
 *    배송지를 내보내지 않는다(`lib/funding/creatorShipping.ts` 주석).
 * 3) **CSV 열이 화면(ShippingTable)의 화이트리스트와 같다** — 결제 금액·서포터 이메일은
 *    `loadCreatorShipping`이 애초에 담지 않으므로 CSV에도 실릴 수 없다.
 * 4) **레이트리밋을 넘으면 429다.**
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorApi: jest.fn() }));
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../../pages/api/funding/creator/projects/[id]/shipping.csv';
// eslint-disable-next-line import/first
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
// eslint-disable-next-line import/first
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const DAY = 24 * 60 * 60 * 1000;
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());

const mockAuth = (creatorId: string) => {
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId });
};

const seedCreator = async (email: string): Promise<string> => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name: '개설자' }).returning();
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

const seedReward = async (projectId: string, requiresShipping = true): Promise<string> => {
  const rewardId = 'basic';
  await mockDb.insert(schema.fundingRewards).values({
    projectId,
    rewardId,
    title: '기본 리워드',
    description: '설명',
    amount: 30_000,
    requiresShipping,
    estimatedDelivery: '2026-11-01',
  });
  return rewardId;
};

const seedOrder = async (): Promise<string> => {
  const [order] = await mockDb.insert(schema.orders).values({
    orderNo: `FND-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
    type: 'funding',
    customerName: '홍길동',
    customerPhone: '010-1234-5678',
    customerEmail: 'backer-secret@example.com',
    itemAmount: 30_000,
    vatAmount: 0,
    totalAmount: 30_000,
    status: 'paid',
    manageToken: crypto.randomUUID(),
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
    quantity: 2,
    paymentMethod: 'toss',
    holdExpiresAt: new Date(Date.now() + DAY),
    shippingName: '홍길동',
    shippingPhone: '010-0000-1111',
    shippingPostcode: '03000',
    shippingAddress1: '서울시 은평구 어딘가로 1',
    shippingAddress2: '2층',
    shippingMemo: '경비실에 맡겨주세요',
    fulfillmentStatus: 'preparing',
    trackingCompany: 'CJ대한통운',
    trackingNumber: '1234567890',
    ...overrides,
  }).returning();
  return pledge.id;
};

/** 마감 뒤, 배송 필요 리워드로 후원 1건이 있는 프로젝트. */
const seedClosedProjectWithPledge = async (
  pledgeOverrides: Partial<typeof schema.fundingPledges.$inferInsert> = {},
): Promise<{ creatorId: string; projectId: string }> => {
  const creatorId = await seedCreator(`creator-${crypto.randomUUID()}@example.com`);
  const { id: projectId, slug } = await seedProject(creatorId, {
    startAt: new Date(Date.now() - 2 * DAY),
    endAt: new Date(Date.now() - DAY),
  });
  const rewardId = await seedReward(projectId);
  const orderId = await seedOrder();
  await seedPledge(orderId, slug, rewardId, pledgeOverrides);
  return { creatorId, projectId };
};

/** 아직 마감 전인(모금 중) 프로젝트. */
const seedLiveProjectWithPledge = async (): Promise<{ creatorId: string; projectId: string }> => {
  const creatorId = await seedCreator(`creator-${crypto.randomUUID()}@example.com`);
  const { id: projectId, slug } = await seedProject(creatorId, {
    startAt: new Date(Date.now() - DAY),
    endAt: new Date(Date.now() + DAY),
  });
  const rewardId = await seedReward(projectId);
  const orderId = await seedOrder();
  await seedPledge(orderId, slug, rewardId);
  return { creatorId, projectId };
};

const call = async (projectIdInUrl: string) => {
  const send = jest.fn();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ send, json });
  const setHeader = jest.fn();
  await handler(
    // socket은 접속기록이 IP를 뽑는 데 쓴다(lib/contracts/client-ip.ts) — 실제 요청에는 늘 있다.
    { method: 'GET', query: { id: projectIdInUrl }, headers: {}, socket: {} } as unknown as NextApiRequest,
    { setHeader, status } as unknown as NextApiResponse,
  );
  return {
    status: status.mock.calls[0][0] as number,
    csv: (send.mock.calls[0]?.[0] as string) ?? '',
    json: json.mock.calls[0]?.[0],
    headers: setHeader.mock.calls as [string, string][],
  };
};

beforeEach(async () => {
  jest.clearAllMocks();
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(true);
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);

  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM orders');
  await client.execute('DELETE FROM funding_rewards');
  await client.execute('DELETE FROM funding_projects');
  await client.execute('DELETE FROM funding_creators');
});

describe('개설자 배송 목록 CSV 내려받기', () => {
  it('남의 프로젝트는 404다', async () => {
    const { projectId } = await seedClosedProjectWithPledge();
    mockAuth('다른-개설자');
    const r = await call(projectId);
    expect(r.status).toBe(404);
  });

  it('마감 전에는 배송지를 내려받을 수 없다(409)', async () => {
    const { creatorId, projectId } = await seedLiveProjectWithPledge();
    mockAuth(creatorId);
    const r = await call(projectId);
    expect(r.status).toBe(409);
  });

  it('레이트리밋을 넘으면 429다', async () => {
    const { creatorId, projectId } = await seedClosedProjectWithPledge();
    mockAuth(creatorId);
    (consumeRateLimit as jest.Mock).mockResolvedValue(false);
    const r = await call(projectId);
    expect(r.status).toBe(429);
  });

  it('Origin이 허용되지 않으면 403이다', async () => {
    const { creatorId, projectId } = await seedClosedProjectWithPledge();
    mockAuth(creatorId);
    (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
    const r = await call(projectId);
    expect(r.status).toBe(403);
  });

  it('로그인하지 않으면 401이다', async () => {
    const { projectId } = await seedClosedProjectWithPledge();
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call(projectId);
    expect(r.status).toBe(401);
  });

  it('CSV에 담기는 열이 화면과 같은 화이트리스트다 — 금액·이메일은 없고 배송지는 있다', async () => {
    const { creatorId, projectId } = await seedClosedProjectWithPledge();
    mockAuth(creatorId);
    const r = await call(projectId);
    expect(r.status).toBe(200);
    const header = r.csv.split('\n')[0];
    expect(header).not.toContain('금액');
    expect(header).not.toContain('이메일');
    expect(header).not.toContain('주문');
    expect(header).toContain('배송지');
  });

  it('실제 배송지·리워드·수량이 CSV 본문에 실린다', async () => {
    const { creatorId, projectId } = await seedClosedProjectWithPledge();
    mockAuth(creatorId);
    const r = await call(projectId);
    expect(r.csv).toContain('홍길동');
    expect(r.csv).toContain('010-0000-1111');
    expect(r.csv).toContain('서울시 은평구 어딘가로 1');
    expect(r.csv).toContain('기본 리워드');
    expect(r.csv).toContain('CJ대한통운');
    // 결제 정보·서포터 이메일은 loadCreatorShipping이 애초에 담지 않는다.
    expect(r.csv).not.toContain('backer-secret@example.com');
    expect(r.csv).not.toContain('30000');
  });

  it('청약철회 대기 건은 맨 앞 발송금지 칸에 표시된다 (관리자 CSV의 shipHold와 같은 판정)', async () => {
    const { creatorId, projectId } = await seedClosedProjectWithPledge({
      refundRequestedAt: new Date(Date.now() - 60_000),
    });
    mockAuth(creatorId);
    const r = await call(projectId);
    const [header, first] = r.csv.split('\n');
    expect(header.trim().split(',')[0]).toBe('발송금지');
    expect(first.split(',')[0]).toBe('발송금지');
  });

  it('CSV 응답에 캐시 금지·다운로드 헤더가 실린다', async () => {
    const { creatorId, projectId } = await seedClosedProjectWithPledge();
    mockAuth(creatorId);
    const r = await call(projectId);
    expect(r.headers.some(([k, v]) => k === 'Cache-Control' && v === 'no-store')).toBe(true);
    expect(r.headers.some(([k]) => k === 'Content-Disposition')).toBe(true);
  });

  it('GET이 아니면 405다', async () => {
    const { creatorId, projectId } = await seedClosedProjectWithPledge();
    mockAuth(creatorId);
    const send = jest.fn();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ send, json });
    const setHeader = jest.fn();
    await handler(
      { method: 'POST', query: { id: projectId }, headers: {} } as unknown as NextApiRequest,
      { setHeader, status } as unknown as NextApiResponse,
    );
    expect(status.mock.calls[0][0]).toBe(405);
  });
});
