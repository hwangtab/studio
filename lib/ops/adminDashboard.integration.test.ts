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

const ENV_KEYS = ['NEXT_PUBLIC_TOSS_API_CLIENT_KEY', 'TOSS_API_SECRET_KEY', 'FUNDING_FIELD_KEY'] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeAll(async () => {
  // 환경 점검(토스 키 쌍·필드 암호화 키)은 화면에도 올라온다 — 정상 환경을 깔고 시작한다.
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY = 'live_ck_test';
  process.env.TOSS_API_SECRET_KEY = 'live_sk_test';
  process.env.FUNDING_FIELD_KEY = Buffer.alloc(32, 7).toString('base64');
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  client.close();
});
beforeEach(async () => {
  for (const t of ['partner_payout_adjustments', 'partner_payouts', 'refunds', 'payments', 'bookings', 'work_orders', 'funding_pledges', 'funding_project_payouts', 'funding_projects', 'funding_creators', 'subscription_payments', 'subscriptions', 'orders', 'payment_link_orders', 'contracts', 'social_tokens']) {
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
    fundingPayoutsToRecord: 0,
    shopPayoutsToRecord: 0,
    shopPayoutsPending: 0,
    showPayoutsToRecord: 0,
    showPayoutsPending: 0,
    awaitingDeposit: { bookings: 0, shows: 0, shop: 0, funding: 0 },
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
  expect(Object.values(dash.queues).every((n) => (typeof n === 'number' ? n === 0 : Object.values(n).every((m) => m === 0)))).toBe(true);
});

const insertPledge = async (orderId: string, slug: string, orderStatus: string, method = 'toss', source = 'online') => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token,
            item_amount, vat_amount, total_amount, created_at) VALUES (?, ?, 'funding', ?, '후원', '010', 'a@b.c', ?, 30000, 0, 30000, ?)`,
    args: [orderId, `NO-${orderId}`, orderStatus, `tok-${orderId}`, EPOCH('2026-09-01T00:00:00Z')],
  });
  await client.execute({
    sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, payment_method, hold_expires_at, entry_source)
          VALUES (?, ?, ?, 'r', '리워드', 30000, 1, ?, ?, ?)`,
    args: [`fp-${orderId}`, orderId, slug, method, EPOCH('2026-09-02T00:00:00Z'), source],
  });
};

describe('환경 점검 — 점검 메일에만 있던 것', () => {
  it('토스 키나 필드 암호화 키가 빠지면 화면의 점검 항목에 high로 올라온다', async () => {
    delete process.env.TOSS_API_SECRET_KEY;
    delete process.env.FUNDING_FIELD_KEY;
    try {
      const dash = await loadAdminDashboard(NOW);
      expect(dash.issues.map((i) => [i.severity, i.title.slice(0, 8)])).toEqual(
        expect.arrayContaining([['high', '토스 API 키'], ['high', '필드 암호화 키']]),
      );
    } finally {
      process.env.TOSS_API_SECRET_KEY = 'live_sk_test';
      process.env.FUNDING_FIELD_KEY = Buffer.alloc(32, 7).toString('base64');
    }
  });
});

