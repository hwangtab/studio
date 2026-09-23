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
import { eq } from 'drizzle-orm';
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
): Promise<{ pledgeId: string; slug: string }> => {
  const slug = await seedProject(opts.creatorId);
  const pledgeId = await seedPledgeRow(slug, {
    refundRequestedAt: opts.refundRequestedAt,
  });
  return { pledgeId, slug };
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

const readPledgeRow = async (pledgeId: string) => {
  const r = await client.execute({
    sql: 'SELECT fulfillment_status, tracking_company, tracking_number, fulfillment_updated_by FROM funding_pledges WHERE id = ?',
    args: [pledgeId],
  });
  return r.rows[0] as unknown as {
    fulfillment_status: string; tracking_company: string | null; tracking_number: string | null;
    fulfillment_updated_by: string | null;
  };
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

/**
 * 개설자 성공 경로. 지금까지 creator actor를 쓰는 테스트 셋(위 forbidden 둘 +
 * refund_requested 하나)이 전부 UPDATE 앞에서 반환돼, `${ownerCondition}`이 실린 UPDATE
 * 문장 자체가 한 번도 실행되지 않고 있었다 — 그 SQL이 깨져도(예: `AND` 누락, 컬럼명 오타로
 * SQLite 런타임 에러) 이 파일의 어떤 테스트도 못 잡았을 것이다. 이 테스트가 그 문장을
 * 실제로 실행시킨다.
 */
it('개설자는 자기 프로젝트의 후원을 실제로 발송 처리할 수 있다', async () => {
  const creatorA = await seedCreator();
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  const result = await setFulfillment({
    pledgeId, status: 'shipped', trackingCompany: 'CJ대한통운', trackingNumber: '111222333',
    actor: { kind: 'creator', creatorId: creatorA },
  });
  expect(result).toEqual({ ok: true });
  const row = await readPledgeRow(pledgeId);
  expect(row.fulfillment_status).toBe('shipped');
  expect(row.tracking_company).toBe('CJ대한통운');
  expect(row.tracking_number).toBe('111222333');
  // 누가 바꿨는지는 admin_memo가 아니라 fulfillment_updated_by에 남는다(retention.ts가
  // admin_memo만 파기하므로, 감사 기록이 개인정보와 같이 사라지지 않게 하려는 것이다).
  expect(row.fulfillment_updated_by).toBe(`creator:${creatorA}`);
});

/**
 * 관리자 actor가 남기는 값도 단언한다 — 이게 없으면 `fulfillment.ts`의
 * `actor.kind === 'admin' ? 'admin' : ...`을 누가 `actor.kind === 'creator' ? ... : null`로
 * 뒤집어도 이 파일의 어떤 테스트도 못 잡는다. 그러면 관리자 변경만 기록이 비어 "누가
 * 바꿨나"가 절반만 남는다.
 */
it('관리자 actor는 fulfillment_updated_by에 admin을 남긴다', async () => {
  const creatorA = await seedCreator();
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  const result = await setFulfillment({ pledgeId, status: 'shipped', actor: { kind: 'admin' } });
  expect(result).toEqual({ ok: true });
  expect((await readPledgeRow(pledgeId)).fulfillment_updated_by).toBe('admin');
});

/**
 * `${ownerCondition}`을 직접 겨냥한다 — 사전 검사(db.query.fundingProjects.findFirst)는
 * 통과시키되 UPDATE의 EXISTS(실제 DB)만 걸리는 상황을 만든다. 사전 검사 호출을 낡은
 * 값으로 한 번 스텁해 "그 사이 프로젝트 소유가 넘어갔다"는 좁은 경합 창을 재현했다 —
 * tests/api/admin/funding/pledges/setFulfillment.integration.test.ts가 findFundingOrderById를
 * 스텁해 환불/주문 상태 경합을 재현하는 것과 같은 수법이다. 이게 없으면 `${ownerCondition}`을
 * 통째로 지워도(2차 방어선이 사라져도) 이 파일의 어떤 테스트도 실패하지 않는다.
 */
it('사전 검사 뒤 프로젝트 소유가 바뀌면 UPDATE의 WHERE가 막는다', async () => {
  const creatorA = await seedCreator();
  const creatorB = await seedCreator();
  const { pledgeId, slug } = await seedPledge({ creatorId: creatorA });

  // 사전 검사가 보는 조회만 낡게 고정한다 — "아직 creatorA 소유"라고 알려 준다.
  // findFirst의 실제 반환 타입(쿼리 빌더 겸용 thenable)은 테스트가 흉내 낼 이유가 없어
  // any로 낮춰 스텁한다.
  const staleProjectFindFirst = jest.spyOn(mockDb.query.fundingProjects as never, 'findFirst')
    .mockResolvedValueOnce({ creatorId: creatorA } as never);
  // 실제 DB에서는 그 사이 소유가 creatorB로 넘어갔다.
  await mockDb.update(schema.fundingProjects).set({ creatorId: creatorB })
    .where(eq(schema.fundingProjects.slug, slug));

  const result = await setFulfillment({
    pledgeId, status: 'shipped', actor: { kind: 'creator', creatorId: creatorA },
  });

  // 사전 검사는 낡은 값을 보고 통과했지만, UPDATE의 EXISTS는 실제(creatorB) 소유를 보고
  // 0행을 반환한다 — conflict가 나오는 이유가 ownerCondition 자신이어야 한다.
  expect(result).toMatchObject({ ok: false, code: 'conflict' });
  expect((await readPledgeRow(pledgeId)).fulfillment_status).toBe('none');
  staleProjectFindFirst.mockRestore();
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
  // code까지 못 박는다 — 이 테스트가 지키는 것은 "기존 26건의 동의를 소급해 뒤집지 않는다"라
  // not_found·not_live 등 다른 이유로 우연히 막힌 것과는 구분해야 한다.
  expect(result).toMatchObject({ ok: false, code: 'forbidden' });
});
