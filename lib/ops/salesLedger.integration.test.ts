/** @jest-environment node */

/**
 * 토스 결제 장부의 모집단·설명·환불 합산을 실제 SQLite(in-memory)로 고정한다.
 * 이 표는 세무 자료라, 빠진 행(기간 경계)과 잘못 더한 환불이 곧 신고 오류다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { listSalesLedgerRows, validateLedgerRange } from './salesLedger';

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
  for (const t of ['refunds', 'payments', 'bookings', 'work_orders', 'funding_pledges', 'subscription_payments', 'subscriptions', 'orders']) {
    await client.execute(`DELETE FROM ${t}`);
  }
});

const insertOrder = async (id: string, type: string, status = 'paid') => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token,
            item_amount, vat_amount, total_amount) VALUES (?, ?, ?, ?, '홍길동', '010', 'a@b.c', ?, 250000, 25000, 275000)`,
    args: [id, `NO-${id}`, type, status, `tok-${id}`],
  });
};
const insertPayment = async (id: string, orderId: string, approvedIso: string | null) => {
  await client.execute({
    sql: `INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, '카드', ?)`,
    args: [id, orderId, `pk-${id}`, approvedIso ? EPOCH(approvedIso) : null],
  });
};
const insertRefund = async (id: string, paymentId: string, amount: number, status: string, createdIso: string) => {
  await client.execute({
    sql: `INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status, created_at) VALUES (?, ?, ?, 'r', 'admin', ?, ?)`,
    args: [id, paymentId, amount, status, EPOCH(createdIso)],
  });
};

it('기간은 KST 달력으로 자르고 승인 시각순으로 싣는다', async () => {
  await insertOrder('a', 'session');
  await insertPayment('pa', 'a', '2026-08-31T14:59:00Z'); // KST 8/31 23:59 — 밖
  await insertOrder('b', 'session');
  await insertPayment('pb', 'b', '2026-08-31T15:00:00Z'); // KST 9/1 00:00 — 안
  await insertOrder('c', 'session');
  await insertPayment('pc', 'c', '2026-09-30T14:59:59Z'); // KST 9/30 23:59 — 안
  await insertOrder('d', 'session');
  await insertPayment('pd', 'd', '2026-09-30T15:00:00Z'); // KST 10/1 — 밖
  await insertOrder('e', 'session', 'pending');
  await insertPayment('pe', 'e', null); // 승인 기록 없음 — 밖

  const rows = await listSalesLedgerRows({ from: '2026-09-01', to: '2026-09-30' });

  expect(rows.map((r) => r.orderNo)).toEqual(['NO-b', 'NO-c']);
  expect(rows[0].approvedAt).toBe('2026.09.01 (화) 00:00');
});

it('환불은 done만, 기간 밖 환불도 같은 행에 합산하고 순액을 낸다', async () => {
  await insertOrder('a', 'session', 'partially_refunded');
  await insertPayment('pa', 'a', '2026-09-10T03:00:00Z');
  await insertRefund('r1', 'pa', 100000, 'done', '2026-09-12T03:00:00Z');
  await insertRefund('r2', 'pa', 50000, 'done', '2026-10-05T03:00:00Z'); // 다음 달 환불
  await insertRefund('r3', 'pa', 999999, 'failed', '2026-09-13T03:00:00Z');

  const [row] = await listSalesLedgerRows({ from: '2026-09-01', to: '2026-09-30' });

  expect(row).toMatchObject({
    totalAmount: 275000, refundedAmount: 150000, netAmount: 125000, orderStatus: 'partially_refunded',
    // 순액 125,000을 공급가·부가세 10:1로 다시 나눈다 — 부가세 열만 합산해도 환불분이 빠져 있어야 한다.
    netItemAmount: 113636, netVatAmount: 11364,
  });
  expect(row.lastRefundAt).toBe('2026.10.05 (월) 12:00');
});

it('전액 환불된 결제는 순 공급가·순 부가세가 0이다', async () => {
  await insertOrder('a', 'session', 'refunded');
  await insertPayment('pa', 'a', '2026-09-10T03:00:00Z');
  await insertRefund('r1', 'pa', 275000, 'done', '2026-09-12T03:00:00Z');

  const [row] = await listSalesLedgerRows({ from: '2026-09-01', to: '2026-09-30' });

  expect(row).toMatchObject({ itemAmount: 250000, vatAmount: 25000, netAmount: 0, netItemAmount: 0, netVatAmount: 0 });
});

it('설명은 서비스별 상품·일시·곡수·리워드·회차로 만든다', async () => {
  await insertOrder('s', 'session');
  await insertPayment('ps', 's', '2026-09-01T03:00:00Z');
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status)
          VALUES ('b1', 's', 'recording-pro', 'recording', ?, ?, 3, 'confirmed')`,
    args: [EPOCH('2026-09-20T05:00:00Z'), EPOCH('2026-09-20T08:00:00Z')],
  });

  await insertOrder('m', 'mixing');
  await insertPayment('pm', 'm', '2026-09-02T03:00:00Z');
  await client.execute(`INSERT INTO work_orders (id, order_id, product_id, service_type, song_count, vocal_tuning, status)
    VALUES ('w1', 'm', 'mixing-level1', 'mixing', 2, 1, 'received')`);

  await insertOrder('f', 'funding');
  await insertPayment('pf', 'f', '2026-09-03T03:00:00Z');
  await client.execute({
    sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, payment_method, hold_expires_at)
          VALUES ('fp1', 'f', 'rally-2026', 'r1', '음원 + 티셔츠', 30000, 2, 'toss', ?)`,
    args: [EPOCH('2026-09-03T04:00:00Z')],
  });

  await client.execute(`INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key,
      item_amount, vat_amount, total_amount, billing_day, status, manage_token)
    VALUES ('sub1', 'practice-room', '박연주', '010', 'p@x.y', 'ck', 360000, 36000, 396000, 5, 'active', 'mt')`);
  await insertOrder('u', 'subscription');
  await insertPayment('pu', 'u', '2026-09-05T03:00:00Z');
  await client.execute(`INSERT INTO subscription_payments (id, subscription_id, order_id, cycle_ym, attempt, amount, status)
    VALUES ('sp1', 'sub1', 'u', '2026-09', 1, 396000, 'paid')`);

  const rows = await listSalesLedgerRows({ from: '2026-09-01', to: '2026-09-30' });

  expect(rows.map((r) => [r.type, r.description])).toEqual([
    ['세션 예약', '보컬 녹음 1프로 · 2026.09.20 (일) 14:00'],
    ['믹싱·마스터링', '믹싱 · 10트랙 이하 2곡 + 보컬 튜닝'],
    ['펀딩', 'rally-2026 · 음원 + 티셔츠 × 2'],
    ['구독', '연습실 월 이용료 2026-09'],
  ]);
});

describe('validateLedgerRange', () => {
  it.each([
    [{ from: '2026-9-1', to: '2026-09-30' }, /형식/],
    [{ from: '2026-09-30', to: '2026-09-01' }, /앞설 수 없습니다/],
    [{ from: '2025-01-01', to: '2026-01-02' }, /366일/],
  ])('%p → 거절', (range, pattern) => {
    expect(validateLedgerRange(range)).toMatch(pattern);
  });
  it('한 달·1년 범위는 통과한다', () => {
    expect(validateLedgerRange({ from: '2026-09-01', to: '2026-09-30' })).toBeNull();
    expect(validateLedgerRange({ from: '2026-01-01', to: '2026-12-31' })).toBeNull();
  });
});
