/** @jest-environment node */
/**
 * POST /api/admin/shows/[id]/payout — 인증·소속 확인·기록/지급 완료/취소/면제 액션. 계산·불변식 자체는
 * lib/partnerPayouts/showPayouts.integration.test.ts가 데이터로 고정한다 — 여기서는 라우트 계약만 본다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../../helpers/showsDb';
import { fundingCreators, shows, showZones, showtimes, showTicketTypes } from '../../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../../db/client', () => ({ getDb: () => testDb }));
const mockAuth = jest.fn();
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: (...args: unknown[]) => mockAuth(...args) }));

/* eslint-disable import/first */
import handler from '../../../../pages/api/admin/shows/[id]/payout';
import { buildShowPayoutPreview } from '../../../../lib/partnerPayouts/show';
import { findPartnerPayout } from '../../../../lib/partnerPayouts/store';
/* eslint-enable import/first */

const PAST = Math.floor(new Date('2020-01-01T10:00:00Z').getTime() / 1000);
const FUTURE = Math.floor(new Date('2099-01-01T10:00:00Z').getTime() / 1000);

function call(req: Partial<NextApiRequest>) {
  return new Promise<{ status: number; body: Record<string, unknown>; headers: Record<string, string> }>((resolve) => {
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 200,
      setHeader: (k: string, v: string) => { headers[k] = v; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: Record<string, unknown>) { resolve({ status: this.statusCode, body, headers }); return this; },
    };
    Promise.resolve(handler({ method: 'POST', headers: {}, socket: {}, query: { id: 's1' }, ...req } as unknown as NextApiRequest, res as unknown as NextApiResponse));
  });
}

