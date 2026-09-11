/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../../pages/api/admin/funding/export';
// eslint-disable-next-line import/first
import { createFundingPledge } from '../../../../lib/funding/service';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from '../../../../lib/funding/validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const project = (slug: string) => parseFundingProject(`---
slug: ${slug}
title: ${slug}
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, slug);

const PROJECT_A = project('demo');
const PROJECT_B = project('other');
const reward = (p: typeof PROJECT_A) => p.rewards.find((r) => r.id === 'mail')!;

const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

const call = async (query: Record<string, string>) => {
  const send = jest.fn();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ send, json });
  const setHeader = jest.fn();
  await handler({ method: 'GET', query, headers: {} } as unknown as NextApiRequest, { setHeader, status } as unknown as NextApiResponse);
  return {
    status: status.mock.calls[0][0] as number,
    csv: (send.mock.calls[0]?.[0] as string) ?? '',
    json: json.mock.calls[0]?.[0],
    headers: setHeader.mock.calls as [string, string][],
  };
};

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
beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  jest.clearAllMocks();
});

const seed = async (over: Partial<CreatePledgePayload>, status: string, proj = PROJECT_A) => {
  const c = await createFundingPledge(payloadFor(over), proj, reward(proj), NOW);
  if (!c.ok) throw new Error('seed 실패');
  await client.execute({ sql: 'UPDATE orders SET status=? WHERE order_no=?', args: [status, c.orderNo] });
  return c.orderNo;
};

// 부분환불 건도 리워드는 나가야 한다 — 발송 목록에서 빠지면 그대로 미발송이 된다.
it('paid와 partially_refunded를 함께 싣고, 그 밖의 상태는 뺀다', async () => {
  const paid = await seed({ customerEmail: 'p@example.com', customerPhone: '010-1' }, 'paid');
  const partial = await seed({ customerEmail: 'q@example.com', customerPhone: '010-2' }, 'partially_refunded');
  await seed({ customerEmail: 'r@example.com', customerPhone: '010-3' }, 'refunded');
  await seed({ customerEmail: 's@example.com', customerPhone: '010-4' }, 'pending');

  const r = await call({});
  expect(r.status).toBe(200);
  expect(r.csv).toContain(paid);
  expect(r.csv).toContain(partial);
  expect(r.csv).toContain('partially_refunded');
  expect(r.csv.trim().split('\n')).toHaveLength(3); // 헤더 + 2건
});

it('slug 필터는 DB에서 걸린다', async () => {
  const mine = await seed({ customerEmail: 'm@example.com', customerPhone: '010-5' }, 'paid');
  const other = await seed({ projectSlug: 'other', customerEmail: 'o@example.com', customerPhone: '010-6' }, 'paid', PROJECT_B);
  const r = await call({ slug: 'demo' });
  expect(r.csv).toContain(mine);
  expect(r.csv).not.toContain(other);
});

// 목록 화면의 201건 상한을 export가 물려 쓰면 202번째 후원자의 주소가 조용히 빠진다.
it('201건 상한이 없다 — 전량이 실린다', async () => {
  const orderIds: string[] = [];
  for (let i = 0; i < 205; i += 1) orderIds.push(`o${i}`);
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM orders');
  for (const id of orderIds) {
    await client.execute({
      sql: "INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token) VALUES (?,?,'funding','paid','김',?,?,4545,455,5000,?)",
      args: [id, `FND-2026-${id}`, `010-${id}`, `${id}@example.com`, `tok-${id}`],
    });
    await client.execute({
      sql: "INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount, payment_method, hold_expires_at) VALUES (?,?,'demo','mail','감사 메일',5000,1,0,'toss',9999999999)",
      args: [`fp-${id}`, id],
    });
  }
  const r = await call({});
  expect(r.csv.trim().split('\n')).toHaveLength(206);
});

// slug는 그대로 파일명(Content-Disposition)에 들어간다 — 헤더 인젝션 소재를 남기지 않는다.
it('형식이 어긋난 slug는 400이고 CSV를 만들지 않는다', async () => {
  const r = await call({ slug: 'a b"\r\nX: y' });
  expect(r.status).toBe(400);
  expect(r.headers.some(([k]) => k === 'Content-Disposition')).toBe(false);
});

