/** @jest-environment node */
/**
 * 개설자가 자기 프로젝트 후원의 발송 상태·송장을 직접 넣는 라우트를 실 DB(in-memory
 * libSQL)로 본다. 목 객체로는 증명할 수 없는 것 셋:
 *
 * 1) **소유가 다르면 403이다** — pledge가 실제로 속한 프로젝트를 pledgeId에서 되짚어
 *    판정한다(URL의 :id가 아니다).
 * 2) **마감 전에는 409다** — 화면은 마감 뒤에만 표를 보여 주지만 서버가 같은 선을
 *    다시 긋는다. URL에 자기 소유의 다른(이미 마감된) 프로젝트 id를 넣어도 우회되지
 *    않는다(라우트가 URL id로 게이트를 판정하지 않기 때문).
 * 3) **배송이 필요 없는 리워드는 409다** — 디지털 전용 리워드의 발송 상태를 개설자가
 *    직접 바꿀 수 없다.
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
import handler from '../../../../pages/api/funding/creator/projects/[id]/fulfillment';
// eslint-disable-next-line import/first
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
// eslint-disable-next-line import/first
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
// eslint-disable-next-line import/first
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const CREATOR_A = 'creator-a';
const CREATOR_B = 'creator-b';

const HOUR = 3600;
const NOW_SEC = Math.floor(Date.now() / 1000);

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

interface ProjectFixture {
  id: string;
  slug: string;
  creatorId: string;
  status: 'auto' | 'draft' | 'closed';
  startAt: Date;
  endAt: Date;
}

const insertProject = async (fixture: ProjectFixture) => {
  await mockDb.insert(schema.fundingProjects).values({
    id: fixture.id,
    slug: fixture.slug,
    creatorId: fixture.creatorId,
    title: '제목',
    summary: '요약',
    content: '본문',
    coverUrl: 'https://example.com/cover.webp',
    goalAmount: 1_000_000,
    startAt: fixture.startAt,
    endAt: fixture.endAt,
    status: fixture.status,
  });
};

const insertReward = async (projectId: string, rewardId: string, requiresShipping: boolean) => {
  await mockDb.insert(schema.fundingRewards).values({
    id: `reward-row-${rewardId}-${projectId}`,
    projectId,
    rewardId,
    title: '리워드',
    description: '설명',
    amount: 30000,
    requiresShipping,
    estimatedDelivery: '2026-12-01',
  });
};

const insertOrderAndPledge = async (pledgeId: string, orderId: string, projectSlug: string, rewardId: string) => {
  await client.execute(`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
    item_amount, vat_amount, total_amount, manage_token)
    VALUES ('${orderId}','FND-20261015-${orderId}','funding','paid','김후원','010-1','a@example.com',27273,2727,30000,'tok-${orderId}')`);
  await client.execute(`INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount,
    quantity, additional_amount, payment_method, hold_expires_at, fulfillment_status,
    shipping_name, shipping_phone, shipping_postcode, shipping_address1)
    VALUES ('${pledgeId}','${orderId}','${projectSlug}','${rewardId}','리워드',30000,1,0,'bank_transfer',9999999999,'none',
    '홍길동','010-1111-2222','03000','서울시 어딘가로 1')`);
};

const pledgeRow = async (pledgeId: string) => {
  const r = await client.execute(`SELECT fulfillment_status, tracking_company, tracking_number, fulfillment_updated_by
    FROM funding_pledges WHERE id = '${pledgeId}'`);
  return r.rows[0] as unknown as {
    fulfillment_status: string; tracking_company: string | null; tracking_number: string | null;
    fulfillment_updated_by: string | null;
  };
};

const call = async (
  projectIdInUrl: string,
  body: Record<string, unknown>,
) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler(
    { method: 'POST', query: { id: projectIdInUrl }, body, headers: {}, socket: {} } as unknown as NextApiRequest,
    res,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
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
  await mockDb.insert(schema.fundingCreators).values([
    { id: CREATOR_A, email: 'a@example.com', name: '개설자A' },
    { id: CREATOR_B, email: 'b@example.com', name: '개설자B' },
  ]);
});

describe('개설자 발송 상태 저장 라우트', () => {
  it('Origin 검사를 통과 못 하면 403', async () => {
    (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
    const r = await call('proj-1', { pledgeId: 'pledge-1', fulfillmentStatus: 'shipped' });
    expect(r.status).toBe(403);
  });

  it('로그인이 없으면 401', async () => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call('proj-1', { pledgeId: 'pledge-1', fulfillmentStatus: 'shipped' });
    expect(r.status).toBe(401);
  });

  it('남의 프로젝트 후원은 403이다', async () => {
    // creator-a의 프로젝트(마감됨)에 딸린 pledge를, creator-b가 자기 세션으로 시도한다.
    await insertProject({
      id: 'proj-a', slug: 'proj-a', creatorId: CREATOR_A, status: 'closed',
      startAt: new Date((NOW_SEC - 30 * 86400) * 1000), endAt: new Date((NOW_SEC - 86400) * 1000),
    });
    await insertReward('proj-a', 'basic', true);
    await insertOrderAndPledge('pledge-of-a', 'order-a', 'proj-a', 'basic');

    mockAuth(CREATOR_B);
    const r = await call('proj-a', { pledgeId: 'pledge-of-a', fulfillmentStatus: 'shipped' });
    expect(r.status).toBe(403);
    expect((await pledgeRow('pledge-of-a')).fulfillment_status).toBe('none');
  });

  it('마감 전에는 발송 상태를 바꿀 수 없다', async () => {
    // 화면이 마감 뒤에만 목록을 보여주므로 서버도 같은 선을 지켜야 한다.
    await insertProject({
      id: 'proj-live', slug: 'proj-live', creatorId: CREATOR_A, status: 'auto',
      startAt: new Date((NOW_SEC - HOUR) * 1000), endAt: new Date((NOW_SEC + 30 * 86400) * 1000),
    });
    await insertReward('proj-live', 'basic', true);
    await insertOrderAndPledge('pledge-live', 'order-live', 'proj-live', 'basic');

    mockAuth(CREATOR_A);
    const r = await call('proj-live', { pledgeId: 'pledge-live', fulfillmentStatus: 'shipped' });
    expect(r.status).toBe(409);
    expect((await pledgeRow('pledge-live')).fulfillment_status).toBe('none');
  });

  it('URL에 자기 소유의 다른(마감된) 프로젝트 id를 넣어도 마감 게이트를 우회할 수 없다', async () => {
    await insertProject({
      id: 'proj-closed-a', slug: 'proj-closed-a', creatorId: CREATOR_A, status: 'closed',
      startAt: new Date((NOW_SEC - 30 * 86400) * 1000), endAt: new Date((NOW_SEC - 86400) * 1000),
    });
    await insertProject({
      id: 'proj-live-a', slug: 'proj-live-a', creatorId: CREATOR_A, status: 'auto',
      startAt: new Date((NOW_SEC - HOUR) * 1000), endAt: new Date((NOW_SEC + 30 * 86400) * 1000),
    });
    await insertReward('proj-live-a', 'basic', true);
    await insertOrderAndPledge('pledge-live-a', 'order-live-a', 'proj-live-a', 'basic');

    mockAuth(CREATOR_A);
    // URL은 마감된 proj-closed-a를 가리키지만 pledgeId는 아직 진행 중인 proj-live-a 것.
    const r = await call('proj-closed-a', { pledgeId: 'pledge-live-a', fulfillmentStatus: 'shipped' });
    expect(r.status).toBe(404);
    expect((await pledgeRow('pledge-live-a')).fulfillment_status).toBe('none');
  });

  it('배송이 필요 없는 리워드는 바꿀 수 없다', async () => {
    await insertProject({
      id: 'proj-digital', slug: 'proj-digital', creatorId: CREATOR_A, status: 'closed',
      startAt: new Date((NOW_SEC - 30 * 86400) * 1000), endAt: new Date((NOW_SEC - 86400) * 1000),
    });
    await insertReward('proj-digital', 'digital', false);
    await insertOrderAndPledge('pledge-digital', 'order-digital', 'proj-digital', 'digital');

    mockAuth(CREATOR_A);
    const r = await call('proj-digital', { pledgeId: 'pledge-digital', fulfillmentStatus: 'shipped' });
    expect(r.status).toBe(409);
    expect((await pledgeRow('pledge-digital')).fulfillment_status).toBe('none');
  });

  it('발송 상태와 송장을 저장하고, 감사 기록(누가 바꿨는지)을 남긴다', async () => {
    await insertProject({
      id: 'proj-ok', slug: 'proj-ok', creatorId: CREATOR_A, status: 'closed',
      startAt: new Date((NOW_SEC - 30 * 86400) * 1000), endAt: new Date((NOW_SEC - 86400) * 1000),
    });
    await insertReward('proj-ok', 'basic', true);
    await insertOrderAndPledge('pledge-ok', 'order-ok', 'proj-ok', 'basic');

    mockAuth(CREATOR_A);
    const r = await call('proj-ok', {
      pledgeId: 'pledge-ok', fulfillmentStatus: 'shipped', trackingCompany: 'CJ', trackingNumber: '1234',
    });
    expect(r.status).toBe(200);
    const row = await pledgeRow('pledge-ok');
    expect(row.fulfillment_status).toBe('shipped');
    expect(row.tracking_company).toBe('CJ');
    expect(row.tracking_number).toBe('1234');
    expect(row.fulfillment_updated_by).toBe(`creator:${CREATOR_A}`);
  });

  it('응답에 다른 후원의 정보가 실리지 않는다', async () => {
    await insertProject({
      id: 'proj-resp', slug: 'proj-resp', creatorId: CREATOR_A, status: 'closed',
      startAt: new Date((NOW_SEC - 30 * 86400) * 1000), endAt: new Date((NOW_SEC - 86400) * 1000),
    });
    await insertReward('proj-resp', 'basic', true);
    await insertOrderAndPledge('pledge-resp', 'order-resp', 'proj-resp', 'basic');

    mockAuth(CREATOR_A);
    const r = await call('proj-resp', { pledgeId: 'pledge-resp', fulfillmentStatus: 'shipped' });
    expect(r.body).toEqual({ ok: true });
  });

  it('존재하지 않는 pledgeId는 404', async () => {
    mockAuth(CREATOR_A);
    const r = await call('proj-none', { pledgeId: 'no-such-pledge', fulfillmentStatus: 'shipped' });
    expect(r.status).toBe(404);
  });
});