const seedShow = async (id: string, startsAt: number, organizer = true) => {
  await testDb.insert(shows).values({ id, slug: `slug-${id}`, title: id, presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await testDb.insert(showZones).values({ id: `z-${id}`, showId: id, code: 'A', label: 'A', capacity: 10 });
  await testDb.insert(showtimes).values({ id: `st-${id}`, showId: id, startsAt, salesCloseAt: startsAt - 3600 });
  await testDb.insert(showTicketTypes).values({ id: `tt-${id}`, showId: id, zoneId: `z-${id}`, name: '일반', price: 50000 });
  if (organizer) {
    await testDb.run(sql`INSERT INTO show_submissions (id, creator_id, show_id, draft_json, review_status, organizer_terms_version) VALUES (${`sub-${id}`}, 'c1', ${id}, '{}', 'approved', 'v')`);
  }
  await testDb.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
    VALUES (${`o-${id}`}, ${`NO-${id}`}, 'ticket', 'paid', 'x', '010', 'b@e.c', ${`tok-${id}`}, 50000, 0, 50000)`);
  await testDb.run(sql`INSERT INTO show_orders (order_no, showtime_id, buyer_name, buyer_contact) VALUES (${`NO-${id}`}, ${`st-${id}`}, 'x', '010')`);
  await testDb.run(sql`INSERT INTO show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, issued_by, unit_amount) VALUES (${`t-${id}`}, ${`NO-${id}`}, ${`st-${id}`}, ${`tt-${id}`}, ${`code-${id}`}, 'issued', 'customer', 50000)`);
  await testDb.run(sql`INSERT INTO payments (id, order_id, payment_key, method) VALUES (${`p-${id}`}, ${`o-${id}`}, ${`pk-${id}`}, 'card')`);
};

const recordBody = async (id = 's1') => {
  const p = (await buildShowPayoutPreview(id))!;
  return { action: 'record', expected: { netAmount: p.netAmount, adjustmentAmount: p.adjustmentAmount } };
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  mockAuth.mockResolvedValue({ ok: true, actor: 'admin' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: '주최자', taxType: 'withholding', payoutAccountEnc: 'enc', residentNumberEnc: 'enc' });
  await seedShow('s1', PAST);
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('인증·메서드·검증', () => {
  it('인증이 없으면 401, GET은 405, 모든 응답은 no-store', async () => {
    mockAuth.mockResolvedValueOnce({ ok: false });
    const unauth = await call({ body: await recordBody() });
    expect(unauth.status).toBe(401);
    expect(unauth.headers['Cache-Control']).toBe('no-store');
    expect((await call({ method: 'GET' })).status).toBe(405);
  });

  it('없는 공연은 404, 필수 값이 없거나 알 수 없는 작업이면 400', async () => {
    expect((await call({ query: { id: 'nope' }, body: await recordBody() })).status).toBe(404);
    expect((await call({ body: { action: 'record' } })).status).toBe(400);
    expect((await call({ body: { action: 'record', expected: { netAmount: 'x', adjustmentAmount: 0 } } })).status).toBe(400);
    expect((await call({ body: { action: 'mark_paid' } })).status).toBe(400);
    expect((await call({ body: { action: 'set_cancel_fee_waived', showtimeId: 'st-s1' } })).status).toBe(400);
    expect((await call({ body: { action: 'nope' } })).status).toBe(400);
  });
});

describe('기록 → 지급 완료 / 취소', () => {
  it('기록하면 200이고 정산 행이 생긴다. 두 번째는 409 already_recorded', async () => {
    const r = await call({ body: await recordBody() });
    expect(r.status).toBe(200);
    expect(await findPartnerPayout('show', 's1', 'all')).toMatchObject({ id: r.body.payoutId, creatorId: 'c1', status: 'pending' });
    const again = await call({ body: await recordBody() });
    expect(again).toMatchObject({ status: 409, body: { code: 'already_recorded' } });
  });

  it('금액이 다르면 409 amount_changed', async () => {
    const r = await call({ body: { action: 'record', expected: { netAmount: 1, adjustmentAmount: 0 } } });
    expect(r).toMatchObject({ status: 409, body: { code: 'amount_changed', expectedNetAmount: 1 } });
    expect(await findPartnerPayout('show', 's1', 'all')).toBeNull();
  });

  it('마지막 회차가 끝나기 전이면 409 not_ended — 기록하지 않는다', async () => {
    await seedShow('s2', FUTURE);
    const r = await call({ query: { id: 's2' }, body: await recordBody('s2') });
    expect(r).toMatchObject({ status: 409, body: { code: 'not_ended' } });
    expect(await findPartnerPayout('show', 's2', 'all')).toBeNull();
  });

  it('주최자 없는 직영 공연은 409 not_settleable', async () => {
    await seedShow('d1', PAST, false);
    const r = await call({ query: { id: 'd1' }, body: { action: 'record', expected: { netAmount: 0, adjustmentAmount: 0 } } });
    expect(r).toMatchObject({ status: 409, body: { code: 'not_settleable' } });
  });

  it('지급 완료는 한 번만(409), 지급한 기록은 취소할 수 없다(409). 이체 전 기록은 취소된다', async () => {
    const payoutId = (await call({ body: await recordBody() })).body.payoutId as string;
    expect((await call({ body: { action: 'delete', payoutId } })).status).toBe(200);
    expect(await findPartnerPayout('show', 's1', 'all')).toBeNull();

    const second = (await call({ body: await recordBody() })).body.payoutId as string;
    expect((await call({ body: { action: 'mark_paid', payoutId: second, memo: '이체' } })).status).toBe(200);
    expect((await call({ body: { action: 'mark_paid', payoutId: second } })).status).toBe(409);
    expect((await call({ body: { action: 'delete', payoutId: second } })).status).toBe(409);
    expect(await findPartnerPayout('show', 's1', 'all')).toMatchObject({ status: 'paid', memo: '이체' });
  });

  it('다른 공연·다른 종류(상점)의 정산 id로는 지급 완료·취소할 수 없다(404)', async () => {
    await seedShow('s2', PAST);
    const other = (await call({ query: { id: 's2' }, body: await recordBody('s2') })).body.payoutId as string;
    expect((await call({ body: { action: 'mark_paid', payoutId: other } })).status).toBe(404);
    expect((await call({ body: { action: 'delete', payoutId: other } })).status).toBe(404);
    expect(await findPartnerPayout('show', 's2', 'all')).toMatchObject({ status: 'pending' });

    await testDb.run(sql`INSERT INTO partner_payouts (id, kind, subject_key, period, payee_name, tax_type, net_amount) VALUES ('shop1', 'shop', 's1', 'all', 'x', 'invoice', 1)`);
    expect((await call({ body: { action: 'mark_paid', payoutId: 'shop1' } })).status).toBe(404);
    expect((await call({ body: { action: 'delete', payoutId: 'shop1' } })).status).toBe(404);
  });
});

describe('수수료 면제·표 미적용', () => {
  it('취소되지 않은 회차·남의 회차는 404', async () => {
    expect((await call({ body: { action: 'set_cancel_fee_waived', showtimeId: 'st-s1', waived: true } })).status).toBe(404);
    expect((await call({ body: { action: 'set_cancel_fee_waived', showtimeId: 'zzz', waived: true } })).status).toBe(404);
  });

  it('표(0067)가 없으면 503 migration_needed', async () => {
    await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
    await testDb.run(sql`DROP TABLE partner_payouts`);
    const r = await call({ body: { action: 'record', expected: { netAmount: 0, adjustmentAmount: 0 } } });
    expect(r).toMatchObject({ status: 503, body: { code: 'migration_needed' } });
  });
});
