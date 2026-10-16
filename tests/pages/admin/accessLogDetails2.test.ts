/** @jest-environment node */
/**
 * 관리자 상세 화면 열람 접속기록 2차 — 예약·믹싱 주문, 구독, 공연 관리, 공연 심사.
 * 고객 이름·연락처·이메일이 props로 실리는 화면이라 열었다는 사실이 남는지, 없는 대상도 not_found로 남는지,
 * 기록 실패가 화면을 막지 않는지, 기록에 값이 한 글자도 안 들어가는지를 본다.
 */
import type { Client } from '@libsql/client';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { privacyAccessLogs } from '../../../db/schema';
import { seedShow } from '../../../lib/shows/seed';
import { bakkeojiShow } from '../../../data/shows/bakkeoji-anneun-maeumdeul';

let testDb: ShowsTestDb;
let client: Client;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  authenticateAdminRequest: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }),
}));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../lib/payments/windowOpen', () => ({ loadPaymentWindowOpen: jest.fn().mockResolvedValue(null) }));

/* eslint-disable import/first */
import { getServerSideProps as bookingDetail } from '../../../pages/admin/bookings/[id]';
import { getServerSideProps as subscriptionDetail } from '../../../pages/admin/subscriptions/[id]';
import { getServerSideProps as showDetail } from '../../../pages/admin/shows/[id]';
import { getServerSideProps as submissionDetail } from '../../../pages/admin/shows/submissions/[id]';
/* eslint-enable import/first */

type Result = { props?: Record<string, unknown>; notFound?: boolean };
const req = { headers: {}, cookies: {}, socket: { remoteAddress: '203.0.113.9' } };
const call = (gssp: unknown, ctx: Record<string, unknown>) =>
  (gssp as (c: unknown) => Promise<Result>)({ req, res: { setHeader: jest.fn() }, params: {}, query: {}, ...ctx });
const logs = () => testDb.select().from(privacyAccessLogs);

beforeEach(async () => {
  const t = await createTestDb();
  testDb = t.db;
  client = t.client;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const PII = /김고객|010-7777-6666|customer@example/;

describe('예약·믹싱 주문 상세', () => {
  const seed = async () => {
    await client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token)
            VALUES ('o1','SNB-1','session','paid','김고객','010-7777-6666','customer@example.com',100,10,110,'tok')`,
      args: [],
    });
    await client.execute({
      sql: `INSERT INTO bookings (id, order_id, product_id, service_type, status, start_at, end_at, duration_hours)
            VALUES ('b1','o1','recording-pro','recording','confirmed',1790000000,1790010800,3)`,
      args: [],
    });
  };

  it('열면 booking_view가 주문 id로 남고 값은 적히지 않는다', async () => {
    await seed();
    expect((await call(bookingDetail, { query: { id: 'o1' } })).props).toBeDefined();
    const rows = await logs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: 'kyungha', action: 'booking_view', targetId: 'o1', result: 'success', rowCount: null, ip: '203.0.113.9' });
    expect(JSON.stringify(rows)).not.toMatch(PII);
  });

  it('없는 주문도 not_found로 남고, 기록 저장이 실패해도 화면은 열린다', async () => {
    expect((await call(bookingDetail, { query: { id: 'nope' } })).notFound).toBe(true);
    expect(await logs()).toMatchObject([{ action: 'booking_view', targetId: 'nope', result: 'not_found' }]);
    await seed();
    await client.execute('DROP TABLE privacy_access_logs');
    expect((await call(bookingDetail, { query: { id: 'o1' } })).props).toBeDefined();
  });
});

describe('구독 상세', () => {
  const seed = () =>
    client.execute({
      sql: `INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key, item_amount, vat_amount, total_amount, billing_day, status, manage_token)
            VALUES ('sub1','lesson','김고객','010-7777-6666','customer@example.com','ck1',100,10,110,5,'active','mt1')`,
      args: [],
    });

  it('열면 subscription_view가 구독 id로 남고 값은 적히지 않는다', async () => {
    await seed();
    expect((await call(subscriptionDetail, { query: { id: 'sub1' } })).props).toBeDefined();
    const rows = await logs();
    expect(rows).toMatchObject([{ action: 'subscription_view', targetId: 'sub1', result: 'success' }]);
    expect(JSON.stringify(rows)).not.toMatch(PII);
  });

  it('없는 구독은 not_found로 남는다', async () => {
    expect((await call(subscriptionDetail, { query: { id: 'nope' } })).notFound).toBe(true);
    expect((await logs()).map((l) => l.result)).toEqual(['not_found']);
  });
});

describe('공연 관리 화면', () => {
  it('열면 show_admin_view가 공연 id로 남는다', async () => {
    const future = new Date(Date.now() + 14 * 86400 * 1000);
    await seedShow(testDb, { ...bakkeojiShow, showtimes: [{ startsAt: future }] }, { apply: true });
    const show = (await client.execute('SELECT id FROM shows LIMIT 1')).rows[0];
    expect((await call(showDetail, { params: { id: String(show.id) } })).props).toBeDefined();
    expect(await logs()).toMatchObject([{ action: 'show_admin_view', targetId: String(show.id), result: 'success' }]);
  });

  it('없는 공연은 not_found로 남는다', async () => {
    expect((await call(showDetail, { params: { id: 'nope' } })).notFound).toBe(true);
    expect((await logs()).map((l) => [l.action, l.result])).toEqual([['show_admin_view', 'not_found']]);
  });
});

describe('공연 심사 상세', () => {
  it('없는 심사를 열어도 show_submission_view가 not_found로 남는다', async () => {
    expect((await call(submissionDetail, { params: { id: 'nope' } })).notFound).toBe(true);
    expect(await logs()).toMatchObject([{ action: 'show_submission_view', targetId: 'nope', result: 'not_found' }]);
  });
});
