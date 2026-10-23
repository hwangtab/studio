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
import { adjustPaidBankDepositAmount, allocateProportionally } from './paidAmount';
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
  for (const t of ['refunds', 'payments', 'show_tickets', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
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

  it('같은 금액으로 동시에 정정해도 감사 기록은 이긴 쪽 하나만 남는다', async () => {
    await seed();
    const [a, b] = await Promise.all([
      adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '첫 번째 사람', actor: 'admin-a' }),
      adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '두 번째 사람', actor: 'admin-b' }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const audit = JSON.parse(String((await one(`SELECT raw_response FROM payments WHERE id='p1'`))?.raw_response));
    expect(audit.amountAdjustments).toHaveLength(1);
    expect(audit.amountAdjustments[0].by).toBe(a.ok ? 'admin-a' : 'admin-b');
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

  it('믹싱 주문과 예약금 링크 주문도 정정된다 — 금액은 orders에만 있다', async () => {
    for (const type of ['mixing', 'deposit']) {
      await client.execute(`DELETE FROM payments`);
      await client.execute(`DELETE FROM orders`);
      await seed({ type });
      expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 450000, reason: '협의가 정정', actor: 'admin' })).toEqual({ ok: true, from: 300000, to: 450000 });
    }
  });

  it('입금 대기·다른 주문 종류·잘못된 금액·사유 없음·같은 금액은 거절한다', async () => {
    await seed({ status: 'awaiting_deposit', paymentKey: null });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    await client.execute(`DELETE FROM orders`);
    await seed({ type: 'ticket' });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    await client.execute(`DELETE FROM payments`);
    await client.execute(`DELETE FROM orders`);
    await seed();
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false }); // 오입력 가드(1~999원)
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: -1000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 500000, reason: '', actor: 'admin' })).toMatchObject({ ok: false });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 300000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    expect((await one(`SELECT total_amount FROM orders WHERE id='o1'`))?.total_amount).toBe(300000);
  });
});

describe('0원(완전 무료) 정정', () => {
  it('세션 주문을 0원으로 정정하고 다시 올릴 수도 있다', async () => {
    await seed();
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 0, reason: '전액 할인', actor: 'admin' })).toEqual({ ok: true, from: 300000, to: 0 });
    expect(await one(`SELECT item_amount, vat_amount, total_amount FROM orders WHERE id='o1'`)).toEqual({ item_amount: 0, vat_amount: 0, total_amount: 0 });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 100000, reason: '다시 올림', actor: 'admin' })).toMatchObject({ ok: true, to: 100000 });
  });

  it('티켓 주문을 0원으로 정정하면 장당 금액이 모두 0이 된다', async () => {
    await seed({ type: 'ticket' });
    for (const i of [0, 1]) {
      await client.executeMultiple(`PRAGMA foreign_keys = OFF; INSERT INTO show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, issued_by, unit_amount, compensated_amount) VALUES ('z${i}', 'SNB-T-1', 'st1', 'tt1', 'zc${i}', 'issued', 'customer', 25000, 0); PRAGMA foreign_keys = ON;`);
    }
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 0, reason: '전액 무료', actor: 'admin' })).toMatchObject({ ok: true, to: 0 });
    const rows = (await client.execute(`SELECT unit_amount FROM show_tickets WHERE order_no='SNB-T-1'`)).rows as unknown as { unit_amount: number }[];
    expect(rows.map((r) => Number(r.unit_amount))).toEqual([0, 0]);
  });
});

describe('allocateProportionally', () => {
  it('합이 총액과 정확히 같고 비례한다', () => {
    expect(allocateProportionally(100000, [25000, 25000, 25000, 25000, 25000])).toEqual([20000, 20000, 20000, 20000, 20000]);
    expect(allocateProportionally(50000, [30000, 20000])).toEqual([30000, 20000]);
    expect(allocateProportionally(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(allocateProportionally(1000, [0, 0])).toEqual([500, 500]);
    expect(allocateProportionally(7, [])).toEqual([]);
    const split = allocateProportionally(123457, [30000, 20000, 20000]);
    expect(split.reduce((a, b) => a + b, 0)).toBe(123457);
  });
});

describe('공연 티켓·상점 주문 정정', () => {
  const seedTickets = async (units: number[], tail: { status?: string; compensated?: number } = {}) => {
    await seed({ type: 'ticket' });
    for (const [i, u] of units.entries()) {
      // 공연·회차·티켓타입 행을 만들지 않고 장 행만 넣는다(외래 키 검사를 그 문장 동안만 끈다) — 이 시험이 보는 것은 금액 정정이다.
      await client.executeMultiple(`PRAGMA foreign_keys = OFF; INSERT INTO show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, issued_by, unit_amount, compensated_amount)
        VALUES ('t${i}', 'SNB-T-1', 'st1', 'tt1', 'code${i}', '${i === units.length - 1 && tail.status ? tail.status : 'issued'}', 'customer', ${u}, ${i === units.length - 1 ? tail.compensated ?? 0 : 0}); PRAGMA foreign_keys = ON;`);
    }
  };
  const units = async () => ((await client.execute(`SELECT unit_amount FROM show_tickets WHERE order_no='SNB-T-1' ORDER BY id`)).rows as unknown as { unit_amount: number }[]).map((r) => Number(r.unit_amount));

  it('티켓 주문은 장당 금액이 새 총액에 비례 배분되고 기록에 장별 변경이 남는다', async () => {
    await seedTickets([25000, 25000, 25000, 25000, 25000]);
    await client.execute(`UPDATE orders SET total_amount = 125000 WHERE id = 'o1'`);
    const r = await adjustPaidBankDepositAmount({ orderNo: 'SNB-T-1', totalAmount: 100000, reason: '지인 할인', actor: 'admin' });
    expect(r).toEqual({ ok: true, from: 125000, to: 100000 });
    expect(await units()).toEqual([20000, 20000, 20000, 20000, 20000]);
    const audit = JSON.parse(String((await one(`SELECT raw_response FROM payments WHERE id='p1'`))?.raw_response));
    expect(audit.amountAdjustments[0].tickets).toHaveLength(5);
  });

  it('티켓 종류별 단가가 달라도 비례를 지킨다', async () => {
    await seedTickets([30000, 20000]);
    await client.execute(`UPDATE orders SET total_amount = 50000 WHERE id = 'o1'`);
    await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 40000, reason: '일부 감면', actor: 'admin' });
    expect(await units()).toEqual([24000, 16000]);
  });

  it('환불 중·환불된 티켓이나 보상 기록이 있으면 거절하고 아무것도 바꾸지 않는다', async () => {
    await seedTickets([25000, 25000], { status: 'refunded' });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 40000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
    expect(await units()).toEqual([25000, 25000]);
    await client.execute(`DELETE FROM show_tickets`);
    await client.execute(`DELETE FROM payments`);
    await client.execute(`DELETE FROM orders`);
    await seedTickets([25000, 25000], { compensated: 1000 });
    expect(await adjustPaidBankDepositAmount({ orderId: 'o1', totalAmount: 40000, reason: '사유입니다', actor: 'admin' })).toMatchObject({ ok: false });
  });

  it('상점 주문은 orders 총액만 바뀐다', async () => {
    await seed({ type: 'merch' });
    expect(await adjustPaidBankDepositAmount({ orderNo: 'SNB-T-1', totalAmount: 270000, reason: '10% 할인', actor: 'admin' })).toEqual({ ok: true, from: 300000, to: 270000 });
    expect((await one(`SELECT total_amount FROM orders WHERE id='o1'`))?.total_amount).toBe(270000);
  });
});
