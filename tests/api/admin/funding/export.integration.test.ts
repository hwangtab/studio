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
