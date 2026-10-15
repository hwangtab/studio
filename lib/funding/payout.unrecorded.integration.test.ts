/** @jest-environment node */
/**
 * "정산 기록 대기" — 모금이 끝났고 받은 돈이 있는데 정산을 아직 기록하지 않은 프로젝트.
 * 세지 않아야 할 것을 세면 영영 안 내려가는 카드가 되므로 조건마다 데이터로 켜 본다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { listUnrecordedFundingPayoutProjectIds } from './payout';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
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
  for (const t of ['funding_project_payouts', 'refunds', 'payments', 'funding_pledges', 'orders', 'funding_projects', 'funding_creators']) {
    await client.execute(`DELETE FROM ${t}`);
  }
  await client.execute("INSERT INTO funding_creators (id, email, name) VALUES ('c1', 'c@x.y', '개설자')");
});

const project = async (id: string, over: { review?: string; status?: string; endIso?: string } = {}) => {
  await client.execute({
    sql: `INSERT INTO funding_projects (id, slug, creator_id, title, summary, content, cover_url, goal_amount, start_at, end_at, review_status, status)
          VALUES (?, ?, 'c1', '제목', '요약', '본문', 'https://x/c.webp', 1000000, ?, ?, ?, ?)`,
    args: [id, `slug-${id}`, EPOCH('2026-08-01T00:00:00Z'), EPOCH(over.endIso ?? '2026-09-30T00:00:00Z'), over.review ?? 'approved', over.status ?? 'auto'],
  });
};

const pledge = async (projectId: string, orderId: string, amount: number, refunded = 0, orderStatus = 'paid') => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, 'funding', ?, '후원자', '010', 'a@b.c', ?, ?, 0, ?)`,
    args: [orderId, `NO-${orderId}`, orderStatus, `tok-${orderId}`, amount, amount],
  });
  await client.execute({
    sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, payment_method, hold_expires_at)
          VALUES (?, ?, ?, 'r', '리워드', ?, 1, 'card', ?)`,
    args: [`fp-${orderId}`, orderId, `slug-${projectId}`, amount, EPOCH('2026-09-01T00:00:00Z')],
  });
  if (refunded > 0) {
    await client.execute({ sql: "INSERT INTO payments (id, order_id, payment_key, method) VALUES (?, ?, ?, '카드')", args: [`pm-${orderId}`, orderId, `pk-${orderId}`] });
    await client.execute({
      sql: "INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES (?, ?, ?, '환불', 'customer', 'done')",
      args: [`rf-${orderId}`, `pm-${orderId}`, refunded],
    });
  }
};

const payoutRow = (projectId: string) =>
  client.execute({
    sql: `INSERT INTO funding_project_payouts (id, project_id, gross_amount, refund_amount, supply_amount, fee_amount, share_amount, withholding_amount, net_amount, backer_count, status)
          VALUES (?, ?, 100, 0, 90, 10, 90, 0, 90, 1, 'pending')`,
    args: [`po-${projectId}`, projectId],
  });

it('마감됐고 받은 돈이 있고 정산 행이 없는 승인 프로젝트만 센다', async () => {
  await project('due');
  await pledge('due', 'o1', 100_000);

  expect(await listUnrecordedFundingPayoutProjectIds(NOW)).toEqual(['due']);
});

it('아직 진행 중이거나 승인 전이거나 비공개(draft)인 프로젝트는 세지 않는다', async () => {
  await project('live', { endIso: '2026-12-31T00:00:00Z' });
  await pledge('live', 'o1', 100_000);
  await project('submitted', { review: 'submitted' });
  await pledge('submitted', 'o2', 100_000);
  await project('draft', { status: 'draft' });
  await pledge('draft', 'o3', 100_000);

  expect(await listUnrecordedFundingPayoutProjectIds(NOW)).toEqual([]);
});

it('운영자가 종료(status=closed)한 프로젝트는 마감일 전이어도 센다', async () => {
  await project('early', { status: 'closed', endIso: '2026-12-31T00:00:00Z' });
  await pledge('early', 'o1', 100_000);

  expect(await listUnrecordedFundingPayoutProjectIds(NOW)).toEqual(['early']);
});

it('정산이 이미 기록된 프로젝트는 세지 않는다', async () => {
  await project('done');
  await pledge('done', 'o1', 100_000);
  await payoutRow('done');

  expect(await listUnrecordedFundingPayoutProjectIds(NOW)).toEqual([]);
});

it('받은 돈이 없거나 전부 환불된 프로젝트는 세지 않는다 — 기록이 nothing_to_pay로 거부된다', async () => {
  await project('empty');
  await project('allrefunded');
  await pledge('allrefunded', 'o1', 100_000, 100_000, 'partially_refunded');
  await project('pendingonly');
  await pledge('pendingonly', 'o2', 100_000, 0, 'pending'); // 결제 전 주문은 받은 돈이 아니다

  expect(await listUnrecordedFundingPayoutProjectIds(NOW)).toEqual([]);
});

it('일부만 환불됐으면 센다 — 마감일 순으로', async () => {
  await project('b', { endIso: '2026-09-30T00:00:00Z' });
  await pledge('b', 'o1', 100_000, 30_000, 'partially_refunded');
  await project('a', { endIso: '2026-09-10T00:00:00Z' });
  await pledge('a', 'o2', 50_000);

  expect(await listUnrecordedFundingPayoutProjectIds(NOW)).toEqual(['a', 'b']);
});
