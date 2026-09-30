import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

import { issueCompTickets, revokeCompTicket } from './service';

async function seedShow(db: ShowsTestDb, compQuota = 5, zoneCapacity = 10) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: zoneCapacity });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000, compQuota });
  return { showtimeId, ticketTypeId: 'type-1' };
}

describe('issueCompTickets', () => {
  it('초대권을 발급하면 TKT-C- 주문번호와 issued 티켓이 생성된다(결제 없이)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 2, note: 'VIP 초청' }, new Date());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orderNo).toMatch(/^TKT-C-/);
      const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
      expect(order?.status).toBe('paid');
      expect(order?.totalAmount).toBe(0);
    }
  });

  it('구역 정원이 초과되면 sold_out', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    // compQuota는 넉넉히(100) 열어 두고 구역 정원(5)만 좁혀서, 이 테스트가 실제로 겨냥하는
    // 게이트(zoneCapacityCondition)가 comp_quota가 아니라 구역 정원임을 분명히 한다.
    // quantity는 1회 매수 상한(SHOW_MAX_PER_ORDER_CAP=10) 이내로 두어 그 게이트와 섞이지
    // 않게 한다.
    const { showtimeId, ticketTypeId } = await seedShow(db, 100, 5);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 6, note: 'x' }, new Date());
    expect(result).toEqual({ ok: false, code: 'sold_out' });
  });

  it('요청 수량이 1회 매수 상한을 넘으면 invalid_quantity', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db, 100, 100);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 11, note: 'x' }, new Date());
    expect(result).toEqual({ ok: false, code: 'invalid_quantity' });
  });

  it('회차가 다르면 comp_quota를 공유하지 않는다(finding: comp_quota가 회차별로 격리되지 않던 것)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId: showtimeA, ticketTypeId } = await seedShow(db, 3, 100);
    // 같은 show, 같은 티켓타입(따라서 같은 comp_quota=3)을 공유하는 두 번째 회차를 만든다.
    const showtimeB = 'showtime-2';
    const startsAt = Math.floor(Date.now() / 1000) + 86400 * 20;
    await db.insert(showtimes).values({ id: showtimeB, showId: 'show-1', startsAt, salesCloseAt: startsAt - 86400 });

    // 회차 A에서 comp_quota(3)를 전부 소진한다.
    const a = await issueCompTickets({ showtimeId: showtimeA, ticketTypeId, quantity: 3, note: 'a' }, new Date());
    expect(a.ok).toBe(true);

    // 회차 B는 A의 comp_quota 소진과 무관하게 자기 몫(3)을 그대로 쓸 수 있어야 한다 —
    // 고친 코드는 comp 카운트 서브쿼리에 showtime_id 필터를 걸어 회차별로 격리한다.
    const b = await issueCompTickets({ showtimeId: showtimeB, ticketTypeId, quantity: 3, note: 'b' }, new Date());
    expect(b).toEqual(expect.objectContaining({ ok: true }));

    // 회차 A는 이미 소진했으니 추가 발급이 막혀야 한다.
    const aAgain = await issueCompTickets({ showtimeId: showtimeA, ticketTypeId, quantity: 1, note: 'a2' }, new Date());
    expect(aAgain).toEqual({ ok: false, code: 'sold_out' });
  });

  it('티켓타입이 다른 show의 것이면 ticket_type_mismatch', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { ticketTypeId } = await seedShow(db);
    // 다른 show에 속한 회차를 하나 더 만든다.
    await db.insert(shows).values({ id: 'show-2', slug: 's2', title: 't2', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
    const foreignShowtimeId = 'showtime-foreign';
    const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
    await db.insert(showtimes).values({ id: foreignShowtimeId, showId: 'show-2', startsAt, salesCloseAt: startsAt - 86400 });
    const result = await issueCompTickets({ showtimeId: foreignShowtimeId, ticketTypeId, quantity: 1, note: 'x' }, new Date());
    expect(result).toEqual({ ok: false, code: 'ticket_type_mismatch' });
  });
});

describe('revokeCompTicket', () => {
  it('초대권을 취소하면 void가 된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 1, note: 'x' }, new Date());
    if (!result.ok) throw new Error('setup failed');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, result.orderNo) });
    const ok = await revokeCompTicket(tickets[0].id);
    expect(ok).toBe(true);
    const updated = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[0].id) });
    expect(updated?.status).toBe('void');
  });
});
