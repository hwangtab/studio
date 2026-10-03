/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/toss', () => ({ ...jest.requireActual('../booking/toss'), cancelPayment: jest.fn() }));
jest.mock('./email', () => ({ ...jest.requireActual('./email'), sendFundingLineRefundEmails: jest.fn().mockResolvedValue(null) }));
jest.mock('./repository', () => ({ ...jest.requireActual('./repository'), getFundingProjectAsync: jest.fn(async () => PROJECT) }));

// eslint-disable-next-line import/first
import { refundFundingLine } from './lineRefund';
// eslint-disable-next-line import/first
import { cancelPayment } from '../booking/toss';
// eslint-disable-next-line import/first
import { sendFundingLineRefundEmails } from './email';
// eslint-disable-next-line import/first
import { aggregateProjectStatus, createFundingPledge, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import { activePledgeLines, pledgeLines } from './pledgeLines';
// eslint-disable-next-line import/first
import { remainingRefundable } from './refundable';
// eslint-disable-next-line import/first
import { aggregateAdminFundingTotals } from './admin-list';

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
  - id: mp3
    title: MP3
    description: d
    amount: 10000
    requiresShipping: false
    estimatedDelivery: 2026-10
  - id: book
    title: 시집
    description: d
    amount: 13000
    totalQuantity: 2
    requiresShipping: true
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
beforeEach(async () => {
  await client.execute('DELETE FROM refunds');
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  jest.clearAllMocks();
});
afterAll(() => client.close());

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

/** MP3 1 + 시집 2 = 36,000원을 결제 확정 상태로 만든다. */
const paidOrder = async () => {
  const items = [{ rewardId: 'mp3', quantity: 1 }, { rewardId: 'book', quantity: 2 }];
  const c = await createFundingPledge({
    projectSlug: 'demo', items, additionalAmount: 0, paymentMethod: 'toss',
    customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
    displayNamePublic: false, termsAgreed: true,
    shipping: { name: '김후원', phone: '010-1', postcode: '12345', address1: '서울' },
  }, PROJECT, items.map((i) => ({ reward: reward(i.rewardId), quantity: i.quantity })), NOW);
  if (!c.ok) throw new Error('생성 실패');
  const o = await findFundingOrderByOrderNo(c.orderNo);
  await client.execute({ sql: "UPDATE orders SET status='paid' WHERE id=?", args: [o!.id] });
  await client.execute({ sql: "INSERT INTO payments (id, order_id, payment_key, method) VALUES ('pay1', ?, 'pk_1', '카드')", args: [o!.id] });
  return c.orderNo;
};

const tossOk = (cancelledTotal: number) =>
  (cancelPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { cancels: [{ transactionKey: 'tx', cancelAmount: cancelledTotal }] } });

