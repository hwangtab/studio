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
      // 가격 10000 × 2매 = 20000(VAT 포함) → splitInclusiveAmount(20000) = { itemAmount: 18182, vatAmount: 1818 }.
      expect(order?.itemAmount).toBe(18182);
      expect(order?.vatAmount).toBe(1818);
      expect(order?.totalAmount).toBe(20000);
      const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, result.orderNo) });
      expect(tickets.length).toBe(2);
      expect(tickets.every((t) => t.status === 'held')).toBe(true);
    }
  });

  it('buyerEmail을 주면 orders.customer_email에 저장하고, 안 주면 빈 문자열이다', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const withEmail = await createShowOrder(
      { showtimeId, ticketTypeId, quantity: 1, buyerName: '홍길동', buyerContact: '010-0000-0000', buyerEmail: ' a@b.co ' },
      new Date()
    );
    const without = await createShowOrder(
      { showtimeId, ticketTypeId, quantity: 1, buyerName: '김철수', buyerContact: '010-0000-0001' },
      new Date()
    );
    expect(withEmail.ok && without.ok).toBe(true);
    if (withEmail.ok && without.ok) {
      const a = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, withEmail.orderNo) });
      const b = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, without.orderNo) });
      expect(a?.customerEmail).toBe('a@b.co');
      expect(b?.customerEmail).toBe('');
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

  // finding(Important) 회귀 — 수량 검증이 SQL을 태우기 전에 걸려야 한다. 고치기 전에는
  // 0·음수·비정수·과다 수량이 그대로 SQL까지 내려가(0은 "티켓 없는 결제 주문"을,
  // 음수는 for 루프가 그냥 건너뛰어 "정원은 깎였는데 티켓은 없는" 주문을 만들 수 있었다).
  it.each([0, -1, 1.5, 11])('수량 %s는 SQL을 타지 않고 invalid_quantity로 거부된다', async (quantity) => {
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity, buyerName: 'a', buyerContact: '010' }, new Date());
    expect(result).toEqual({ ok: false, code: 'invalid_quantity' });
    const orders = await db.query.orders.findMany();
    expect(orders.length).toBe(0); // 주문 자체가 생기지 않아야 한다
  });

  it('수량 1~10(SHOW_MAX_PER_ORDER_CAP)은 정상 통과한다', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db, { capacity: 20 });
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 10, buyerName: 'a', buyerContact: '010' }, new Date());
    expect(result.ok).toBe(true);
  });

  // finding(Important) 회귀 — 티켓타입이 실제로 그 회차가 속한 show의 것인지 확인해야 한다.
  // 고치기 전에는 다른 show의 ticketTypeId를 그대로 실어 보내도 통과해, 엉뚱한 공연의
  // 표를 발권할 수 있었다(정원·가격도 그 다른 show 기준으로 잘못 적용된다).
  it('티켓타입이 다른 show의 것이면 ticket_type_mismatch로 거부된다', async () => {
    const { showtimeId } = await seedShow(db);
    // 별개의 show + 티켓타입을 하나 더 만든다.
    await db.insert(shows).values({ id: 'show-2', slug: 's2', title: 't2', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
    await db.insert(showZones).values({ id: 'zone-2', showId: 'show-2', code: 'A', label: 'A', capacity: 10 });
    await db.insert(showTicketTypes).values({ id: 'type-foreign', showId: 'show-2', zoneId: 'zone-2', name: '외부', price: 5000 });

    const result = await createShowOrder(
      { showtimeId, ticketTypeId: 'type-foreign', quantity: 1, buyerName: 'a', buyerContact: '010' },
      new Date(),
    );
    expect(result).toEqual({ ok: false, code: 'ticket_type_mismatch' });
    const orders = await db.query.orders.findMany();
    expect(orders.length).toBe(0);
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

describe('showOrders relation metadata', () => {
  it('showOrders.tickets 관계 쿼리가 성공한다', async () => {
    const t = await createTestDb();
    const db = t.db;
    testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'test', buyerContact: '010' }, new Date());
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Verify that db.query.showOrders.findFirst with { with: { tickets: true } } does not throw
      const order = await db.query.showOrders.findFirst({
        where: (so, { eq }) => eq(so.orderNo, result.orderNo),
        with: { tickets: true },
      });
      expect(order).toBeDefined();
      expect(order?.tickets).toBeDefined();
      expect(order?.tickets?.length).toBe(2);
    }
  });
});