describe('마감 뒤 정산 기록 대기 — 어느 대기열에도 없던 빈칸', () => {
  const endProject = (id: string) => client.execute({ sql: `UPDATE funding_projects SET end_at = ? WHERE id = ?`, args: [EPOCH('2026-09-10T00:00:00Z'), `fp-${id}`] });

  it('승인됐고 마감됐고 살아 있는 후원이 있으며 정산 행이 없는 프로젝트만 센다', async () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) await insertFundingProject(id, 'approved');
    for (const id of ['a', 'b', 'c', 'e']) await endProject(id); // d는 아직 모금 중
    await insertPledge('oa', 'slug-a', 'paid'); // 센다
    await insertPledge('ob', 'slug-b', 'refunded'); // 살아 있는 후원 없음
    await insertPledge('oc', 'slug-c', 'paid');
    await client.execute({
      sql: `INSERT INTO funding_project_payouts (id, project_id, gross_amount, refund_amount, supply_amount, fee_amount, platform_fee_amount, payment_fee_amount,
              share_amount, withholding_amount, design_fee_offset_amount, production_fee_offset_amount, shortfall_amount, net_amount, backer_count, status)
            VALUES ('po', 'fp-c', 30000, 0, 27000, 3000, 2000, 1000, 27000, 0, 0, 0, 0, 27000, 1, 'pending')`,
      args: [],
    }); // 이미 기록됨
    await insertPledge('od', 'slug-d', 'paid');
    // e: 후원 자체가 없다

    const dash = await loadAdminDashboard(NOW);

    expect(dash.queues.fundingPayoutsToRecord).toBe(1);
    expect(dash.queues.fundingPayoutsPending).toBe(1);
  });

  it('마감 후 영업일 14일을 넘기면 점검 항목(high)으로도 올라온다', async () => {
    await insertFundingProject('late', 'approved');
    await client.execute({ sql: `UPDATE funding_projects SET end_at = ? WHERE id = 'fp-late'`, args: [EPOCH('2026-08-20T00:00:00Z')] });
    await insertPledge('ol', 'slug-late', 'paid');
    await insertFundingProject('fresh', 'approved');
    await endProject('fresh'); // 9/10 마감 — 9/16 현재 영업일 14일 안
    await insertPledge('of', 'slug-fresh', 'paid');

    const dash = await loadAdminDashboard(NOW);

    const issue = dash.issues.find((i) => i.title.includes('정산 안내 기한'));
    expect(issue).toMatchObject({ severity: 'high', href: '/admin/funding/projects' });
    expect(issue?.detail).toContain('slug-late');
    expect(issue?.detail).not.toContain('slug-fresh');
    expect(dash.queues.fundingPayoutsToRecord).toBe(2);
  });
});

