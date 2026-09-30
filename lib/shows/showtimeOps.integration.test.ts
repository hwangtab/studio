import { sql } from 'drizzle-orm';
import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';
import { createFakeToss } from '../../tests/fakes/fakeToss';

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

import { createShowOrder } from './service';
import { confirmShowOrder } from './confirm';
import { refundShowTickets } from './refund';
import { cancelShowtime, changeShowtime } from './showtimeOps';

async function seedPaidOrder(db: ShowsTestDb, quantity = 1) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 15;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  const created = await createShowOrder({ showtimeId, ticketTypeId: 'type-1', quantity, buyerName: 'a', buyerContact: '010' }, new Date());
  if (!created.ok) throw new Error('setup failed');
  const toss = createFakeToss();
  await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 * quantity }, { trustedByWebhook: false }, toss);
  return { showtimeId, orderNo: created.orderNo, toss };
}

describe('cancelShowtime', () => {
  it('회차를 취소하면 모든 유효 주문이 전액 환불되고 회차가 cancelled가 된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, orderNo, toss } = await seedPaidOrder(db);
    const result = await cancelShowtime(showtimeId, new Date(), toss);
    expect(result.refundedOrders).toBe(1);
    expect(result.failedOrders).toEqual([]);
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
    const showtime = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, showtimeId) });
    expect(showtime?.status).toBe('cancelled');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    expect(tickets.every((t) => t.status === 'void')).toBe(true);
  });

  it('이미 refundShowTickets로 일부 환불된 주문은 잔액만 환불한다(이중 환불 금지)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, orderNo, toss } = await seedPaidOrder(db, 2);

    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    expect(tickets).toHaveLength(2);

    // 회차 시작 훨씬 전이므로 환불률 100% — 티켓 1장(10,000원)만 먼저 환불한다.
    const partial = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    if (partial.status !== 'refunded') throw new Error(`expected refunded, got ${JSON.stringify(partial)}`);
    expect(partial.amount).toBe(10000);
    expect(partial.orderStatus).toBe('partially_refunded');

    const result = await cancelShowtime(showtimeId, new Date(), toss);
    expect(result.refundedOrders).toBe(1);
    expect(result.failedOrders).toEqual([]);

    const tossPayment = toss._payments.get('pk1');
    const totalCancelled = (tossPayment?.cancels ?? []).reduce((sum: number, c) => sum + c.cancelAmount, 0);
    // 총 결제액은 20,000원 — 이중 환불이었다면 30,000원(10,000 + 20,000)이 취소됐을 것이다.
    expect(totalCancelled).toBe(20000);

    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');

    const refundRows = await db.query.refunds.findMany({
      where: (r, { eq }) => eq(r.status, 'done'),
    });
    const totalRecorded = refundRows.reduce((sum: number, r) => sum + r.amount, 0);
    expect(totalRecorded).toBe(20000);
  });

  it('체크인된 티켓은 무효화하지 않고 그대로 둔다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, orderNo, toss } = await seedPaidOrder(db, 2);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    await db.run(sql`UPDATE show_tickets SET status = 'issued', checked_in_at = unixepoch() WHERE id = ${tickets[0].id}`);
    await db.run(sql`UPDATE show_tickets SET status = 'issued' WHERE id = ${tickets[1].id}`);

    await cancelShowtime(showtimeId, new Date(), toss);

    const after = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    const checkedIn = after.find((t) => t.id === tickets[0].id);
    const notCheckedIn = after.find((t) => t.id === tickets[1].id);
    expect(checkedIn?.status).toBe('issued');
    expect(notCheckedIn?.status).toBe('void');

    // finding(Important) 회귀 — 이 함수의 자기 주석("체크인된 티켓은 건드리지 않는다")이
    // 환불 금액 계산에도 적용돼야 한다. 고치기 전에는 order.totalAmount(20,000, 체크인된
    // 티켓 몫 포함) 전체를 잔액으로 계산해, 이미 입장한 관객의 표 값(10,000)까지 돌려주는
    // 모순이 있었다 — 여기서는 체크인 안 된 티켓 몫(10,000)만 취소돼야 한다.
    const tossPayment = toss._payments.get('pk1');
    const totalCancelled = (tossPayment?.cancels ?? []).reduce((sum: number, c) => sum + c.cancelAmount, 0);
    expect(totalCancelled).toBe(10000);

    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    // 체크인된 티켓 몫(10,000)은 여전히 "안 돌려준 돈"으로 남으므로 전액 환불이 아니라
    // 부분 환불로 마감돼야 한다.
    expect(order?.status).toBe('partially_refunded');
  });

  it('체크인된 티켓만 있는 주문은 환불할 잔액이 없어 건드리지 않는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, orderNo, toss } = await seedPaidOrder(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    await db.run(sql`UPDATE show_tickets SET status = 'issued', checked_in_at = unixepoch() WHERE id = ${tickets[0].id}`);

    const result = await cancelShowtime(showtimeId, new Date(), toss);
    expect(result.refundedOrders).toBe(0);
    expect(result.failedOrders).toEqual([]);

    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('paid'); // 손대지 않는다
    const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('issued');
  });
});

describe('changeShowtime', () => {
  it('회차 시각을 바꾸면 previous_starts_at이 보존되고 판매마감이 비례 재계산된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId } = await seedPaidOrder(db);
    const before = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, showtimeId) });
    const newStartsAt = new Date((before!.startsAt + 86400 * 5) * 1000);
    await changeShowtime(showtimeId, newStartsAt, new Date());
    const after = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, showtimeId) });
    expect(after?.previousStartsAt).toBe(before!.startsAt);
    expect(after?.startsAt).toBe(Math.floor(newStartsAt.getTime() / 1000));
  });
});