// 택배사 없이 송장번호만으로는 조회 링크를 만들 수 없다 — 발송 실무용 CSV의 핵심 컬럼이다.
it('trackingCompany 컬럼이 헤더와 본문에 함께 실린다', async () => {
  const orderNo = await seed({ customerEmail: 't@example.com', customerPhone: '010-7' }, 'paid');
  await client.execute({
    sql: `UPDATE funding_pledges SET tracking_company = 'CJ대한통운', tracking_number = '123456789'
          WHERE order_id = (SELECT id FROM orders WHERE order_no = ?)`,
    args: [orderNo],
  });
  const r = await call({});
  const [header, row] = r.csv.trim().split('\n');
  expect(header.split(',')).toContain('trackingCompany');
  expect(header.indexOf('trackingCompany')).toBeLessThan(header.indexOf('trackingNumber'));
  expect(row).toContain('CJ대한통운');
  expect(row).toContain('123456789');
});

/**
 * 무통장 청약철회는 orders.status를 건드리지 않는다(자동 환불 경로가 없어 운영자가 계좌로
 * 보낸다) — 그래서 이 CSV의 상태 칸은 끝까지 paid다. refundRequestedAt이 빠져 있던 동안
 * 이 CSV는 **취소를 요청한 사람의 주소를 발송 목록에 그대로 실어 보냈다.**
 */
it('환불 요청 건은 status가 paid여도 refundRequestedAt이 CSV에 실린다', async () => {
  const orderNo = await seed({ customerEmail: 'c@example.com', customerPhone: '010-8' }, 'paid');
  await client.execute({
    sql: `UPDATE funding_pledges SET refund_requested_at = ?, admin_memo = '재고 확인 필요'
          WHERE order_id = (SELECT id FROM orders WHERE order_no = ?)`,
    args: [Math.floor(new Date('2026-10-16T02:00:00Z').getTime() / 1000), orderNo],
  });
  const r = await call({});
  const [header, row] = r.csv.trim().split('\n');
  // 마지막 컬럼에는 CRLF의 \r가 붙어 온다 — 열 이름만 비교한다.
  const columns = header.trim().split(',');
  expect(columns).toContain('refundRequestedAt');
  expect(columns).toContain('adminMemo');
  expect(row).toContain('2026-10-16T02:00:00.000Z');
  // 웹훅·운영자가 남긴 메모도 발송 실무 화면 어디에도 안 보이던 값이다.
  expect(row).toContain('재고 확인 필요');
  expect(row).toContain('paid');
});

/**
 * ISO 타임스탬프 한 칸으로는 부족하다 — 주소로 정렬해 라벨을 뽑는 실무에서 눈에 안 들어온다.
 * 사람이 읽는 값이 한 칸 있어야 이 열만 훑어서 걸러낼 수 있다.
 */
it('shipHold 칸에 사람이 읽는 발송금지 표시가 실린다', async () => {
  const hold = await seed({ customerEmail: 'h@example.com', customerPhone: '010-10' }, 'paid');
  await seed({ customerEmail: 'n@example.com', customerPhone: '010-11' }, 'paid');
  await client.execute({
    sql: `UPDATE funding_pledges SET refund_requested_at = ?
          WHERE order_id = (SELECT id FROM orders WHERE order_no = ?)`,
    args: [Math.floor(new Date('2026-10-16T02:00:00Z').getTime() / 1000), hold],
  });
  const r = await call({});
  const lines = r.csv.trim().split('\n');
  const idx = lines[0].trim().split(',').indexOf('shipHold');
  expect(idx).toBe(1); // 주문번호 바로 옆 — 가장 먼저 보이는 자리
  const held = lines.find((l) => l.includes(hold))!;
  const normal = lines.slice(1).find((l) => !l.includes(hold))!;
  expect(held.split(',')[idx]).toBe('발송금지');
  expect(normal.split(',')[idx]).toBe('');
});

it('환불 요청이 없는 건의 refundRequestedAt은 빈 칸이다', async () => {
  await seed({ customerEmail: 'd@example.com', customerPhone: '010-9' }, 'paid');
  const r = await call({});
  const [header, row] = r.csv.trim().split('\n');
  const idx = header.trim().split(',').indexOf('refundRequestedAt');
  expect(row.split(',')[idx]).toBe('');
});
