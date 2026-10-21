/** @jest-environment node */

/**
 * 분야 판정을 실제 SQLite(in-memory, 전체 마이그레이션)로 고정한다 — 세션 예약의 연습실/녹음, 결제 링크의 지정·제작 계약 우선,
 * 구독 종류, 수기 매출 지정. 그리고 분야 지정 표(0084)가 없는 DB에서도 매출 조회가 던지지 않고 기본 분야로 떨어지는지.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { lineOfRow } from './businessLine';
import { loadLineAssignments, loadPaymentLinkLines, saveLineAssignment } from './businessLineStore';
import { loadManualRevenueRows } from './manualRevenue';
import { loadRevenueRows } from './revenueReport';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const RANGE = { from: new Date('2026-09-30T15:00:00Z'), toExclusive: new Date('2026-10-31T15:00:00Z') };
let client: Client;

const migrate = async (c: Client, skip?: string) => {
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && (!skip || !f.startsWith(skip))).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await c.execute(s.trim());
    }
  }
};

const seed = async (c: Client) => {
  const order = (id: string, type: string, total: number) =>
    c.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
            VALUES (?, ?, ?, 'paid', 'x', '010', 'a@b.c', ?, ?, ?, ?)`,
      args: [id, `NO-${id}`, type, `t-${id}`, total - Math.round(total / 11), Math.round(total / 11), total],
    });
  const pay = (id: string) => c.execute({ sql: `INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, '카드', ?)`, args: [`p-${id}`, id, `pk-${id}`, EPOCH('2026-10-05T03:00:00Z')] });
  const booking = (orderId: string, serviceType: string) =>
    c.execute({
      sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status) VALUES (?, ?, 'p', ?, ?, ?, 2, 'confirmed')`,
      args: [`b-${orderId}`, orderId, serviceType, EPOCH('2026-10-06T03:00:00Z'), EPOCH('2026-10-06T05:00:00Z')],
    });
  for (const [id, type, total] of [['sp', 'session', 22000], ['sr', 'session', 110000], ['nb', 'session', 33000], ['d1', 'deposit', 300000], ['d2', 'deposit', 500000], ['d3', 'deposit', 200000], ['d4', 'deposit', 90000], ['sub', 'subscription', 396000], ['art', 'subscription', 10000], ['unk', 'subscription', 5000]] as const) {
    await order(id, type, total);
    await pay(id);
  }
  await booking('sp', 'practice-room');
  await booking('sr', 'recording');
  await c.executeMultiple(`PRAGMA foreign_keys = OFF;
    INSERT INTO payment_link_orders (order_no, slug, item_name) VALUES ('NO-d1', 'link-practice', '연습실 이용료'), ('NO-d2', 'link-production', '싱글 계약금'), ('NO-d3', 'link-plain', '녹음 3시간');
    INSERT INTO production_contract_payment_links (slug, contract_id, purpose, amount) VALUES ('link-production', 'pc1', 'deposit', 500000);
    INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key, manage_token, item_amount, vat_amount, total_amount, billing_day, status)
      VALUES ('s1','practice-room','x','-','a@b.c','sub_1','m1',360000,36000,396000,1,'active'), ('s2','artist-support','x','-','a@b.c','sub_2','m2',9091,909,10000,1,'active'),
        ('s3','mystery-kind','x','-','a@b.c','sub_3','m3',4545,455,5000,1,'active');
    INSERT INTO subscription_payments (id, subscription_id, order_id, cycle_ym, attempt, amount, status) VALUES ('sp1','s1','sub','2026-10',1,396000,'paid'), ('sp2','s2','art','2026-10',1,10000,'paid'), ('sp3','s3','unk','2026-10',1,5000,'paid');
    INSERT INTO manual_revenues (id, received_on, type, description, total_amount, vat_amount, method) VALUES ('m1', '2026-10-10', 'session', '현금 녹음', 50000, 0, '현금'), ('m2', '2026-10-11', 'other', '대관', 70000, 0, '현금');
    PRAGMA foreign_keys = ON;`);
};

const lineMap = (rows: Array<{ orderNo: string; type: string; line?: string }>) =>
  Object.fromEntries(rows.map((r) => [r.orderNo, lineOfRow(r as Parameters<typeof lineOfRow>[0])]));

describe('마이그레이션 0084 적용 후', () => {
  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    mockDb = drizzle(client, { schema });
    await migrate(client);
    await seed(client);
  });
  afterAll(() => client.close());

  it('분야 지정을 저장·덮어쓰고, 결제 링크·수기 매출 행에 반영한다', async () => {
    expect(await saveLineAssignment('payment_link', 'link-practice', 'practice', 'admin')).toBe(true);
    // 제작 계약 링크는 지정이 있어도 녹음·제작이다.
    expect(await saveLineAssignment('payment_link', 'link-production', 'practice', 'admin')).toBe(true);
    expect(await saveLineAssignment('manual_revenue', 'm2', 'platform', 'admin')).toBe(true);
    expect(await saveLineAssignment('manual_revenue', 'm2', 'practice', 'admin')).toBe(true); // 덮어쓰기
    expect((await loadLineAssignments('manual_revenue', ['m1', 'm2'])).get('m2')).toBe('practice');
    expect(await loadPaymentLinkLines(['link-production', 'link-practice', 'link-plain'])).toEqual(
      new Map([
        ['link-production', { line: 'recording', fixed: true, type: 'production' }],
        ['link-practice', { line: 'practice', fixed: false, by: 'admin', at: expect.any(Number) }],
      ]),
    );

    const rows = await loadRevenueRows(RANGE);
    expect(lineMap(rows)).toEqual({
      'NO-sp': 'practice', // 연습실 시간제 예약
      'NO-sr': 'recording',
      'NO-d1': 'practice', // 링크에 고른 분야
      'NO-d2': 'recording', // 제작 계약 링크는 항상 녹음·제작
      'NO-d3': 'recording', // 지정 없는 링크
      'NO-d4': 'recording', // 링크 기록이 없는 옛 주문
      'NO-sub': 'practice', // 연습실 월 이용료 구독
      'NO-art': 'platform', // 아티스트 구독
      'NO-nb': 'recording', // 예약 행이 없는 세션 주문 — 기본(녹음·제작)
      'NO-unk': 'other', // 모르는 구독 종류 — 기타
    });
    // 제작 계약 링크 결제는 유형도 계약 종류(음원 제작)로 옮긴다 — 유형별 표에서 '예약금'과 갈라지지 않게.
    const types = Object.fromEntries(rows.map((r) => [r.orderNo, r.type]));
    expect(types).toMatchObject({ 'NO-d1': 'deposit', 'NO-d2': 'production', 'NO-d3': 'deposit', 'NO-unk': 'subscription' });
    const manual = await loadManualRevenueRows(RANGE);
    expect(Object.fromEntries(manual.map((r) => [r.manualId, lineOfRow(r)]))).toEqual({ m1: 'recording', m2: 'practice' });
  });
});

describe('마이그레이션 0084 전(분야 지정 표 없음 · 지출 CHECK 옛 값)', () => {
  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    mockDb = drizzle(client, { schema });
    await migrate(client, '0084_');
    await seed(client);
  });
  afterAll(() => client.close());

  it('매출 조회는 던지지 않고 기본 분야로 떨어지며, 지정 저장은 false를 돌려준다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const rows = await loadRevenueRows(RANGE);
    expect(lineMap(rows)).toMatchObject({ 'NO-sp': 'practice', 'NO-d1': 'recording', 'NO-d2': 'recording', 'NO-sub': 'practice' });
    const manual = await loadManualRevenueRows(RANGE);
    expect(manual.map((r) => lineOfRow(r))).toEqual(['recording', 'other']);
    expect(await saveLineAssignment('payment_link', 'link-plain', 'platform', 'admin')).toBe(false);
  });

  it('새 지출 구분은 CHECK에 걸리고 isExpenseCheckViolation이 알아본다(API가 503으로 알린다)', async () => {
    const { createExpense, isExpenseCheckViolation } = await import('./expenses');
    const input = { spentOn: '2026-10-01', category: 'rent', scope: 'recording', description: 'x', amount: 1000, repeatMonthly: false, repeatUntil: null, memo: null };
    const error = await createExpense(input, 'admin').then(() => null, (e: unknown) => e);
    expect(isExpenseCheckViolation(error)).toBe(true);
    await expect(createExpense({ ...input, scope: 'studio' }, 'admin')).resolves.toEqual(expect.any(String));
  });
});
