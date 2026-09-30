import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';
import { sql } from 'drizzle-orm';

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

import { createShowOrder } from './service';
import { confirmShowOrder } from './confirm';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { checkInTicket, undoCheckIn } from './checkin';

async function seedIssued(db: ShowsTestDb) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 3600;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 60 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  const created = await createShowOrder({ showtimeId, ticketTypeId: 'type-1', quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date(Date.now() - 3600 * 24));
  if (!created.ok) throw new Error('setup failed');
  await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, createFakeToss());
  const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
  if (!ticket) throw new Error('setup failed — 티켓이 발급되지 않았다');
  return ticket;
}

describe('checkInTicket', () => {
  it('발급된 티켓을 처음 스캔하면 성공한다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const ticket = await seedIssued(db);
    const outcome = await checkInTicket(ticket.code, 'link-1', new Date());
    expect(outcome.status).toBe('checked_in');
  });

  it('다른 스태프가 같은 티켓을 스캔하면 already_checked_in', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const ticket = await seedIssued(db);
    await checkInTicket(ticket.code, 'link-1', new Date());
    const second = await checkInTicket(ticket.code, 'link-2', new Date());
    expect(second.status).toBe('already_checked_in');
  });

  it('같은 스태프가 10초 안에 같은 티켓을 재스캔하면(디바운스) checked_in을 유지한다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const ticket = await seedIssued(db);
    await checkInTicket(ticket.code, 'link-1', new Date());
    const second = await checkInTicket(ticket.code, 'link-1', new Date());
    expect(second.status).toBe('checked_in');
  });

  it('환불된 티켓은 입장 거부된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const ticket = await seedIssued(db);
    await db.run(sql`update show_tickets set status = 'refunded' where id = ${ticket.id}`);
    const outcome = await checkInTicket(ticket.code, 'link-1', new Date());
    expect(outcome.status).toBe('invalid');
  });
});

describe('undoCheckIn', () => {
  it('같은 링크가 2분 안에 취소하면 되돌릴 수 있다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const ticket = await seedIssued(db);
    await checkInTicket(ticket.code, 'link-1', new Date());
    const ok = await undoCheckIn(ticket.id, 'link-1', new Date());
    expect(ok).toBe(true);
    const updated = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, ticket.id) });
    expect(updated?.checkedInAt).toBeNull();
  });
});
