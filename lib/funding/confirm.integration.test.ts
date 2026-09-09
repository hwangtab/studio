/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/toss', () => ({ confirmPayment: jest.fn(), fetchPayment: jest.fn() }));
jest.mock('./email', () => ({ sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null) }));

// eslint-disable-next-line import/first
import { confirmFundingPledge } from './confirm';
// eslint-disable-next-line import/first
import { confirmPayment } from '../booking/toss';
// eslint-disable-next-line import/first
import { createFundingPledge, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const mockConfirm = confirmPayment as jest.Mock;

// service.integration.test.ts의 PROJECT·payloadFor를 그대로 재사용하는 것이 아니라 값만
// 복제한다 — 테스트 파일을 모듈로 import하면 그 파일의 jest.mock('../../db/client', ...)가
// 이 파일의 mockDb 클로저를 덮어써 서로 다른 in-memory DB를 보게 된다(실제 확인됨).
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
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

const approved = (orderNo: string, amount: number) => ({
  ok: true,
  payment: { paymentKey: 'pk_1', orderId: orderNo, status: 'DONE', totalAmount: amount, method: '카드', approvedAt: '2026-10-15T03:01:00Z' },
});

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

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
  jest.clearAllMocks();
  // confirm.ts의 홀드 만료 판정은 Date.now()(실제 벽시계)와 비교한다 — NOW 픽스처가 실행 시점의
  // 실제 시각보다 미래라 고정하지 않으면 "홀드 만료" 케이스가 항상 만료되지 않은 것으로 읽힌다.
  jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(() => client.close());

describe('confirmFundingPledge', () => {
  it('금액이 맞으면 승인하고 paid·payments·paidAt을 기록한다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(r).toMatchObject({ ok: true, orderNo: c.orderNo, projectSlug: 'demo' });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.payments[0].paymentKey).toBe('pk_1');
    expect(o?.fundingPledge?.paidAt).toBeInstanceOf(Date);
  });

  it('이미 paid면 토스를 부르지 않고 성공(멱등)', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    mockConfirm.mockClear();
    const again = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(again.ok).toBe(true);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('금액 불일치·홀드 만료는 토스를 부르지 않고 거부', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    expect((await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk', amount: 4999 })).ok).toBe(false);
    const stale = await createFundingPledge(
      payloadFor({ customerEmail: 's@example.com', customerPhone: '010-0' }),
      PROJECT,
      reward('mail'),
      new Date(NOW.getTime() - 2000 * 1000),
    );
    if (!stale.ok) throw new Error();
    const r = await confirmFundingPledge({ orderNo: stale.orderNo, paymentKey: 'pk', amount: 5000 });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('예약 주문번호로 오면 not_found', async () => {
    expect((await confirmFundingPledge({ orderNo: 'SNB-20260101-ABCDEF12', paymentKey: 'pk', amount: 1 })).ok).toBe(false);
  });
});
