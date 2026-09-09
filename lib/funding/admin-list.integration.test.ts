/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { listFundingOrders } from './admin-list';
// eslint-disable-next-line import/first
import { createFundingPledge } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

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

const PROJECT_A = project('a');
const PROJECT_B = project('b');

const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'a', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

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

const reward = (p: typeof PROJECT_A) => p.rewards.find((r) => r.id === 'mail')!;

it('slug 필터가 DB 쪽에서 걸려 201건 잘림 이전에 정확한 건수만 돌아온다', async () => {
  await createFundingPledge(payloadFor({ customerEmail: 'a1@example.com', customerPhone: '010-0001' }), PROJECT_A, reward(PROJECT_A), NOW);
  await createFundingPledge(payloadFor({ customerEmail: 'a2@example.com', customerPhone: '010-0002' }), PROJECT_A, reward(PROJECT_A), NOW);
  await createFundingPledge(payloadFor({ customerEmail: 'a3@example.com', customerPhone: '010-0003' }), PROJECT_A, reward(PROJECT_A), NOW);
  await createFundingPledge(payloadFor({ projectSlug: 'b', customerEmail: 'b1@example.com', customerPhone: '010-0004' }), PROJECT_B, reward(PROJECT_B), NOW);
  await createFundingPledge(payloadFor({ projectSlug: 'b', customerEmail: 'b2@example.com', customerPhone: '010-0005' }), PROJECT_B, reward(PROJECT_B), NOW);

  const all = await listFundingOrders(null);
  expect(all).toHaveLength(5);

  const onlyB = await listFundingOrders('b');
  expect(onlyB).toHaveLength(2);
  expect(onlyB.every((o) => o.fundingPledge?.projectSlug === 'b')).toBe(true);
});
