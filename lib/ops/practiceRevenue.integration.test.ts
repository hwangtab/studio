/** @jest-environment node */
/**
 * 연습실 월 입주 수입이 매출에 들어가고(tenancyRevenue.ts), 지출 항목이 저장·삭제·반복 끝내기·펼침되는지(expenses.ts)를 실 DB(in-memory libSQL)로 본다.
 * 판매·중개 수수료 몫(platformFee.ts)도 같은 DB로 — 펀딩·공연은 5.5%, 상점은 아티스트 상품 45%·스튜디오 상품 전액·배송비는 발송하는 쪽.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { loadTenancyRevenueRows } from './tenancyRevenue';
import { createExpense, deleteExpense, endExpenseRepeat, loadExpenseOccurrences, summarizeExpenses } from './expenses';
import { applyPlatformFees, loadMerchStudioFractions } from './platformFee';
import { summarizeRevenue, type RevenueRow } from './revenueReport';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const kst = (date: string) => new Date(new Date(`${date}T00:00:00Z`).getTime() - 9 * 3600 * 1000);

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

/** NOT NULL 칸을 기본값 없이 채워 한 행을 넣는다 — 이 시험이 보는 칸만 값을 주고 나머지는 더미로. */
const insert = async (table: string, values: Record<string, unknown>) => {
  const info = (await client.execute(`PRAGMA table_info(${table})`)).rows as unknown as { name: string; type: string; notnull: number; dflt_value: unknown }[];
  const row: Record<string, unknown> = { ...values };
  for (const c of info) {
    if (c.name in row || !c.notnull || c.dflt_value !== null) continue;
    row[c.name] = /INT/i.test(c.type) ? 0 : 'x';
  }
  const cols = Object.keys(row);
  await client.executeMultiple(`PRAGMA foreign_keys = OFF; ${''}`);
  await client.execute({ sql: `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, args: cols.map((c) => row[c] as never) });
};

describe('월 입주 수입 → 매출 행', () => {
  beforeEach(async () => {
    for (const t of ['room_tenancy_payments', 'room_tenancies']) await client.execute(`DELETE FROM ${t}`);
  });

  it('입금일(KST) 기준으로 기간 안의 수납만 읽고, 방 번호만 싣는다', async () => {
    await insert('room_tenancies', { id: 't1', kind: 'room', room_number: 'R05', tenant_name: '홍길동', monthly_amount: 360000, start_date: '2026-01-01', billing_day: 5, next_due_on: '2026-11-05' });
    await insert('room_tenancies', { id: 't2', kind: 'virtual', room_number: null, tenant_name: '주식회사', monthly_amount: 33000, start_date: '2026-01-01', billing_day: 5, next_due_on: '2026-11-05' });
    await insert('room_tenancy_payments', { id: 'p1', tenancy_id: 't1', paid_on: '2026-10-06', amount: 360000 });
    await insert('room_tenancy_payments', { id: 'p2', tenancy_id: 't2', paid_on: '2026-10-26', amount: 33000 });
    await insert('room_tenancy_payments', { id: 'p3', tenancy_id: 't1', paid_on: '2026-09-06', amount: 360000 });
    const rows = await loadTenancyRevenueRows({ from: kst('2026-10-01'), toExclusive: kst('2026-11-01') });
    expect(rows.map((r) => [r.orderNo, r.gross, r.type])).toEqual([['R05 월 입주', 360000, 'tenancy'], ['비상주 월 입주', 33000, 'tenancy']]);
    expect(JSON.stringify(rows)).not.toContain('홍길동');
    const s = summarizeRevenue(rows, { year: 2026, month: 10, type: 'tenancy' });
    expect(s.totals.net).toBe(393000);
  });
});

describe('지출 항목', () => {
  beforeEach(async () => {
    await client.execute('DELETE FROM studio_expenses');
  });

  it('반복 임대료와 건별 청소비를 연습실 지출로 합산하고, 지운 건·끝낸 반복은 빠진다', async () => {
    const rent = await createExpense({ spentOn: '2026-09-01', category: 'rent', scope: 'practice', description: '임대료', amount: 1_000_000, repeatMonthly: true, repeatUntil: null, memo: null }, 'admin');
    await createExpense({ spentOn: '2026-10-07', category: 'cleaning', scope: 'practice', description: '청소', amount: 60_000, repeatMonthly: false, repeatUntil: null, memo: null }, 'admin');
    const other = await createExpense({ spentOn: '2026-10-08', category: 'supplies', scope: 'studio', description: '소모품', amount: 20_000, repeatMonthly: false, repeatUntil: null, memo: null }, 'admin');
    const range = { from: kst('2026-10-01'), toExclusive: kst('2026-11-01') };

    expect(summarizeExpenses(await loadExpenseOccurrences(range), 'practice').total).toBe(1_060_000);
    expect(summarizeExpenses(await loadExpenseOccurrences(range), 'studio').total).toBe(20_000);

    expect(await deleteExpense(other, 'admin')).toBe(true);
    expect(await deleteExpense(other, 'admin')).toBe(false); // 이미 지운 건
    expect(summarizeExpenses(await loadExpenseOccurrences(range)).total).toBe(1_060_000);

    // 반복을 9월까지로 끝내면 10월 임대료는 빠진다.
    expect(await endExpenseRepeat(rent, '2026-09-30')).toBe(true);
    expect(summarizeExpenses(await loadExpenseOccurrences(range), 'practice').total).toBe(60_000);
  });
});

describe('판매·중개 수수료 몫', () => {
  const fundingRow = (over: Partial<RevenueRow> = {}): RevenueRow => ({ at: kst('2026-10-05'), orderNo: 'F1', type: 'funding', projectSlug: 'p', method: '카드', gross: 100000, vat: 9091, refunded: 0, offline: false, ...over });

  it('펀딩·공연은 5.5%만 매출, 직접 서비스는 그대로', async () => {
    const rows = await applyPlatformFees([
      fundingRow(),
      fundingRow({ orderNo: 'T1', type: 'ticket', gross: 50000, refunded: 20000 }),
      fundingRow({ orderNo: 'S1', type: 'session', gross: 110000 }),
    ]);
    expect(rows.map((r) => [r.orderNo, r.gross, r.refunded, r.sourceGross ?? null])).toEqual([['F1', 5500, 0, 100000], ['T1', 2750, 1100, 50000], ['S1', 110000, 0, null]]);
    expect(rows[0].vat).toBe(500);
  });

  it('상점은 아티스트 상품 45%·스튜디오 상품 전액, 배송비는 스튜디오 발송이면 스튜디오 몫', async () => {
    for (const t of ['shop_order_items', 'shop_orders', 'shop_product_fulfillment', 'shop_product_skus', 'shop_products', 'shop_artists', 'funding_creators']) await client.execute(`DELETE FROM ${t}`);
    await insert('funding_creators', { id: 'c-studio', name: '스튜디오 놀', email: 'studio@example.com' });
    await insert('funding_creators', { id: 'c-art', name: '아티스트', email: 'art@example.com' });
    await insert('shop_artists', { creator_id: 'c-studio', slug: 'studio-nol' });
    await insert('shop_artists', { creator_id: 'c-art', slug: 'art' });
    await insert('shop_products', { id: 'p-studio', slug: 'p-studio', creator_id: 'c-studio', kind: 'physical', category: 'goods' });
    await insert('shop_products', { id: 'p-art', slug: 'p-art', creator_id: 'c-art', kind: 'physical', category: 'goods' });
    await insert('shop_product_skus', { id: 'db-sku-studio', product_id: 'p-studio', price: 10000 });
    await insert('shop_product_skus', { id: 'db-sku-art', product_id: 'p-art', price: 10000 });
    await insert('shop_products', { id: 'p-art2', slug: 'p-art2', creator_id: 'c-art', kind: 'physical', category: 'goods' }); // 아티스트가 직접 발송하는 상품
    await insert('shop_product_skus', { id: 'db-sku-art2', product_id: 'p-art2', price: 10000 });
    // 주문 A: 스튜디오 상품 10,000 + 아티스트 상품 20,000 + 배송비 3,000(스튜디오 발송) → 스튜디오 몫 10,000 + 9,000 + 3,000 = 22,000 / 33,000
    await insert('shop_orders', { order_no: 'A', shipping_fee: 3000 });
    await insert('shop_order_items', { id: 'i1', order_no: 'A', sku_id: 'db-sku-studio', unit_price: 10000, quantity: 1 });
    await insert('shop_order_items', { id: 'i2', order_no: 'A', sku_id: 'db-sku-art', unit_price: 10000, quantity: 2 });
    // 주문 B: 아티스트 상품만, 아티스트가 직접 발송 → 배송비는 아티스트 몫: 스튜디오 몫 45% × 10,000 = 4,500 / 12,500
    await insert('shop_product_fulfillment', { product_id: 'p-art2', mode: 'artist' });
    await insert('shop_orders', { order_no: 'B', shipping_fee: 2500 });
    await insert('shop_order_items', { id: 'i3', order_no: 'B', sku_id: 'db-sku-art2', unit_price: 10000, quantity: 1 });

    const f = await loadMerchStudioFractions(['A', 'B']);
    expect(f.get('B')).toBeCloseTo(4500 / 12500, 6);
    expect(f.get('A')).toBeCloseTo(22000 / 33000, 6);
  });
});
