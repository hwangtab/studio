/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../../../lib/funding/service', () => ({
  ...jest.requireActual('../../../../../lib/funding/service'),
  expireStalePledges: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../../lib/funding/projects', () => ({
  ...jest.requireActual('../../../../../lib/funding/projects'),
  getFundingProject: (slug: string) => (slug === 'demo' ? PROJECT : null),
}));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from './index';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../../lib/funding/projects';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const PROJECT = parseFundingProject(`---
slug: demo
title: 데모
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
`, 'demo');

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
});

const call = async (body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, query: {}, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const VALID_BODY = {
  projectSlug: 'demo',
  rewardId: 'mail',
  quantity: 2,
  additionalAmount: 1000,
  customerName: '김후원',
  customerPhone: '010-1234-5678',
  customerEmail: 'a@example.com',
};

it('수기 등록 → orders paid·FND-M-·payments 없음, funding_pledges manual·bank_transfer·paidAt 있음', async () => {
  const r = await call(VALID_BODY);
  expect(r.status).toBe(201);
  expect(r.body.orderNo).toMatch(/^FND-M-/);

  const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
  expect(order.rows[0]?.status).toBe('paid');

  const payments = await client.execute({ sql: 'SELECT * FROM payments WHERE order_id = ?', args: [order.rows[0]?.id as string] });
  expect(payments.rows).toHaveLength(0);

  const pledge = await client.execute({ sql: 'SELECT * FROM funding_pledges WHERE order_id = ?', args: [order.rows[0]?.id as string] });
  expect(pledge.rows[0]?.entry_source).toBe('manual');
  expect(pledge.rows[0]?.payment_method).toBe('bank_transfer');
  expect(pledge.rows[0]?.paid_at).not.toBeNull();
});

it('quantity 11 → 400', async () => {
  const r = await call({ ...VALID_BODY, quantity: 11 });
  expect(r.status).toBe(400);
});
