/** @jest-environment node */

/**
 * 분야별 매출 감사(2026-10-21)로 메운 구멍을 실제 SQLite(in-memory, 전체 마이그레이션)로 고정한다 —
 * 수기 매출 분야 변경(메모 기록)·중복 의심(저장 API 409·운영 점검)·링크 기록 없는 예약금·연습실 구독/입주 이중 집계·
 * 결제 링크 분야 변경 API(제작 계약 링크 거절)·장부 CSV의 분야 열.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextApiRequest, NextApiResponse } from 'next';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../contracts/admin-auth', () => ({ authenticateAdminApi: async () => ({ ok: true, actor: 'op1' }) }));

/* eslint-disable import/first */
import manualHandler from '../../pages/api/admin/revenue/manual';
import linkHandler from '../../pages/api/admin/payment-links';
import expenseHandler from '../../pages/api/admin/expenses';
import { loadLineAssignments } from './businessLineStore';
import { findManualRevenueDuplicates, listManualRevenueDuplicates } from './manualRevenueDuplicates';
import { setManualRevenueLine } from './manualRevenue';
import { collectRevenueIssues } from './revenueChecks';
import { listSalesLedgerRows, SALES_LEDGER_COLUMNS } from './salesLedger';
import { loadRevenueRows } from './revenueReport';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const NOW = new Date('2026-10-21T03:00:00Z');
let client: Client;

