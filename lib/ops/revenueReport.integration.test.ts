/** @jest-environment node */

/**
 * 매출 집계의 모집단을 실제 SQLite(in-memory)로 고정한다 — 결제 행이 없는 펀딩(계좌 입금·수기)이 빠지지 않고,
 * 토스 결제와 겹쳐 두 번 세어지지 않는지.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { loadRevenueRows, loadWindow, summarizeRevenue } from './revenueReport';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
let client: Client;

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
  for (const t of ['refunds', 'payments', 'funding_pledges', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

const insertOrder = async (id: string, type: string, status: string, total = 110000, vat = 10000) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token,
            item_amount, vat_amount, total_amount) VALUES (?, ?, ?, ?, '홍길동', '010', 'a@b.c', ?, ?, ?, ?)`,
    args: [id, `NO-${id}`, type, status, `tok-${id}`, total - vat, vat, total],
  });
};
const insertPayment = (id: string, orderId: string, iso: string, method = '카드') =>
  client.execute({
    sql: `INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, ?, ?)`,
    args: [id, orderId, `pk-${id}`, method, EPOCH(iso)],
  });
const insertPledge = (id: string, orderId: string, slug: string, paidIso: string, source = 'online', method = 'bank_transfer') =>
  client.execute({
    sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, payment_method, hold_expires_at, paid_at, entry_source)
          VALUES (?, ?, ?, 'r', '리워드', 30000, 1, ?, ?, ?, ?)`,
    args: [id, orderId, slug, method, EPOCH(paidIso), EPOCH(paidIso), source],
  });
const refund = (id: string, paymentId: string, amount: number, status = 'done') =>
  client.execute({
    sql: `INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES (?, ?, ?, 'r', 'admin', ?)`,
    args: [id, paymentId, amount, status],
  });

it('토스 결제와 결제 행 없는 펀딩을 함께 싣고, 같은 주문을 두 번 세지 않는다', async () => {
  await insertOrder('t', 'session', 'paid');
  await insertPayment('pt', 't', '2026-09-10T03:00:00Z');

  await insertOrder('f1', 'funding', 'paid', 30000, 0);
  await insertPayment('pf1', 'f1', '2026-09-11T03:00:00Z');
  await insertPledge('fp1', 'f1', 'rally', '2026-09-11T03:00:00Z', 'online', 'toss'); // 결제 행 있음 — 한 번만

  await insertOrder('f2', 'funding', 'paid', 30000, 0); // 계좌 입금
  await insertPledge('fp2', 'f2', 'rally', '2026-09-12T03:00:00Z');
  await insertOrder('f3', 'funding', 'paid', 30000, 0); // 수기 등록
  await insertPledge('fp3', 'f3', 'rally', '2026-09-13T03:00:00Z', 'manual');
  await insertOrder('f4', 'funding', 'refunded', 30000, 0); // 전액 환불된 계좌 입금
  await insertPledge('fp4', 'f4', 'rally', '2026-09-14T03:00:00Z');
  await insertOrder('f5', 'funding', 'pending', 30000, 0); // 입금 대기 — 매출 아님
  await insertPledge('fp5', 'f5', 'rally', '2026-09-15T03:00:00Z');

  const rows = await loadRevenueRows(loadWindow(2026));
  const s = summarizeRevenue(rows, { year: 2026, month: 9 });

  expect(rows.map((r) => r.orderNo).sort()).toEqual(['NO-f1', 'NO-f2', 'NO-f3', 'NO-f4', 'NO-t']);
  expect(s.totals).toMatchObject({ count: 5, gross: 110000 + 30000 * 4, refunded: 30000, fullyRefundedCount: 1 });
  expect(s.byProject[0]).toMatchObject({ key: 'rally', count: 4, net: 90000 });
  expect(s.byMethod.map((l) => l.key).sort()).toEqual(['계좌 입금', '수기 등록', '카드']);
});

it('환불은 done만 합산하고 기간 밖 환불도 같은 결제에 뺀다', async () => {
  await insertOrder('a', 'session', 'partially_refunded');
  await insertPayment('pa', 'a', '2026-09-10T03:00:00Z');
  await refund('r1', 'pa', 40000);
  await refund('r2', 'pa', 999999, 'failed');

  const [row] = await loadRevenueRows(loadWindow(2026));
  expect(row).toMatchObject({ gross: 110000, refunded: 40000 });
});

it('smoke-test 프로젝트와 0원 주문, 승인 전 결제는 뺀다', async () => {
  await insertOrder('s', 'funding', 'paid', 1000, 0);
  await insertPayment('ps', 's', '2026-09-10T03:00:00Z');
  await insertPledge('fps', 's', 'smoke-test', '2026-09-10T03:00:00Z', 'online', 'toss');
  await insertOrder('z', 'ticket', 'paid', 0, 0);
  await insertPayment('pz', 'z', '2026-09-10T03:00:00Z');
  await insertOrder('p', 'session', 'pending');
  await client.execute({ sql: `INSERT INTO payments (id, order_id, payment_key, method) VALUES ('pp', 'p', 'pk-pp', '카드')`, args: [] });

  expect(await loadRevenueRows(loadWindow(2026))).toEqual([]);
});

it('창은 전년 1월부터 해당 연도 말까지다', async () => {
  await insertOrder('old', 'session', 'paid');
  await insertPayment('po', 'old', '2024-12-31T14:59:00Z'); // KST 12/31 23:59 (전전년)
  await insertOrder('prev', 'session', 'paid');
  await insertPayment('pp1', 'prev', '2024-12-31T15:00:00Z'); // KST 2025-01-01 00:00
  await insertOrder('next', 'session', 'paid');
  await insertPayment('pn', 'next', '2026-12-31T15:00:00Z'); // KST 2027-01-01

  expect((await loadRevenueRows(loadWindow(2026))).map((r) => r.orderNo)).toEqual(['NO-prev']);
});

it('수기 매출은 받은 날(KST) 0시 기준으로 같은 모집단에 합산된다', async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createManualRevenue, setManualRefund, loadManualRevenueRows, deleteManualRevenue } = await import('./manualRevenue');
  await client.execute('DELETE FROM manual_revenues');
  const id = await createManualRevenue(
    { receivedOn: '2026-09-01', type: 'session', description: '녹음 3시간', totalAmount: 275000, vatMode: 'included', method: '계좌 입금', memo: null },
    'admin',
  );
  await createManualRevenue(
    { receivedOn: '2026-08-31', type: 'other', description: '8월 말', totalAmount: 10000, vatMode: 'exempt', method: '현금', memo: null },
    'admin',
  );

  expect(await setManualRefund(id, 300000)).toBe('invalid');
  expect(await setManualRefund('nope', 1)).toBe('not_found');
  expect(await setManualRefund(id, 75000, 'kyungha')).toBe('ok');
  const memo = String((await client.execute(`SELECT memo FROM manual_revenues WHERE id = '${id}'`)).rows[0].memo);
  expect(memo).toMatch(/\[환불 0→75,000원 · kyungha · \d{4}-\d{2}-\d{2}\]/);

  const rows = [...(await loadRevenueRows(loadWindow(2026))), ...(await loadManualRevenueRows(loadWindow(2026)))];
  const sept = summarizeRevenue(rows, { year: 2026, month: 9 });
  expect(sept.totals).toMatchObject({ count: 1, gross: 275000, refunded: 75000, net: 200000, netVat: 18182 });
  expect(sept.byMethod[0].key).toBe('계좌 입금');
  expect(summarizeRevenue(rows, { year: 2026, month: 8 }).totals.net).toBe(10000);

  // 소프트 삭제 — 매출에서는 빠지지만 행과 지운 사람·시각이 남고, 두 번째 삭제·환불 고치기는 없는 행으로 본다.
  expect(await deleteManualRevenue(id, 'kyungha')).toBe(true);
  expect(await deleteManualRevenue(id, 'someone-else')).toBe(false);
  expect(await setManualRefund(id, 0)).toBe('not_found');
  const kept = (await client.execute(`SELECT deleted_at, deleted_by FROM manual_revenues WHERE id = '${id}'`)).rows[0];
  expect(kept.deleted_by).toBe('kyungha');
  expect(Number(kept.deleted_at)).toBeGreaterThan(0);
  const after = await loadManualRevenueRows(loadWindow(2026));
  expect(after.map((r) => r.manualId)).not.toContain(id);
  expect(summarizeRevenue([...(await loadRevenueRows(loadWindow(2026))), ...after], { year: 2026, month: 9 }).totals.count).toBe(0);
});
