/** @jest-environment node */
/**
 * 공연 계좌 입금 라우트 배선(실 DB) — 고객 refund API의 withdraw(입금 전 신청 거두기), 관리자 공연 API의
 * confirm_deposit·cancel_unpaid_deposit·mark_refund_sent. 전이 자체는 lib/shows/bankDeposit.integration.test.ts.
 */
import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../../db/schema';

let mockDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }) }));
jest.mock('../../../lib/shows/email', () => ({
  ...jest.requireActual('../../../lib/shows/email'),
  sendShowTicketEmail: jest.fn().mockResolvedValue({ sent: true }),
}));
jest.mock('../../../lib/payments/bankDepositOrders', () => ({
  ...jest.requireActual('../../../lib/payments/bankDepositOrders'),
  sendDepositGuideEmails: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import refundHandler from '../../../pages/api/shows/refund';
import adminHandler from '../../../pages/api/admin/shows/[id]';
import { createShowOrder } from '../../../lib/shows/service';
import { sendShowTicketEmail } from '../../../lib/shows/email';
/* eslint-enable import/first */

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;
const call = async (handler: Handler, body: unknown, query: Record<string, string> = {}) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method: 'POST', body, query, headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status, revalidate: jest.fn().mockResolvedValue(undefined) } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] as Record<string, unknown> };
};

beforeEach(async () => {
  mockDb = (await createTestDb()).db;
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await mockDb.insert(shows).values({
    id: 'show-1', slug: 's1', title: '공연', presenterName: 'p', performers: 'a',
    ageRating: '전체', runningMinutes: 60, venueName: '극장', venueAddress: 'addr', description: 'd', status: 'published',
  });
  await mockDb.insert(showZones).values({ id: 'zone-1', showId: 'show-1', code: 'A', label: 'A', capacity: 10 });
  const startsAt = Math.floor(Date.now() / 1000) + 20 * 86400;
  await mockDb.insert(showtimes).values({ id: 'st-1', showId: 'show-1', startsAt, salesCloseAt: startsAt - 60 });
  await mockDb.insert(showTicketTypes).values({ id: 'type-1', showId: 'show-1', zoneId: 'zone-1', name: '일반', price: 10000 });
});
afterEach(() => jest.restoreAllMocks());

const bankOrder = async () => {
  const r = await createShowOrder({
    showtimeId: 'st-1', ticketTypeId: 'type-1', quantity: 1, buyerName: '이관객', buyerContact: '010-1', buyerEmail: 'f@example.com',
    paymentMethod: 'bank_transfer',
  }, new Date());
  if (!r.ok) throw new Error('setup');
  return (await mockDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, r.orderNo) }))!;
};
const statusOf = async (orderNo: string) => (await mockDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) }))?.status;
const admin = (action: string, orderNo: string) => call(adminHandler as Handler, { action, orderNo }, { id: 'show-1' });

it('고객 withdraw: 입금 대기 신청을 거두고 좌석을 푼다(토큰이 틀리면 404, 대기가 아니면 409)', async () => {
  const o = await bankOrder();
  expect((await call(refundHandler as Handler, { action: 'withdraw', orderNo: o.orderNo, token: 'wrong' })).status).toBe(404);
  const ok = await call(refundHandler as Handler, { action: 'withdraw', orderNo: o.orderNo.toLowerCase(), token: o.manageToken });
  expect(ok).toMatchObject({ status: 200, body: { ok: true, withdrawn: true } });
  expect(await statusOf(o.orderNo)).toBe('deposit_cancelled');
  const tickets = await mockDb.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, o.orderNo) });
  expect(tickets.every((t) => t.status === 'void')).toBe(true);
  expect((await call(refundHandler as Handler, { action: 'withdraw', orderNo: o.orderNo, token: o.manageToken })).status).toBe(409);
});

describe('관리자 공연 API — 계좌 입금', () => {
  it('confirm_deposit → 발권·티켓 메일, 두 번째는 409', async () => {
    const o = await bankOrder();
    expect((await admin('confirm_deposit', o.orderNo)).status).toBe(200);
    expect(await statusOf(o.orderNo)).toBe('paid');
    expect(sendShowTicketEmail).toHaveBeenCalledWith(o.orderNo);
    expect((await admin('confirm_deposit', o.orderNo)).status).toBe(409);
  });

  it('cancel_unpaid_deposit → deposit_cancelled', async () => {
    const o = await bankOrder();
    expect((await admin('cancel_unpaid_deposit', o.orderNo)).status).toBe(200);
    expect(await statusOf(o.orderNo)).toBe('deposit_cancelled');
  });

  it('mark_refund_sent: 계좌 입금 주문만(대기 건은 409), 환불 계좌 행에 송금 완료를 찍는다', async () => {
    const o = await bankOrder();
    expect((await admin('mark_refund_sent', o.orderNo)).status).toBe(409);
    await admin('confirm_deposit', o.orderNo);
    await mockDb.run(
      (await import('drizzle-orm')).sql`INSERT INTO refund_accounts (id, order_kind, order_no, bank_name, account_number_enc, account_holder, requested_at) VALUES ('ra','show',${o.orderNo},'국민','enc','이관객', unixepoch())`,
    );
    expect((await admin('mark_refund_sent', o.orderNo)).status).toBe(200);
    const row = await mockDb.query.refundAccounts.findFirst();
    expect(row?.refundedAt).not.toBeNull();
  });

  it('다른 공연의 주문번호는 404', async () => {
    expect((await admin('confirm_deposit', 'TKT-NOPE')).status).toBe(404);
  });
});