describe('refundFundingLine', () => {
  it('시집 1권만 돌려주면 그 금액만 토스에 부분 취소하고, 줄·재고·상태·메일이 맞는다', async () => {
    const orderNo = await paidOrder();
    tossOk(13000);
    const r = await refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: '청약철회' });
    expect(r).toEqual({ ok: true, amount: 13000, orderStatus: 'partially_refunded' });
    expect((cancelPayment as jest.Mock).mock.calls[0][0]).toMatchObject({ cancelAmount: 13000, idempotencyKey: `line-refund:${orderNo}:book:1` });

    const order = await findFundingOrderByOrderNo(orderNo);
    expect(order!.status).toBe('partially_refunded');
    expect(remainingRefundable(order!)).toBe(36000 - 13000);
    const lines = pledgeLines(order!.fundingPledge!);
    expect(lines.find((l) => l.rewardId === 'book')).toMatchObject({ quantity: 2, refundedQuantity: 1 });
    expect(activePledgeLines(lines).find((l) => l.rewardId === 'book')!.quantity).toBe(1);
    // 한정 2권 중 1권이 재고로 돌아온다.
    expect((await aggregateProjectStatus(PROJECT, NOW)).remaining.book).toBe(1);
    expect(sendFundingLineRefundEmails).toHaveBeenCalledWith(expect.anything(), expect.anything(),
      { rewardTitle: '시집', quantity: 1, amount: 13000, reason: '청약철회' });
  });

  it('같은 줄을 동시에 1개씩 두 번 돌려주면 토스 멱등 키가 서로 다르다', async () => {
    const orderNo = await paidOrder();
    let cancelled = 0;
    (cancelPayment as jest.Mock).mockImplementation(async ({ cancelAmount }: { cancelAmount: number }) => {
      cancelled += cancelAmount;
      return { ok: true, payment: { cancels: [{ transactionKey: `tx${cancelled}`, cancelAmount: cancelled }] } };
    });
    const results = await Promise.all([
      refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: 'a' }),
      refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: 'b' }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    const keys = (cancelPayment as jest.Mock).mock.calls.map((c) => c[0].idempotencyKey).sort();
    expect(keys).toEqual([`line-refund:${orderNo}:book:1`, `line-refund:${orderNo}:book:2`]);
  });

  it('부분 환불한 금액만큼 공개 모금액과 관리자 확정 금액이 줄어든다 — 건수는 그대로', async () => {
    const orderNo = await paidOrder();
    expect((await aggregateProjectStatus(PROJECT, NOW)).raisedAmount).toBe(36000);
    tossOk(13000);
    await refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: '청약철회' });
    const status = await aggregateProjectStatus(PROJECT, NOW);
    expect(status.raisedAmount).toBe(36000 - 13000);
    expect(status.backerCount).toBe(1);
    const totals = await aggregateAdminFundingTotals('demo');
    expect(totals).toMatchObject({ confirmedAmount: 36000 - 13000, confirmedCount: 1 });
  });

  it('남은 수량보다 많이는 못 돌려준다', async () => {
    const orderNo = await paidOrder();
    const r = await refundFundingLine({ orderNo, rewardId: 'book', quantity: 3, reason: 'x' });
    expect(r).toMatchObject({ ok: false, code: 'invalid_quantity' });
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it('모든 줄을 돌려주면 주문이 전액 환불 상태가 된다', async () => {
    const orderNo = await paidOrder();
    tossOk(26000);
    await refundFundingLine({ orderNo, rewardId: 'book', quantity: 2, reason: 'x' });
    tossOk(36000);
    const r = await refundFundingLine({ orderNo, rewardId: 'mp3', quantity: 1, reason: 'x' });
    expect(r).toMatchObject({ ok: true, orderStatus: 'refunded' });
    const order = await findFundingOrderByOrderNo(orderNo);
    expect(order!.status).toBe('refunded');
    expect(remainingRefundable(order!)).toBe(0);
  });

  it('웹훅이 먼저 기록했어도 환불 행이 이중으로 남지 않는다', async () => {
    const orderNo = await paidOrder();
    // 웹훅 동기화가 먼저 13,000원을 적어 둔 상황.
    await client.execute("INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES ('w1', 'pay1', 13000, '토스 외부 취소 동기화', 'webhook', 'done')");
    tossOk(13000);
    const r = await refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: 'x' });
    expect(r.ok).toBe(true);
    const rows = await client.execute("SELECT SUM(amount) AS s FROM refunds WHERE status = 'done'");
    expect(Number(rows.rows[0].s)).toBe(13000);
  });

  it('토스가 거절하면 선점을 되돌리고 실패 기록을 남긴다', async () => {
    const orderNo = await paidOrder();
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'NOT_CANCELABLE_AMOUNT', message: '취소 불가' });
    const r = await refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: 'x' });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    const order = await findFundingOrderByOrderNo(orderNo);
    expect(pledgeLines(order!.fundingPledge!).find((l) => l.rewardId === 'book')!.refundedQuantity).toBe(0);
    expect(order!.status).toBe('paid');
    const failed = await client.execute("SELECT COUNT(*) AS n FROM refunds WHERE status = 'failed'");
    expect(Number(failed.rows[0].n)).toBe(1);
  });

  it('토스 응답을 못 받으면 선점을 되돌리지 않는다 — 취소가 됐을 수 있다', async () => {
    const orderNo = await paidOrder();
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'timeout' });
    const r = await refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: 'x' });
    expect(r).toMatchObject({ ok: false, code: 'toss_unknown' });
    const order = await findFundingOrderByOrderNo(orderNo);
    expect(pledgeLines(order!.fundingPledge!).find((l) => l.rewardId === 'book')!.refundedQuantity).toBe(1);
  });

  it('줄이 없는 옛 후원은 옛 칸을 줄로 옮겨 담은 뒤 돌려준다', async () => {
    const orderNo = await paidOrder();
    await client.execute('DELETE FROM funding_pledge_items');
    await client.execute("UPDATE funding_pledges SET reward_id = 'book', reward_title = '시집', unit_amount = 13000, quantity = 2");
    tossOk(13000);
    const r = await refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: 'x' });
    expect(r.ok).toBe(true);
    const order = await findFundingOrderByOrderNo(orderNo);
    expect(pledgeLines(order!.fundingPledge!)).toEqual([
      { rewardId: 'book', rewardTitle: '시집', unitAmount: 13000, quantity: 2, refundedQuantity: 1 },
    ]);
  });

  it('계좌(수기) 후원은 다루지 않는다', async () => {
    const orderNo = await paidOrder();
    await client.execute("UPDATE funding_pledges SET payment_method = 'bank_transfer'");
    const r = await refundFundingLine({ orderNo, rewardId: 'book', quantity: 1, reason: 'x' });
    expect(r).toMatchObject({ ok: false, code: 'offline_payment' });
  });
});
