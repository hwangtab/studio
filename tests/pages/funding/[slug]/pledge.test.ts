/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/funding/projects', () => ({ ...jest.requireActual('../../../../lib/funding/projects'), getFundingProject: () => PROJECT }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/[locale]/funding/[slug]/pledge';
// eslint-disable-next-line import/first
import { createFundingPledge } from '../../../../lib/funding/service';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from '../../../../lib/funding/validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
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
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 1
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'cd', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});
const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());
afterAll(() => client.close());

describe('funding pledge getServerSideProps', () => {
  it('?reward=가 품절 리워드면 initialRewardId를 null로 준다', async () => {
    // totalQuantity 1을 결제 확정으로 채워 품절 상태를 만든다.
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('cd'), NOW); if (!c.ok) throw new Error();
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [c.orderNo] });

    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', slug: 'demo' }, query: { reward: 'cd' }, res,
    } as never);
    if (!('props' in result)) throw new Error('props 기대');
    const props = await result.props;
    expect(props.remaining.cd).toBe(0);
    expect(props.initialRewardId).toBeNull();
  });

  it('?reward=가 남아 있는 리워드면 그대로 initialRewardId로 쓴다', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', slug: 'demo' }, query: { reward: 'mail' }, res,
    } as never);
    if (!('props' in result)) throw new Error('props 기대');
    const props = await result.props;
    expect(props.initialRewardId).toBe('mail');
  });
});
