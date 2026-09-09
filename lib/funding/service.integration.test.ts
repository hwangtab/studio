/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { aggregateProjectStatus, createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

export const PROJECT = parseFundingProject(`---
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

export const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
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
beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
});
afterAll(() => client.close());

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

describe('createFundingPledge', () => {
  it('주문·후원을 만들고 금액을 서버가 계산한다', async () => {
    const r = await createFundingPledge(payloadFor({ additionalAmount: 1000 }), PROJECT, reward('mail'), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.orderNo).toMatch(/^FND-20261015-[0-9A-F]{8}$/);
    expect(r.amounts.totalAmount).toBe(6000);
    expect(r.holdExpiresAt.getTime()).toBe(NOW.getTime() + 900 * 1000);
    const order = await findFundingOrderByOrderNo(r.orderNo);
    expect(order?.type).toBe('funding');
    expect(order?.fundingPledge?.rewardTitle).toBe('감사 메일');
  });

  it('한정 수량 1개에 두 번 후원하면 두 번째는 sold_out', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    const first = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'x@example.com' }), PROJECT, reward('cd'), NOW);
    const second = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'y@example.com', customerPhone: '010-9' }), PROJECT, reward('cd'), NOW);
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, code: 'sold_out' });
  });

  it('홀드가 지난 pending은 재고를 잡지 않는다', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    await createFundingPledge(payloadFor({ rewardId: 'cd', shipping }), PROJECT, reward('cd'), new Date(NOW.getTime() - 1000 * 1000));
    const later = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'z@example.com', customerPhone: '010-8' }), PROJECT, reward('cd'), NOW);
    expect(later.ok).toBe(true);
  });

  it('같은 고객의 기존 pending을 만료시킨다(자기 홀드 해제)', async () => {
    const a = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    const prev = await findFundingOrderByOrderNo(a.ok ? a.orderNo : '');
    expect(prev?.status).toBe('expired');
  });

  it('다른 프로젝트에 후원해도 이 프로젝트의 기존 pending은 만료시키지 않는다', async () => {
    const a = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    const otherProject = { ...PROJECT, slug: 'other' };
    await createFundingPledge(payloadFor({ projectSlug: 'other' }), otherProject, reward('mail'), NOW);
    const prev = await findFundingOrderByOrderNo(a.ok ? a.orderNo : '');
    expect(prev?.status).toBe('pending');
  });
});

describe('expireStalePledges · aggregateProjectStatus', () => {
  it('만료 pending은 expired, 집계는 paid만 센다', async () => {
    const stale = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), new Date(NOW.getTime() - 2000 * 1000));
    const paid = await createFundingPledge(payloadFor({ customerEmail: 'p@example.com', customerPhone: '010-7', additionalAmount: 2000 }), PROJECT, reward('mail'), NOW);
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [paid.ok ? paid.orderNo : ''] });
    await expireStalePledges(NOW);
    expect((await findFundingOrderByOrderNo(stale.ok ? stale.orderNo : ''))?.status).toBe('expired');
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s).toEqual({ raisedAmount: 7000, backerCount: 1, remaining: { cd: 1, mail: null }, publicBackers: ['김후원'] });
  });
});
