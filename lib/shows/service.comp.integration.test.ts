import { createTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { issueCompTickets, revokeCompTicket } from './service';

async function seedShow(db: any, compQuota = 5) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000, compQuota });
  return { showtimeId, ticketTypeId: 'type-1' };
}

describe('issueCompTickets', () => {
  it('초대권을 발급하면 TKT-C- 주문번호와 issued 티켓이 생성된다(결제 없이)', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 2, note: 'VIP 초청' }, new Date());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orderNo).toMatch(/^TKT-C-/);
      const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, result.orderNo) });
      expect(order?.status).toBe('paid');
      expect(order?.totalAmount).toBe(0);
    }
  });

  it('구역 정원이 초과되면 sold_out', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db, 100);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 11, note: 'x' }, new Date());
    expect(result).toEqual({ ok: false, code: 'sold_out' });
  });
});

describe('revokeCompTicket', () => {
  it('초대권을 취소하면 void가 된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 1, note: 'x' }, new Date());
    if (!result.ok) throw new Error('setup failed');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, result.orderNo) });
    const ok = await revokeCompTicket(tickets[0].id);
    expect(ok).toBe(true);
    const updated = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(updated?.status).toBe('void');
  });
});
