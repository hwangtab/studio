/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/toss', () => ({ cancelPayment: jest.fn(), confirmPayment: jest.fn(), fetchPayment: jest.fn() }));
jest.mock('./email', () => ({
  sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendFundingCancelledEmails: jest.fn().mockResolvedValue(null),
}));
jest.mock('./projects', () => ({ ...jest.requireActual('./projects'), getFundingProject: () => PROJECT }));

// eslint-disable-next-line import/first
import { cancelFundingPledge } from './cancel';
// eslint-disable-next-line import/first
import { confirmBankDeposit } from './bank-transfer';
// eslint-disable-next-line import/first
import { cancelPayment } from '../booking/toss';
// eslint-disable-next-line import/first
import { createFundingPledge, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

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
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

const markPaidWithToss = async (orderNo: string) => {
  const o = await findFundingOrderByOrderNo(orderNo);
  await client.execute({ sql: "UPDATE orders SET status='paid' WHERE id=?", args: [o!.id] });
  await client.execute({ sql: "INSERT INTO payments (id,order_id,payment_key) VALUES ('p1',?, 'pk_c')", args: [o!.id] });
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
beforeEach(async () => {
  await client.execute('DELETE FROM refunds');
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterAll(() => client.close());

describe('cancelFundingPledge', () => {
  it('토스 결제 셀프 취소 → 전액 환불·refunded', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [{ transactionKey: 'tx', cancelAmount: 5000 }] } });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'refunded', refundAmount: 5000 });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: 5000, idempotencyKey: `refund:${c.orderNo}:5000` }));
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });
  it('토스가 거절하면 상태를 되돌리고 failed refund를 남긴다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'X', message: '거절' });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
    const rows = await client.execute('SELECT status FROM refunds');
    expect(rows.rows[0].status).toBe('failed');
  });
  it('무통장 셀프 취소는 요청만 기록, 관리자는 refunded로 기록', async () => {
    const c = await createFundingPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [c.orderNo] });
    expect(await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW })).toEqual({ ok: true, mode: 'refund_requested', refundAmount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.refundRequestedAt).toBeInstanceOf(Date);
    expect(await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW })).toEqual({ ok: true, mode: 'recorded', refundAmount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });
  it('마감 후 셀프 취소는 거부, 관리자는 허용', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    const after = new Date('2026-11-05T00:00:00Z');
    expect((await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: after })).ok).toBe(false);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [] } });
    expect((await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: after })).ok).toBe(true);
  });
});

describe('confirmBankDeposit', () => {
  it('pending 무통장 → paid, expired도 되살린다, 토스 주문은 거부', async () => {
    const c = await createFundingPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(await confirmBankDeposit({ orderId: o!.id, now: NOW })).toEqual({ ok: true });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
    await client.execute({ sql: "UPDATE orders SET status='expired' WHERE id=?", args: [o!.id] });
    expect(await confirmBankDeposit({ orderId: o!.id, now: NOW })).toEqual({ ok: true });
    const t = await createFundingPledge(payloadFor({ customerEmail: 't@example.com', customerPhone: '010-5' }), PROJECT, reward('mail'), NOW); if (!t.ok) throw new Error();
    const to = await findFundingOrderByOrderNo(t.orderNo);
    expect((await confirmBankDeposit({ orderId: to!.id, now: NOW })).ok).toBe(false);
  });
});
