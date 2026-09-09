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

  // 재고 조건이 paid만 보던 시절엔, 부분환불된 한정 리워드가 재고를 놓아준 것처럼 보여
  // 화면(aggregateProjectStatus 기준 품절)과 서버 판정이 어긋나 초과 판매가 났다.
  it('partially_refunded 후원도 한정 재고를 잡는다 — 다음 후원은 sold_out', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    const first = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'p1@example.com' }), PROJECT, reward('cd'), NOW);
    if (!first.ok) throw new Error();
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [first.orderNo] });
    const second = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'p2@example.com', customerPhone: '010-8' }), PROJECT, reward('cd'), NOW);
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

  it('같은 고객의 무통장 pending은 만료시키지 않는다(입금했을 수 있음)', async () => {
    const a = await createFundingPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW);
    await createFundingPledge(payloadFor({ paymentMethod: 'toss' }), PROJECT, reward('mail'), NOW);
    const prev = await findFundingOrderByOrderNo(a.ok ? a.orderNo : '');
    expect(prev?.status).toBe('pending');
  });

  it('다른 프로젝트에 후원해도 이 프로젝트의 기존 pending은 만료시키지 않는다', async () => {
    const a = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    const otherProject = { ...PROJECT, slug: 'other' };
    await createFundingPledge(payloadFor({ projectSlug: 'other' }), otherProject, reward('mail'), NOW);
    const prev = await findFundingOrderByOrderNo(a.ok ? a.orderNo : '');
    expect(prev?.status).toBe('pending');
  });
});

describe('createFundingPledge — 홀드 남용 상한', () => {
  it('같은 고객의 미만료 무통장 홀드가 2개면 세 번째는 too_many_holds', async () => {
    // 자기 홀드 해제는 toss pending만 푼다 — 무통장으로 반복 제출하면 12시간짜리 홀드가
    // 계속 쌓여 한정 리워드 재고가 통째로 잠긴다.
    const p = { paymentMethod: 'bank_transfer' as const, customerEmail: 'hold@example.com', customerPhone: '010-4' };
    expect((await createFundingPledge(payloadFor(p), PROJECT, reward('mail'), NOW)).ok).toBe(true);
    expect((await createFundingPledge(payloadFor(p), PROJECT, reward('mail'), NOW)).ok).toBe(true);
    expect(await createFundingPledge(payloadFor(p), PROJECT, reward('mail'), NOW)).toMatchObject({ ok: false, code: 'too_many_bank_holds' });
  });

  it('무통장 홀드 2건이 있어도 같은 고객의 토스 후원은 막지 않는다 — 결제수단별로 센다', async () => {
    const who = { customerEmail: 'mixed@example.com', customerPhone: '010-1' };
    await createFundingPledge(payloadFor({ ...who, paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW);
    await createFundingPledge(payloadFor({ ...who, paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW);
    expect((await createFundingPledge(payloadFor({ ...who, paymentMethod: 'toss' }), PROJECT, reward('mail'), NOW)).ok).toBe(true);
  });

  it('홀드가 만료됐거나 다른 프로젝트면 상한에 세지 않는다', async () => {
    const p = { paymentMethod: 'bank_transfer' as const, customerEmail: 'hold2@example.com', customerPhone: '010-3' };
    const long = 13 * 60 * 60 * 1000; // BANK_HOLD_SECONDS(12시간)를 넘긴 과거
    await createFundingPledge(payloadFor(p), PROJECT, reward('mail'), new Date(NOW.getTime() - long));
    await createFundingPledge(payloadFor(p), PROJECT, reward('mail'), new Date(NOW.getTime() - long));
    // 만료된 홀드 2개는 재고도 상한도 잡지 않는다.
    expect((await createFundingPledge(payloadFor(p), PROJECT, reward('mail'), NOW)).ok).toBe(true);
  });

  it('토스 재제출은 자기 홀드 해제 뒤에 세므로 상한에 걸리지 않는다', async () => {
    const p = { paymentMethod: 'toss' as const, customerEmail: 'wizard@example.com', customerPhone: '010-2' };
    for (let i = 0; i < 5; i += 1) {
      expect((await createFundingPledge(payloadFor(p), PROJECT, reward('mail'), NOW)).ok).toBe(true);
    }
  });
});

describe('findFundingOrderByOrderNo — 소문자 orderNo도 찾는다', () => {
  it('middleware.ts가 대문자 포함 경로를 소문자로 308 리다이렉트하므로, 소문자로 조회해도 대문자 주문을 찾아야 한다', async () => {
    const created = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable — 위 expect가 이미 걸렀다');

    const found = await findFundingOrderByOrderNo(created.orderNo.toLowerCase());
    expect(found?.orderNo).toBe(created.orderNo);
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

  it('partially_refunded도 paid와 같이 센다 — 후원은 살아 있고 재고도 나간 상태다', async () => {
    const partial = await createFundingPledge(payloadFor({ customerEmail: 'x@example.com', customerPhone: '010-8' }), PROJECT, reward('cd'), NOW);
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [partial.ok ? partial.orderNo : ''] });
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.raisedAmount).toBe(30000);
    expect(s.backerCount).toBe(1);
    expect(s.remaining.cd).toBe(0);
    expect(s.publicBackers).toEqual(['김후원']);
  });
});
