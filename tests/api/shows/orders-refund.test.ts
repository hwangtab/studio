/** @jest-environment node */
/**
 * POST /api/shows/orders · /api/shows/refund — 입력 검증·레이트리밋·토큰 인증·환불 위임.
 * 재고 게이트·환불 계산 자체는 lib/shows/*.integration.test.ts가 검증한다.
 */
import { sql } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/booking/toss', () => ({ cancelPayment: jest.fn() }));
jest.mock('../../../lib/shows/refund', () => ({ refundShowTickets: jest.fn() }));

/* eslint-disable import/first */
import ordersHandler from '../../../pages/api/shows/orders';
import refundHandler from '../../../pages/api/shows/refund';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { refundShowTickets } from '../../../lib/shows/refund';
/* eslint-enable import/first */

function call(handler: (req: NextApiRequest, res: NextApiResponse) => unknown, req: Partial<NextApiRequest>) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      status(code: number) { this.statusCode = code; return this; },
      json(body: Record<string, unknown>) { resolve({ status: this.statusCode, body }); return this; },
    };
    Promise.resolve(handler({ method: 'POST', headers: {}, socket: {}, ...req } as NextApiRequest, res as unknown as NextApiResponse));
  });
}

async function seed(status: 'published' | 'draft' = 'published') {
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await testDb.insert(shows).values({ id: 'show-1', slug: 's', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status });
  await testDb.insert(showZones).values({ id: 'zone-1', showId: 'show-1', code: 'A', label: '전석', capacity: 2 });
  await testDb.insert(showtimes).values({ id: 'st-1', showId: 'show-1', startsAt, salesCloseAt: startsAt - 3600 });
  await testDb.insert(showTicketTypes).values({ id: 'tt-1', showId: 'show-1', zoneId: 'zone-1', name: '일반', price: 20000 });
}

const body = {
  showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 1, buyerName: '홍길동', buyerContact: '010-1234-5678',
  buyerEmail: 'a@b.co', refundPolicyAgreed: true,
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  (refundShowTickets as jest.Mock).mockReset();
});

describe('POST /api/shows/orders', () => {
  it('GET은 405', async () => {
    expect((await call(ordersHandler, { method: 'GET' })).status).toBe(405);
  });

  it('booking_create와 다른 레이트리밋 키를 쓰고, 한도 초과면 429', async () => {
    (consumeRateLimit as jest.Mock).mockResolvedValueOnce(false);
    const r = await call(ordersHandler, { body });
    expect(r.status).toBe(429);
    expect((consumeRateLimit as jest.Mock).mock.calls[0][0]).toMatch(/^show_order_create:ip:/);
  });

  it('검증 실패는 400, 주문은 만들어지지 않는다', async () => {
    await seed();
    const r = await call(ordersHandler, { body: { ...body, refundPolicyAgreed: false } });
    expect(r.status).toBe(400);
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
  });

  it('정상이면 201과 orderNo·서버 금액을 돌려주고 이메일이 저장된다', async () => {
    await seed();
    const r = await call(ordersHandler, { body: { ...body, quantity: 2 } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ok: true, totalAmount: 40000 });
    const order = await testDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, r.body.orderNo as string) });
    expect(order?.customerEmail).toBe('a@b.co');
    expect(order?.customerPhone).toBe('010-1234-5678');
  });

  it('잔여석이 모자라면 409 sold_out', async () => {
    await seed();
    const r = await call(ordersHandler, { body: { ...body, quantity: 3 } });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('sold_out');
  });

  it('draft 공연의 회차로는 주문을 만들 수 없다', async () => {
    await seed('draft');
    const r = await call(ordersHandler, { body });
    expect(r.status).toBe(409);
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
  });
});

describe('POST /api/shows/refund', () => {
  async function paidOrder() {
    await seed();
    const created = await call(ordersHandler, { body });
    const orderNo = created.body.orderNo as string;
    const order = await testDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    const ticket = await testDb.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    return { orderNo, token: order!.manageToken, ticketId: ticket!.id };
  }

  it('토큰이 틀리면 404 — 환불 로직을 부르지 않는다', async () => {
    const { orderNo, ticketId } = await paidOrder();
    const r = await call(refundHandler, { body: { orderNo, token: 'wrong', ticketIds: [ticketId] } });
    expect(r.status).toBe(404);
    expect(refundShowTickets).not.toHaveBeenCalled();
  });

  it('티켓을 안 고르면 400', async () => {
    const { orderNo, token } = await paidOrder();
    expect((await call(refundHandler, { body: { orderNo, token, ticketIds: [] } })).status).toBe(400);
  });

  it('성공하면 환불액을 돌려주고 중복 id는 한 번만 넘긴다', async () => {
    const { orderNo, token, ticketId } = await paidOrder();
    (refundShowTickets as jest.Mock).mockResolvedValue({ status: 'refunded', amount: 20000, orderStatus: 'refunded' });
    const r = await call(refundHandler, { body: { orderNo, token, ticketIds: [ticketId, ticketId] } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, refundAmount: 20000 });
    expect((refundShowTickets as jest.Mock).mock.calls[0][0]).toMatchObject({ orderNo, ticketIds: [ticketId] });
  });

  it('입장 처리된 티켓 등 거절 사유는 한국어 문구로 409', async () => {
    const { orderNo, token, ticketId } = await paidOrder();
    (refundShowTickets as jest.Mock).mockResolvedValue({ status: 'rejected', reason: 'checked_in' });
    const r = await call(refundHandler, { body: { orderNo, token, ticketIds: [ticketId] } });
    expect(r.status).toBe(409);
    expect(r.body.message).toBe('이미 입장 처리된 티켓은 환불할 수 없어요.');
  });

  it('토스 응답을 못 받은 경우(toss_unknown)는 202로 확인 안내', async () => {
    const { orderNo, token, ticketId } = await paidOrder();
    (refundShowTickets as jest.Mock).mockResolvedValue({ status: 'toss_unknown' });
    const r = await call(refundHandler, { body: { orderNo, token, ticketIds: [ticketId] } });
    expect(r.status).toBe(202);
  });

  it('초대권 티켓은 서버가 막는다', async () => {
    const { orderNo, token, ticketId } = await paidOrder();
    await testDb.run(sql`UPDATE show_tickets SET issued_by = 'organizer_comp' WHERE id = ${ticketId}`);
    const r = await call(refundHandler, { body: { orderNo, token, ticketIds: [ticketId] } });
    expect(r.status).toBe(409);
    expect(refundShowTickets).not.toHaveBeenCalled();
  });
});
