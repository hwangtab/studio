/** @jest-environment node */
/**
 * 입금 확인이 끝난 세션 예약의 금액 정정(lib/booking/paidAmount.ts)을 실 DB(in-memory libSQL)로 본다.
 * 지키는 것: ① 계좌 입금 확정 건만 고친다 ② 매출·환불 잔액의 정본인 orders 합계가 공급가·VAT와 함께 바뀐다
 * ③ 누가·언제·얼마→얼마·왜가 결제 행에 쌓인다 ④ 카드(토스)·환불 기록 있는 주문·입금 대기는 거절한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { adjustPaidBankDepositAmount } from './paidAmount';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const one = async (q: string) => (await client.execute(q)).rows[0] as Record<string, unknown> | undefined;

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
  for (const t of ['refunds', 'payments', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

const seed = async (opts: { status?: string; paymentKey?: string | null; type?: string } = {}) => {
  const status = opts.status ?? 'paid';
  await client.execute(`INSERT INTO orders (id, order_no, manage_token, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, status)
    VALUES ('o1', 'SNB-T-1', 'tok-1', '${opts.type ?? 'session'}', '고객', '-', 'a@b.c', 272727, 27273, 300000, '${status}')`);
  if (opts.paymentKey !== null) {
    await client.execute(`INSERT INTO payments (id, order_id, payment_key, method) VALUES ('p1', 'o1', '${opts.paymentKey ?? 'bank-deposit:SNB-T-1'}', '계좌 입금')`);
  }
};

describe('adjustPaidBankDepositAmount', () => {
  it('확정된 계좌 입금 세션의 금액을 정정하고 공급가·VAT와 결제 행 기록을 남긴다', async () => {
    await seed();
    const r = await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '협의 금액을 잘못 넣음', actor: 'admin', now: new Date('2026-10-20T00:00:00Z') });
    expect(r).toEqual({ ok: true, from: 300000, to: 500000 });
    expect(await one(`SELECT item_amount, vat_amount, total_amount FROM orders WHERE id='o1'`)).toEqual({ item_amount: 454545, vat_amount: 45455, total_amount: 500000 });
    const audit = JSON.parse(String((await one(`SELECT raw_response FROM payments WHERE id='p1'`))?.raw_response));
    expect(audit.amountAdjustments).toEqual([{ at: '2026-10-20T00:00:00.000Z', by: 'admin', from: 300000, to: 500000, reason: '협의 금액을 잘못 넣음' }]);
  });

  it('두 번째 정정은 기록 뒤에 쌓인다', async () => {
    await seed();
    await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '첫 번째', actor: 'admin' });
    await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 450000, reason: '두 번째', actor: 'admin' });
    const audit = JSON.parse(String((await one(`SELECT raw_response FROM payments WHERE id='p1'`))?.raw_response));
    expect(audit.amountAdjustments.map((a: { to: number }) => a.to)).toEqual([500000, 450000]);
  });

  it('카드(토스) 결제는 거절한다 — 승인 금액과 어긋난다', async () => {
    await seed({ paymentKey: 'tgen_abc123' });
    const r = await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '사유입니다', actor: 'admin' });
    expect(r.ok).toBe(false);
    expect((await one(`SELECT total_amount FROM orders WHERE id='o1'`))?.total_amount).toBe(300000);
  });

  it('환불 기록이 있으면 거절한다', async () => {
    await seed();
    await client.execute(`INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES ('r1', 'p1', 1000, '부분', 'admin', 'done')`);
    const r = await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '사유입니다', actor: 'admin' });
    expect(r).toMatchObject({ ok: false });
    expect((await one(`SELECT total_amount FROM orders WHERE id='o1'`))?.total_amount).toBe(300000);
  });

  it('입금 대기·믹싱·잘못된 금액·사유 없음·같은 금액은 거절한다', async () => {
    await seed({ status: 'awaiting_deposit', paymentKey: null });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    await client.execute(`DELETE FROM orders`);
    await seed({ type: 'mixing' });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    await client.execute(`DELETE FROM payments`);
    await client.execute(`DELETE FROM orders`);
    await seed();
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 0, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '', actor: 'admin' })).toMatchObject({ ok: false });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 300000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    expect((await one(`SELECT total_amount FROM orders WHERE id='o1'`))?.total_amount).toBe(300000);
  });
});
