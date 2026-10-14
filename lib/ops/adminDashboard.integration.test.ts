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
jest.mock('../booking/gcal', () => ({ ...jest.requireActual('../booking/gcal'), fetchBusyRanges: jest.fn().mockResolvedValue([]) }));
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
  for (const t of ['show_submissions', 'refunds', 'payments', 'bookings', 'work_orders', 'funding_pledges', 'funding_projects', 'funding_creators', 'subscription_payments', 'subscriptions', 'orders', 'contracts', 'social_tokens']) {
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
    depositsBooking: 0,
    depositsShow: 0,
    depositsFunding: 0,
    fundingRefundRequests: 0,
    showSubmissionsAwaitingReview: 0,
  });
  expect(dash.issues.map((i) => i.title)).toContain('서명 기한이 지난 계약 1건');
});

describe('서명 기한이 지난 계약 알림', () => {
  const titles = async () => (await loadAdminDashboard(NOW)).issues.map((i) => i.title);

  // 운영자가 알림을 보고 목록을 열면 sent가 expired로 내려간다 — sent만 세던 때는 재발송·취소 전에 알림이 사라졌다.
  it('목록이 sent를 expired로 내린 뒤에도 알림이 남는다', async () => {
    await insertContract('c1', 'expired', '2026-09-10T00:00:00Z');
    expect(await titles()).toContain('서명 기한이 지난 계약 1건');
  });

  it('만료 후 30일이 지나면 세지 않는다 — 취소·삭제하지 않은 계약이 영구히 알림에 남지 않게', async () => {
    await insertContract('old', 'expired', '2026-08-10T00:00:00Z'); // 37일 전
    await insertContract('edge', 'expired', '2026-08-20T00:00:00Z'); // 27일 전
    expect(await titles()).toContain('서명 기한이 지난 계약 1건');
  });

  it('처리하면(재발송·취소) 알림이 내려가고, 파기된 계약은 세지 않는다', async () => {
    await insertContract('resent', 'sent', '2026-09-20T00:00:00Z'); // 재발송 — 새 기한
    await insertContract('cancelled', 'cancelled', '2026-09-10T00:00:00Z');
    await insertContract('purged', 'expired', '2026-09-10T00:00:00Z');
    await client.execute("UPDATE contracts SET purged_at = unixepoch() WHERE id = 'purged'");
    expect((await titles()).filter((t) => t.startsWith('서명 기한이 지난 계약'))).toEqual([]);
  });
});

it('대기열 건수 — 계좌 입금 확인 대기(예약·믹싱·공연·펀딩)·펀딩 환불 요청·주최자 공연 심사', async () => {
  const insertOrderWith = async (id: string, type: string, status: string) => {
    await client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token,
              item_amount, vat_amount, total_amount) VALUES (?, ?, ?, ?, '홍길동', '010', 'a@b.c', ?, 100, 10, 110)`,
      args: [id, `NO-${id}`, type, status, `tok-${id}`],
    });
  };
  const insertPledge = async (id: string, orderStatus: string, method: string, source: string, refundRequested = false) => {
    await insertOrderWith(id, 'funding', orderStatus);
    await client.execute({
      sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity,
              payment_method, hold_expires_at, entry_source, refund_requested_at) VALUES (?, ?, 'p', 'r', '리워드', 100, 1, ?, ?, ?, ?)`,
      args: [`fp-${id}`, id, method, EPOCH('2026-09-20T00:00:00Z'), source, refundRequested ? EPOCH('2026-09-15T00:00:00Z') : null],
    });
  };
  await insertOrderWith('d1', 'session', 'awaiting_deposit');
  await insertOrderWith('d2', 'mixing', 'awaiting_deposit');
  await insertOrderWith('d3', 'deposit', 'awaiting_deposit');
  await insertOrderWith('d4', 'session', 'deposit_cancelled'); // 닫힌 건은 안 센다
  await insertOrderWith('t1', 'ticket', 'awaiting_deposit');
  await insertPledge('f1', 'pending', 'bank_transfer', 'online');
  await insertPledge('f2', 'pending', 'bank_transfer', 'manual'); // 수기 등록은 대기가 아니다
  await insertPledge('f3', 'pending', 'card', 'online'); // 토스 홀드
  await insertPledge('f4', 'paid', 'bank_transfer', 'online', true);
  await insertPledge('f5', 'refunded', 'bank_transfer', 'online', true); // 환불 끝 — 시각이 남아도 안 센다
  await client.execute({ sql: `INSERT INTO funding_creators (id, email, name) VALUES ('c1', 'c@x.y', '주최자')`, args: [] });
  for (const [id, status] of [['s1', 'submitted'], ['s2', 'draft'], ['s3', 'approved']]) {
    await client.execute({ sql: `INSERT INTO show_submissions (id, creator_id, draft_json, review_status) VALUES (?, 'c1', '{}', ?)`, args: [id, status] });
  }

  const dash = await loadAdminDashboard(NOW);

  expect(dash.queues).toMatchObject({
    depositsBooking: 3,
    depositsShow: 1,
    depositsFunding: 1,
    fundingRefundRequests: 1,
    showSubmissionsAwaitingReview: 1,
  });
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