const call = (handler: (req: NextApiRequest, res: NextApiResponse) => unknown, method: string, body: unknown) =>
  new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      status(code: number) { this.statusCode = code; return this; },
      json(b: Record<string, unknown>) { resolve({ status: this.statusCode, body: b }); return this; },
    };
    Promise.resolve(handler({ method, body, headers: {}, socket: {}, query: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse));
  });

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
  const order = (id: string, type: string, total: number, status = 'paid') =>
    client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
            VALUES (?, ?, ?, ?, 'x', '010', 'a@b.c', ?, ?, ?, ?)`,
      args: [id, `NO-${id}`, type, status, `t-${id}`, total - Math.round(total / 11), Math.round(total / 11), total],
    });
  const pay = (id: string, iso: string) => client.execute({ sql: `INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, '계좌 입금', ?)`, args: [`p-${id}`, id, `pk-${id}`, EPOCH(iso)] });
  // 10/12 KST에 입금 확인된 녹음 예약 165,000원 — 10/10에 수기로 같은 돈을 적으면 중복 의심.
  await order('s1', 'session', 165000);
  await pay('s1', '2026-10-12T02:00:00Z');
  // 같은 금액이지만 7일 뒤 — 창(±3일) 밖.
  await order('s2', 'session', 88000);
  await pay('s2', '2026-10-18T02:00:00Z');
  // 링크 기록이 없는 예약금 주문(분야를 몰라 녹음·제작으로 센다).
  await order('d1', 'deposit', 300000);
  await pay('d1', '2026-10-05T02:00:00Z');
  // 링크 기록이 있는 예약금 주문 — 연습실로 고른 링크, 그리고 믹싱 계약 링크.
  await order('d2', 'deposit', 200000);
  await pay('d2', '2026-10-06T02:00:00Z');
  await order('d3', 'deposit', 550000);
  await pay('d3', '2026-10-07T02:00:00Z');
  // 연습실 시간제 예약.
  await order('pr', 'session', 22000);
  await pay('pr', '2026-10-08T02:00:00Z');
  await client.executeMultiple(`PRAGMA foreign_keys = OFF;
    INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status) VALUES ('b-pr', 'pr', 'p', 'practice-room', ${EPOCH('2026-10-09T03:00:00Z')}, ${EPOCH('2026-10-09T05:00:00Z')}, 2, 'confirmed');
    INSERT INTO payment_links (slug, item_name, total_amount) VALUES ('link-room', '연습실 이용료', 200000), ('link-mix', '믹싱 계약금', 550000);
    INSERT INTO payment_link_orders (order_no, slug, item_name) VALUES ('NO-d2', 'link-room', '연습실 이용료'), ('NO-d3', 'link-mix', '믹싱 계약금');
    INSERT INTO revenue_line_assignments (subject_kind, subject_id, business_line, created_by) VALUES ('payment_link', 'link-room', 'practice', 'op0');
    INSERT INTO production_contracts (id, kind, title, client_name, client_phone, client_email, terms_json, total_amount, clauses_json, template, template_hash, content)
      VALUES ('pc1', 'mixmaster', '믹싱 2곡', 'x', '010', 'a@b.c', '{}', 550000, '[]', 't', 'h', 'c');
    INSERT INTO production_contract_payment_links (slug, contract_id, purpose, amount) VALUES ('link-mix', 'pc1', 'deposit', 550000);
    INSERT INTO manual_revenues (id, received_on, type, description, total_amount, vat_amount, method) VALUES
      ('m-dup', '2026-10-10', 'session', '녹음 — 계좌', 165000, 15000, '계좌 입금'),
      ('m-a', '2026-10-15', 'other', '대관 A', 70000, 0, '현금'),
      ('m-b', '2026-10-15', 'other', '대관 B', 70000, 0, '현금'),
      ('m-ok', '2026-10-15', 'other', '대관 C', 50000, 0, '현금');
    INSERT INTO subscriptions (id, kind, contract_id, customer_name, customer_phone, customer_email, customer_key, manage_token, item_amount, vat_amount, total_amount, billing_day, status)
      VALUES ('sub1', 'practice-room', NULL, '김입주', '-', 'a@b.c', 'sub_1', 'mt1', 360000, 36000, 396000, 1, 'active');
    INSERT INTO room_tenancies (id, kind, room_number, tenant_name, status, monthly_amount, start_date, billing_day, next_due_on)
      VALUES ('t1', 'room', 'R05', '김입주', 'active', 360000, '2026-01-01', 1, '2026-11-01'), ('t2', 'room', 'R06', '다른사람', 'active', 360000, '2026-01-01', 1, '2026-11-01');
    PRAGMA foreign_keys = ON;`);
});
afterAll(() => client.close());

describe('수기 매출 중복 의심', () => {
  it('±3일 안 같은 금액의 사이트 주문과 같은 날 같은 금액의 수기 매출을 찾는다', async () => {
    expect(await findManualRevenueDuplicates({ receivedOn: '2026-10-10', totalAmount: 165000 })).toEqual({ orderNos: ['NO-s1'], manualIds: ['m-dup'] });
    expect(await findManualRevenueDuplicates({ receivedOn: '2026-10-10', totalAmount: 165000, excludeId: 'm-dup' })).toEqual({ orderNos: ['NO-s1'], manualIds: [] });
    // 창 밖(7일 뒤 결제)은 아니다.
    expect(await findManualRevenueDuplicates({ receivedOn: '2026-10-11', totalAmount: 88000 })).toEqual({ orderNos: [], manualIds: [] });
  });

  it('기간 목록은 주문 짝·수기 짝을 함께 싣는다', async () => {
    const found = await listManualRevenueDuplicates({ from: '2026-10-01', to: '2026-10-31' });
    expect(found.map((d) => [d.manualId, d.orderNos, d.manualRefs])).toEqual([
      ['m-dup', ['NO-s1'], []],
      ['m-a', [], ['MAN-M-B']],
      ['m-b', [], ['MAN-M-A']],
    ]);
  });

  it('저장 API는 중복 의심이면 409로 알리고, 확인하면 저장하며 메모에 [중복 아님]을 붙인다', async () => {
    const body = { receivedOn: '2026-10-11', type: 'session', description: '녹음 3시간', totalAmount: 165000, vatMode: 'included', method: '계좌 입금', memo: '' };
    const first = await call(manualHandler, 'POST', body);
    expect(first.status).toBe(409);
    expect(first.body).toMatchObject({ code: 'possible_duplicate', orderNos: ['NO-s1'] });
    expect(String(first.body.message)).toMatch(/NO-s1/);
    const second = await call(manualHandler, 'POST', { ...body, confirmDuplicate: true });
    expect(second.status).toBe(201);
    const saved = await mockDb.query.manualRevenues.findFirst({ where: (t, { eq }) => eq(t.id, second.body.id as string) });
    expect(saved?.memo).toBe('[중복 아님]');
    // 겹치는 게 없으면 바로 저장된다.
    expect((await call(manualHandler, 'POST', { ...body, totalAmount: 123000 })).status).toBe(201);
  });

  it('중복 아님 표시 뒤에는 운영 점검·목록이 더 묻지 않는다', async () => {
    expect((await call(manualHandler, 'PATCH', { id: 'm-a', action: 'ackDuplicate' })).status).toBe(200);
    const found = await listManualRevenueDuplicates({ from: '2026-10-01', to: '2026-10-31' });
    // m-a가 표시됐으니 m-a·m-b 짝은 둘 다 빠진다.
    expect(found.map((d) => d.manualId)).toEqual(['m-dup']);
  });
});

describe('운영 점검(collectRevenueIssues)', () => {
  it('중복 의심·링크 기록 없는 예약금·연습실 구독/입주 이중 집계를 medium으로 올린다', async () => {
    const issues = await collectRevenueIssues(NOW);
    expect(issues.map((i) => [i.severity, i.title, i.href])).toEqual([
      ['medium', '직접 받은 매출 중복 의심 1건', '/admin/revenue'],
      ['medium', '결제 링크 기록 없는 예약금 주문 1건', '/admin/revenue'],
      ['medium', '연습실 월세 이중 집계 의심 1건', '/admin/revenue?line=practice'],
    ]);
    expect(issues[0].detail).toMatch(/NO-s1/);
    expect(issues[1].detail).toMatch(/NO-d1/);
    expect(issues[2].detail).toMatch(/R05 김입주/);
  });
});

describe('분야 바꾸기', () => {
  it('수기 매출 분야를 바꾸면 지정이 덮이고 메모에 전후·사람·날짜가 남는다. 비우면 유형대로', async () => {
    expect(await setManualRevenueLine('m-ok', 'practice', 'op1')).toBe('ok');
    expect((await loadLineAssignments('manual_revenue', ['m-ok'])).get('m-ok')).toBe('practice');
    let row = await mockDb.query.manualRevenues.findFirst({ where: (t, { eq }) => eq(t.id, 'm-ok') });
    expect(row?.memo).toMatch(/^\[분야 변경 기타→연습실 · op1 · \d{4}-\d{2}-\d{2}\]$/);
    expect((await call(manualHandler, 'PATCH', { id: 'm-ok', businessLine: '' })).status).toBe(200);
    expect((await loadLineAssignments('manual_revenue', ['m-ok'])).has('m-ok')).toBe(false);
    row = await mockDb.query.manualRevenues.findFirst({ where: (t, { eq }) => eq(t.id, 'm-ok') });
    expect(row?.memo?.split('\n')[1]).toMatch(/^\[분야 변경 연습실→기타\(유형대로\) · op1/);
    expect((await call(manualHandler, 'PATCH', { id: 'm-ok', businessLine: 'studio' })).status).toBe(400);
    expect((await call(manualHandler, 'PATCH', { id: 'nope', businessLine: 'platform' })).status).toBe(404);
  });

  it('결제 링크 분야를 바꾸면 마지막으로 정한 사람이 바뀌고, 제작 계약 링크는 409로 거절한다', async () => {
    const ok = await call(linkHandler, 'PATCH', { slug: 'link-room', businessLine: 'platform' });
    expect(ok).toMatchObject({ status: 200, body: { ok: true, line: 'platform', before: 'practice' } });
    const [assigned] = await client.execute("SELECT business_line, created_by FROM revenue_line_assignments WHERE subject_id = 'link-room'").then((r) => r.rows);
    expect(assigned).toMatchObject({ business_line: 'platform', created_by: 'op1' });
    const fixed = await call(linkHandler, 'PATCH', { slug: 'link-mix', businessLine: 'practice' });
    expect(fixed.status).toBe(409);
    expect(String(fixed.body.message)).toMatch(/계약/);
    expect((await call(linkHandler, 'PATCH', { slug: 'no-such', businessLine: 'practice' })).status).toBe(404);
    await client.execute("UPDATE revenue_line_assignments SET business_line = 'practice' WHERE subject_id = 'link-room'");
  });

  it('지출 구분·항목을 고치면 메모에 변경 기록이 붙는다', async () => {
    await client.execute(`INSERT INTO studio_expenses (id, spent_on, category, scope, description, amount) VALUES ('e1', '2026-10-01', 'rent', 'practice', '임대료', 1000000)`);
    const r = await call(expenseHandler, 'PATCH', { id: 'e1', scope: 'studio', category: 'utilities' });
    expect(r.status).toBe(200);
    const [row] = (await client.execute("SELECT scope, category, memo FROM studio_expenses WHERE id = 'e1'")).rows;
    expect(row.scope).toBe('studio');
    expect(row.category).toBe('utilities');
    expect(String(row.memo)).toMatch(/^\[구분 연습실→공통 · 항목 임대료→공과금\(전기·수도·인터넷\) · op1 · /);
    expect((await call(expenseHandler, 'PATCH', { id: 'e1', scope: 'nope' })).status).toBe(400);
    // 반복 끝내기 갈래는 그대로다.
    expect((await call(expenseHandler, 'PATCH', { id: 'e1', repeatUntil: '2026-12-31' })).status).toBe(404);
  });
});

describe('제작 계약 링크 결제의 유형', () => {
  it('믹싱 계약 링크로 받은 예약금은 유형도 믹싱·마스터링이다(한 계약이 예약금과 갈라지지 않게)', async () => {
    const rows = await loadRevenueRows({ from: new Date('2026-09-30T15:00:00Z'), toExclusive: new Date('2026-10-31T15:00:00Z') });
    expect(Object.fromEntries(rows.filter((r) => r.orderNo.startsWith('NO-d')).map((r) => [r.orderNo, [r.type, r.line ?? null]]))).toEqual({
      'NO-d1': ['deposit', null],
      'NO-d2': ['deposit', 'practice'],
      'NO-d3': ['mixing', 'recording'],
    });
  });
});

describe('장부 CSV의 분야 열', () => {
  it('맨 끝에 붙고, 매출 현황과 같은 판정으로 채운다', async () => {
    expect(SALES_LEDGER_COLUMNS[SALES_LEDGER_COLUMNS.length - 1]).toBe('businessLine');
    expect(SALES_LEDGER_COLUMNS.slice(0, 2)).toEqual(['approvedAt', 'orderNo']);
    const rows = await listSalesLedgerRows({ from: '2026-10-01', to: '2026-10-31' });
    expect(Object.fromEntries(rows.map((r) => [r.orderNo, r.businessLine]))).toEqual({
      'NO-s1': '녹음·제작', // 예약 행 없는 세션
      'NO-s2': '녹음·제작',
      'NO-d1': '녹음·제작', // 링크 기록 없음
      'NO-d2': '연습실', // 링크에 고른 분야
      'NO-d3': '녹음·제작', // 믹싱 계약 링크
      'NO-pr': '연습실', // 연습실 시간제 예약
    });
  });
});
