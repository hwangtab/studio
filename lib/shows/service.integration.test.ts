import { drizzle } from 'drizzle-orm/libsql';

import { createTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';
import * as schema from '../../db/schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let testDb: Database;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));

import { createShowOrder, expireStaleShowOrders } from './service';

async function seedShow(db: Database, opts: { capacity?: number; quota?: number | null } = {}) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A구역', capacity: opts.capacity ?? 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 3600 * 24 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000, quota: opts.quota ?? null });
  return { showId, showtimeId, ticketTypeId: 'type-1' };
}

describe('createShowOrder', () => {
  let db: Database;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    testDb = db;
  });

  it('재고가 있으면 성공하고 티켓이 held로 생성된다', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await createShowOrder(
      { showtimeId, ticketTypeId, quantity: 2, buyerName: '홍길동', buyerContact: '010-0000-0000' },
      new Date()
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
      expect(order?.status).toBe('pending');
      const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, result.orderNo) });
      expect(tickets.length).toBe(2);
      expect(tickets.every((t) => t.status === 'held')).toBe(true);
    }
  });

  it('정원 초과면 sold_out', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db, { capacity: 1 });
    await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'b', buyerContact: '010' }, new Date());
    expect(result).toEqual({ ok: false, code: 'sold_out' });
  });

  it('판매마감 이후면 sales_closed', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const afterClose = new Date(Date.now() + 86400 * 11 * 1000);
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, afterClose);
    expect(result).toEqual({ ok: false, code: 'sales_closed' });
  });
});

describe('expireStaleShowOrders', () => {
  it('보류만료된 pending 주문을 expired로 바꾼다', async () => {
    const t = await createTestDb();
    const db = t.db;
    testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const past = new Date(Date.now() - 1000 * 3600);
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, past);
    expect(result.ok).toBe(true);
    const expiredCount = await expireStaleShowOrders(new Date());
    expect(expiredCount).toBe(1);
    if (result.ok) {
      const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
      expect(order?.status).toBe('expired');
    }
  });
});