describe('계좌 입금 대기 — 자동 취소가 없는 주문', () => {
  const insertWaiting = (id: string, type: string, createdIso: string) =>
    client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token,
              item_amount, vat_amount, total_amount, created_at) VALUES (?, ?, ?, 'awaiting_deposit', '입금', '010', 'a@b.c', ?, 100, 10, 110, ?)`,
      args: [id, `NO-${id}`, type, `tok-${id}`, EPOCH(createdIso)],
    });

  it('종류별로 세고, 안내 기한(3일)을 넘긴 것만 점검 항목으로 올린다', async () => {
    await insertWaiting('w1', 'session', '2026-09-15T00:00:00Z'); // 어제 — 기한 안
    await insertWaiting('w2', 'mixing', '2026-09-01T00:00:00Z'); // 기한 지남
    await insertWaiting('w3', 'ticket', '2026-09-01T00:00:00Z'); // 기한 지남
    await insertWaiting('w4', 'merch', '2026-09-15T00:00:00Z');
    await insertPledge('wf', 'slug-x', 'pending', 'bank_transfer', 'online');
    await insertPledge('wm', 'slug-x', 'pending', 'bank_transfer', 'manual'); // 수기 등록은 입금 대기가 아니다
    await insertPledge('wt', 'slug-x', 'pending', 'toss'); // 토스 결제창 홀드는 아니다

    const dash = await loadAdminDashboard(NOW);

    expect(dash.queues.awaitingDeposit).toEqual({ bookings: 2, shows: 1, shop: 1, funding: 1 });
    const issue = dash.issues.find((i) => i.title.includes('계좌 입금 대기'));
    expect(issue?.title).toContain('3건');
    expect(issue?.detail).toContain('공연 1건');
    expect(issue?.detail).toContain('예약·믹싱 1건');
    expect(issue?.detail).toContain('펀딩 1건');
  });
});

describe('이번 주 세션 — 결제 링크 이용 일정(0062)', () => {
  const insertLinkOrder = async (id: string, status: string, sessionIso: string | null, hours = 3) => {
    await insertOrder(id, 'deposit');
    await client.execute({ sql: "UPDATE orders SET status = ? WHERE id = ?", args: [status, id] });
    await client.execute({
      sql: 'INSERT INTO payment_link_orders (order_no, slug, item_name, session_at, session_hours) VALUES (?, ?, ?, ?, ?)',
      args: [`NO-${id}`, 'a'.repeat(24), '보컬 녹음 1프로 (10/17 11:00)', sessionIso ? EPOCH(sessionIso) : null, sessionIso ? hours : null],
    });
  };

  it('결제된 링크 주문의 이용 일시가 창 안이면 예약 세션과 시각순으로 함께 나온다', async () => {
    await insertBooking('b1', '2026-09-18T01:00:00Z'); // KST 9/18 10:00
    await insertLinkOrder('l1', 'paid', '2026-09-17T02:00:00Z'); // KST 9/17 11:00
    const d = await loadAdminDashboard(NOW);
    expect(d.upcomingSessions.map((x) => [x.kind, x.orderId])).toEqual([['link', 'l1'], ['booking', 'b1']]);
    const link = d.upcomingSessions[0];
    expect(link).toMatchObject({ productName: '보컬 녹음 1프로 (10/17 11:00)', customerName: '홍길동' });
    expect(new Date(link.endAt).getTime() - new Date(link.startAt).getTime()).toBe(3 * 3600 * 1000);
  });

  it('결제 전·환불된 링크 주문, 창 밖·일시 없는 링크는 나오지 않는다', async () => {
    await insertLinkOrder('l-pending', 'pending', '2026-09-17T02:00:00Z');
    await insertLinkOrder('l-refunded', 'refunded', '2026-09-17T02:00:00Z');
    await insertLinkOrder('l-far', 'paid', '2026-10-30T02:00:00Z');
    await insertLinkOrder('l-none', 'paid', null);
    expect((await loadAdminDashboard(NOW)).upcomingSessions).toEqual([]);
  });

  it('링크 표가 없는 DB에서도 대시보드는 열린다(그 갈래만 건너뜀)', async () => {
    await client.execute('ALTER TABLE payment_link_orders RENAME TO payment_link_orders_x');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await insertBooking('b2', '2026-09-18T01:00:00Z');
      expect((await loadAdminDashboard(NOW)).upcomingSessions.map((x) => x.orderId)).toEqual(['b2']);
    } finally {
      spy.mockRestore();
      await client.execute('ALTER TABLE payment_link_orders_x RENAME TO payment_link_orders');
    }
  });
});

describe('상점 정산 — 기록 대기(지난 달)·이체 대기 카드', () => {
  // 기록은 이번 달(2026-11) 이전, 2026-10부터 센다 — NOW 2026-11-20 KST.
  const NOW_NOV = new Date('2026-11-20T03:00:00Z');
  const OCT_SHIPPED = EPOCH('2026-10-15T03:00:00Z');

  const seedShopSale = async () => {
    await client.execute({ sql: `INSERT INTO funding_creators (id, email, name, tax_type, payout_account_enc) VALUES ('sc1', 'sc1@example.com', '아티스트', 'invoice', 'enc')`, args: [] });
    await client.execute({ sql: `INSERT INTO shop_artists (creator_id, slug) VALUES ('sc1', 'sc1-artist')`, args: [] });
    await client.execute({ sql: `INSERT INTO shop_products (id, creator_id, slug, category, title, description, images, review_status, published) VALUES ('sp1', 'sc1', 'sp1', 'goods', '상품', '소개', '[]', 'approved', 1)`, args: [] });
    await client.execute({ sql: `INSERT INTO shop_product_skus (id, product_id, option_label, price, locked_at) VALUES ('db-aaaaaaaaaa', 'sp1', 'A', 20000, 1)`, args: [] });
    await insertOrder('shop-o1', 'merch');
    await client.execute({
      sql: `INSERT INTO shop_orders (order_no, recipient_name, recipient_phone, postcode, address1, subtotal_amount, shipping_fee, hold_expires_at, fulfillment_status, shipped_at)
            VALUES ('NO-shop-o1', 'x', '010', '03000', '서울', 40000, 0, 0, 'shipped', ?)`,
      args: [OCT_SHIPPED],
    });
    await client.execute({
      sql: `INSERT INTO shop_order_items (id, order_no, sku_id, product_slug, product_title, unit_price, quantity) VALUES ('si1', 'NO-shop-o1', 'db-aaaaaaaaaa', 'sp1', '상품', 20000, 2)`,
      args: [],
    });
  };
  const insertShopPayout = (status: 'pending' | 'paid') =>
    client.execute({
      sql: `INSERT INTO partner_payouts (id, kind, subject_key, period, creator_id, payee_name, tax_type, net_amount, status)
            VALUES ('pp1', 'shop', 'creator:sc1', '2026-10', 'sc1', '아티스트', 'invoice', 22000, ?)`,
      args: [status],
    });

  afterEach(async () => {
    for (const t of ['partner_payouts', 'shop_order_items', 'shop_orders', 'shop_product_skus', 'shop_products', 'shop_artists']) {
      await client.execute(`DELETE FROM ${t}`);
    }
  });

  it('지난 달에 판 아티스트가 기록되지 않았으면 기록 대기로 센다. 기록하면 이체 대기로 옮겨 간다', async () => {
    await seedShopSale();
    let dash = await loadAdminDashboard(NOW_NOV);
    expect(dash.queues).toMatchObject({ shopPayoutsToRecord: 1, shopPayoutsPending: 0 });

    await insertShopPayout('pending');
    dash = await loadAdminDashboard(NOW_NOV);
    expect(dash.queues).toMatchObject({ shopPayoutsToRecord: 0, shopPayoutsPending: 1 });

    await client.execute(`UPDATE partner_payouts SET status = 'paid', paid_at = 1795000000`);
    dash = await loadAdminDashboard(NOW_NOV);
    expect(dash.queues).toMatchObject({ shopPayoutsToRecord: 0, shopPayoutsPending: 0 });
  });

  it('이번 달 판매는 기록 대기가 아니다(아직 판매 중)', async () => {
    await seedShopSale();
    expect((await loadAdminDashboard(new Date('2026-10-20T03:00:00Z'))).queues.shopPayoutsToRecord).toBe(0);
  });

  it('상점 판매가 없으면 0이고 상점 확장 표를 읽지 않아도 실패하지 않는다', async () => {
    expect((await loadAdminDashboard(NOW_NOV)).queues).toMatchObject({ shopPayoutsToRecord: 0, shopPayoutsPending: 0 });
  });

  it('정산 기록 표가 없는 DB(0067 전)에서도 대시보드는 열리고 두 카드는 0이다', async () => {
    await seedShopSale();
    await client.execute('ALTER TABLE partner_payouts RENAME TO partner_payouts_x');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const dash = await loadAdminDashboard(NOW_NOV);
      expect(dash.queues).toMatchObject({ shopPayoutsToRecord: 0, shopPayoutsPending: 0 });
      expect(dash.queues.mixingReceived).toBe(0);
    } finally {
      spy.mockRestore();
      await client.execute('ALTER TABLE partner_payouts_x RENAME TO partner_payouts');
    }
  });
});

describe('공연 주최자 정산 — 대기열·기한 점검', () => {
  const seedShowSale = async (id: string, startIso: string, opts: { organizer?: boolean } = {}) => {
    const { organizer = true } = opts;
    const start = EPOCH(startIso);
    await client.execute({ sql: `INSERT OR IGNORE INTO funding_creators (id, email, name, tax_type, payout_account_enc) VALUES ('hc1', 'hc1@example.com', '주최자', 'invoice', 'enc')`, args: [] });
    await client.execute({
      sql: `INSERT INTO shows (id, slug, title, presenter_name, performers, age_rating, running_minutes, venue_name, venue_address, description, status)
            VALUES (?, ?, ?, 'p', 'a', '전체', 60, 'v', 'addr', 'd', 'published')`,
      args: [id, `slug-${id}`, id],
    });
    await client.execute({ sql: `INSERT INTO showtimes (id, show_id, starts_at, sales_close_at) VALUES (?, ?, ?, ?)`, args: [`st-${id}`, id, start, start - 3600] });
    if (organizer) {
      await client.execute({ sql: `INSERT INTO show_submissions (id, creator_id, show_id, draft_json, review_status, organizer_terms_version) VALUES (?, 'hc1', ?, '{}', 'approved', 'v')`, args: [`sub-${id}`, id] });
    }
    await insertOrder(`h-${id}`, 'ticket');
    await client.execute({ sql: `UPDATE orders SET total_amount = 30000 WHERE id = ?`, args: [`h-${id}`] });
    await client.execute({ sql: `INSERT INTO show_orders (order_no, showtime_id, buyer_name, buyer_contact) VALUES (?, ?, 'x', '010')`, args: [`NO-h-${id}`, `st-${id}`] });
    await client.execute({ sql: `INSERT INTO payments (id, order_id, payment_key, method) VALUES (?, ?, ?, 'card')`, args: [`hp-${id}`, `h-${id}`, `pk-${id}`] });
  };
  const insertShowPayout = (showId: string, status: 'pending' | 'paid') =>
    client.execute({
      sql: `INSERT INTO partner_payouts (id, kind, subject_key, period, creator_id, payee_name, tax_type, net_amount, status)
            VALUES (?, 'show', ?, 'all', 'hc1', '주최자', 'invoice', 1000, ?)`,
      args: [`pp-${showId}`, showId, status],
    });

  afterEach(async () => {
    for (const t of ['partner_payouts', 'payments', 'show_orders', 'show_submissions', 'showtimes', 'shows']) {
      await client.execute(`DELETE FROM ${t}`);
    }
  });

  it('끝났고 정산이 안 기록된 주최자 공연만 기록 대기로 센다(직영·진행 중 제외). 기록하면 이체 대기로 옮겨 간다', async () => {
    await seedShowSale('done', '2026-09-15T01:00:00Z'); // 9/16 12:00 현재 종료
    await seedShowSale('direct', '2026-09-10T01:00:00Z', { organizer: false });
    await seedShowSale('future', '2026-09-30T01:00:00Z');
    let dash = await loadAdminDashboard(NOW);
    expect(dash.queues).toMatchObject({ showPayoutsToRecord: 1, showPayoutsPending: 0 });

    await insertShowPayout('done', 'pending');
    dash = await loadAdminDashboard(NOW);
    expect(dash.queues).toMatchObject({ showPayoutsToRecord: 0, showPayoutsPending: 1 });

    await client.execute(`UPDATE partner_payouts SET status = 'paid', paid_at = 1795000000`);
    dash = await loadAdminDashboard(NOW);
    expect(dash.queues).toMatchObject({ showPayoutsToRecord: 0, showPayoutsPending: 0 });
  });

  it('마지막 회차 종료 후 영업일 14일을 넘기면 점검 항목(high)으로도 올라온다 — 기한 안은 카드만', async () => {
    await seedShowSale('late', '2026-08-01T01:00:00Z');
    await seedShowSale('fresh', '2026-09-15T01:00:00Z');
    const dash = await loadAdminDashboard(NOW);
    const issue = dash.issues.find((i) => i.title.includes('정산 안내 기한') && i.title.includes('공연'));
    expect(issue).toMatchObject({ severity: 'high', href: '/admin/shows' });
    expect(issue?.title).toContain('영업일 14일');
    expect(issue?.title).toContain('공연 1건');
    expect(issue?.detail).toContain('slug-late');
    expect(issue?.detail).not.toContain('slug-fresh');
    expect(dash.queues.showPayoutsToRecord).toBe(2);
  });

  it('기록되면 기한을 넘겼어도 점검 항목에서 빠진다', async () => {
    await seedShowSale('late', '2026-08-01T01:00:00Z');
    await insertShowPayout('late', 'pending');
    const dash = await loadAdminDashboard(NOW);
    expect(dash.issues.find((i) => i.title.includes('정산 안내 기한') && i.title.includes('공연'))).toBeUndefined();
  });

  it('정산 기록 표가 없는 DB(0067 전)에서도 대시보드는 열리고 공연 카드는 0이다', async () => {
    await seedShowSale('late', '2026-08-01T01:00:00Z');
    await client.execute('ALTER TABLE partner_payouts RENAME TO partner_payouts_x');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const dash = await loadAdminDashboard(NOW);
      expect(dash.queues).toMatchObject({ showPayoutsToRecord: 0, showPayoutsPending: 0 });
      expect(dash.issues.find((i) => i.title.includes('정산 안내 기한') && i.title.includes('공연'))).toBeUndefined();
    } finally {
      spy.mockRestore();
      await client.execute('ALTER TABLE partner_payouts_x RENAME TO partner_payouts');
    }
  });
});
