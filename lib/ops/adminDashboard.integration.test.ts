/** @jest-environment node */

/**
 * 관리자 첫 화면의 건수·목록을 실제 SQLite(in-memory)로 고정한다.
 *
 * 이 화면의 값이 틀리면 운영자는 "할 일이 없다"고 믿는다 — 건강 점검과 같은 종류의 조용한
 * 고장이라, 조건마다 데이터로 한 번씩 켜 본다. 캘린더 점검은 외부 호출이라 모킹한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../booking/gcal', () => ({ fetchBusyRanges: jest.fn().mockResolvedValue([]) }));
// 이 파일은 마이그레이션 드리프트가 아니라 나머지 issues 건수를 검증한다. 목킹하지 않으면
// in-memory DB에 __drizzle_migrations 테이블이 없어 "0개 적용"으로 읽혀, 로컬 .env.local의
// TURSO 값 유무에 따라 이 파일의 exact-array assertion이 흔들린다.
jest.mock('./migrationDrift', () => ({
  checkMigrationDrift: jest.fn().mockResolvedValue({ status: 'unknown', localCount: 0, appliedCount: null, pendingCount: 0, pendingTags: [] }),
}));

// eslint-disable-next-line import/first
import { loadAdminDashboard } from './adminDashboard';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
// KST 2026-09-16 (수) 12:00
const NOW = new Date('2026-09-16T03:00:00Z');
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
  for (const t of ['refunds', 'payments', 'bookings', 'work_orders', 'funding_pledges', 'funding_projects', 'funding_creators', 'subscription_payments', 'subscriptions', 'orders', 'contracts', 'social_tokens']) {
    await client.execute(`DELETE FROM ${t}`);
  }
});

const insertOrder = async (id: string, type: string) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token,
            item_amount, vat_amount, total_amount) VALUES (?, ?, ?, 'paid', '홍길동', '010', 'a@b.c', ?, 100, 10, 110)`,
    args: [id, `NO-${id}`, type, `tok-${id}`],
  });
};

const insertBooking = async (id: string, startIso: string, status = 'confirmed') => {
  await insertOrder(id, 'session');
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status, gcal_event_id)
          VALUES (?, ?, 'recording-pro', 'recording', ?, ?, 3, ?, 'ev')`,
    args: [`b-${id}`, id, EPOCH(startIso), EPOCH(startIso) + 3 * 3600, status],
  });
};

const insertWorkOrder = async (id: string, status: string) => {
  await insertOrder(id, 'mixing');
  await client.execute({
    sql: `INSERT INTO work_orders (id, order_id, product_id, service_type, song_count, status) VALUES (?, ?, 'mixing-level1', 'mixing', 1, ?)`,
    args: [`w-${id}`, id, status],
  });
};

const insertSubscription = async (id: string, status: string) => {
  await client.execute({
    sql: `INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key,
            item_amount, vat_amount, total_amount, billing_day, status, manage_token)
          VALUES (?, 'lesson', '김수강', '010', 's@x.y', ?, 100, 10, 110, 5, ?, ?)`,
    args: [id, `ck-${id}`, status, `mt-${id}`],
  });
};

const insertContract = async (id: string, status: string, expiresIso: string) => {
  await client.execute({
    sql: `INSERT INTO contracts (id, title, customer_name, customer_email, customer_phone, room_number,
            start_date, end_date, monthly_rent, deposit_amount, payment_day, content, status, sign_token, expires_at)
          VALUES (?, '계약', '박연주', 'p@x.y', '010', 'A-1', 0, 0, 1, 0, 5, '본문', ?, ?, ?)`,
    args: [id, status, `st-${id}`, EPOCH(expiresIso)],
  });
};

const insertFundingProject = async (id: string, reviewStatus: string) => {
  await client.execute({
    sql: `INSERT INTO funding_creators (id, email, name) VALUES (?, ?, '아티스트')`,
    args: [`fc-${id}`, `${id}@x.y`],
  });
  await client.execute({
    sql: `INSERT INTO funding_projects (id, slug, creator_id, title, summary, content, cover_url,
            goal_amount, start_at, end_at, review_status)
          VALUES (?, ?, ?, '제목', '요약', '본문', 'https://x/cover.webp', 1000000, ?, ?, ?)`,
    args: [`fp-${id}`, `slug-${id}`, `fc-${id}`, EPOCH('2026-09-01T00:00:00Z'), EPOCH('2026-10-01T00:00:00Z'), reviewStatus],
  });
};

it('이번 주 세션은 KST 오늘 0시부터 7일 안의 확정 예약만, 시작 시각순으로 싣는다', async () => {
  await insertBooking('today-morning', '2026-09-16T01:00:00Z'); // KST 10:00 — 이미 지났지만 오늘이라 싣는다
  await insertBooking('tomorrow', '2026-09-17T05:00:00Z');
  await insertBooking('yesterday', '2026-09-15T05:00:00Z');
  await insertBooking('next-week', '2026-09-23T05:00:00Z'); // +7일째는 밖
  await insertBooking('cancelled', '2026-09-18T05:00:00Z', 'cancelled');

  const dash = await loadAdminDashboard(NOW);

  expect(dash.upcomingSessions.map((s) => s.orderNo)).toEqual(['NO-today-morning', 'NO-tomorrow']);
  expect(dash.upcomingSessions[0]).toMatchObject({ customerName: '홍길동', productName: '보컬 녹음 1프로' });
});

it('대기열 건수 — 믹싱 착수 대기·작업 중, 구독 카드 대기·재시도·정지, 서명 대기 계약', async () => {
  await insertWorkOrder('m1', 'received');
  await insertWorkOrder('m2', 'received');
  await insertWorkOrder('m3', 'in_progress');
  await insertWorkOrder('m4', 'delivered');
  await insertSubscription('s1', 'pending_card');
  await insertSubscription('s2', 'past_due');
  await insertSubscription('s3', 'paused');
  await insertSubscription('s4', 'active');
  await insertContract('c1', 'sent', '2026-09-20T00:00:00Z');
  await insertContract('c2', 'sent', '2026-09-10T00:00:00Z'); // 기한 지남 — 서명 대기가 아니라 점검 항목
  await insertContract('c3', 'signed', '2026-09-20T00:00:00Z');
  await insertFundingProject('f1', 'submitted');
  await insertFundingProject('f2', 'submitted');
  await insertFundingProject('f3', 'draft');
  await insertFundingProject('f4', 'approved');

  const dash = await loadAdminDashboard(NOW);

  expect(dash.queues).toEqual({
    mixingReceived: 2,
    mixingInProgress: 1,
    subscriptionsPendingCard: 1,
    subscriptionsPastDue: 1,
    subscriptionsPaused: 1,
    contractsAwaitingSignature: 1,
    artistPayoutsPending: 0,
    fundingProjectsAwaitingReview: 2,
    fundingPayoutsPending: 0,
  });
  expect(dash.issues.map((i) => i.title)).toContain('서명 기한이 지난 계약 1건');
});

it('점검 항목은 크론 메일과 같은 판정식이고 처리하러 갈 링크가 붙는다', async () => {
  await insertContract('c1', 'sent', '2026-09-10T00:00:00Z');

  const dash = await loadAdminDashboard(NOW);

  expect(dash.issues).toEqual([expect.objectContaining({ severity: 'medium', href: '/admin/contracts' })]);
});

it('소셜 토큰은 만료까지 남은 날수로 보인다', async () => {
  await client.execute({
    sql: `INSERT INTO social_tokens (platform, access_token, expires_at, updated_at) VALUES ('ig', 'x', ?, ?)`,
    args: [EPOCH('2026-09-26T03:00:00Z'), EPOCH('2026-09-01T00:00:00Z')],
  });

  const dash = await loadAdminDashboard(NOW);

  expect(dash.socialTokens).toEqual([{ platform: 'ig', expiresAt: '2026-09-26T03:00:00.000Z', daysLeft: 10 }]);
});

it('비어 있으면 전부 0·빈 목록이고 실패하지 않는다', async () => {
  const dash = await loadAdminDashboard(NOW);
  expect(dash.issues).toEqual([]);
  expect(dash.upcomingSessions).toEqual([]);
  expect(dash.socialTokens).toEqual([]);
  expect(Object.values(dash.queues).every((n) => n === 0)).toBe(true);
});
