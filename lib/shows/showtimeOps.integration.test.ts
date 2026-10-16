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

describe('cancelShowtime — 마지막 회차가 취소되면 공연도 취소', () => {
  async function seedShowWithShowtimes(db: ShowsTestDb, status: 'draft' | 'published', extra: Array<{ id: string; status: 'scheduled' | 'cancelled' | 'ended' }>) {
    await db.insert(shows).values({ id: 'show-1', slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status });
    const startsAt = Math.floor(Date.now() / 1000) + 86400 * 15;
    await db.insert(showtimes).values([{ id: 'st-main', showId: 'show-1', startsAt, salesCloseAt: startsAt - 86400 }, ...extra.map((e) => ({ id: e.id, showId: 'show-1', startsAt, salesCloseAt: startsAt - 86400, status: e.status }))]);
  }
  const showStatus = async (db: ShowsTestDb) => (await db.query.shows.findFirst({ where: (s, { eq }) => eq(s.id, 'show-1') }))?.status;

  it('공개 공연의 마지막 예정 회차를 취소하면 공연이 cancelled가 된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    await seedShowWithShowtimes(db, 'published', [{ id: 'st-old', status: 'cancelled' }]);
    await cancelShowtime('st-main', new Date(), createFakeToss());
    expect(await showStatus(db)).toBe('cancelled');
  });

  it('다른 회차가 예정이거나 이미 치른(ended) 회차면 공연은 그대로 공개다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    await seedShowWithShowtimes(db, 'published', [{ id: 'st-2', status: 'scheduled' }]);
    await cancelShowtime('st-main', new Date(), createFakeToss());
    expect(await showStatus(db)).toBe('published');
    await cancelShowtime('st-2', new Date(), createFakeToss());
    expect(await showStatus(db)).toBe('cancelled');

    const second = await createTestDb();
    mockDb = second.db;
    await seedShowWithShowtimes(second.db, 'published', [{ id: 'st-ended', status: 'ended' }]);
    await cancelShowtime('st-main', new Date(), createFakeToss());
    expect(await showStatus(second.db)).toBe('published');
  });

  it('초안 공연은 회차를 모두 취소해도 초안으로 남는다(취소 공연으로 공개되지 않게)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    await seedShowWithShowtimes(db, 'draft', []);
    await cancelShowtime('st-main', new Date(), createFakeToss());
    expect(await showStatus(db)).toBe('draft');
  });
});

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

describe('cancelShowtime — 중간 실패와 이어서 처리', () => {
  async function seedTwoPaidOrders(db: ShowsTestDb) {
    const showId = 'show-1';
    await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
    await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
    const showtimeId = 'showtime-1';
    const startsAt = Math.floor(Date.now() / 1000) + 86400 * 15;
    await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
    await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
    const toss = createFakeToss();
    const orderNos: string[] = [];
    for (const pk of ['pk-a', 'pk-b', 'pk-c']) {
      const created = await createShowOrder({ showtimeId, ticketTypeId: 'type-1', quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
      if (!created.ok) throw new Error('setup failed');
      await confirmShowOrder({ orderNo: created.orderNo, paymentKey: pk, amount: 10000 }, { trustedByWebhook: false }, toss);
      orderNos.push(created.orderNo);
    }
    return { showtimeId, orderNos, toss };
  }

  it('한 주문의 batch가 던져도 나머지 주문은 환불되고, 다시 돌리면 그 주문이 토스 재생으로 기록된다(refunds 1행)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, orderNos, toss } = await seedTwoPaidOrders(db);

    // 두 번째 주문의 정산 batch(INSERT refunds 포함)만 한 번 실패시킨다 — 토스 취소는 이미 성공한 뒤다.
    // 정산 batch는 주문마다 한 번 돈다(입금 대기 주문이 없으므로 다른 batch 호출은 없다) — 두 번째 호출만 실패시킨다.
    const realBatch = db.batch.bind(db);
    let calls = 0;
    const spy = jest.spyOn(db, 'batch').mockImplementation(async (statements: unknown) => {
      calls += 1;
      if (calls === 2) throw new Error('simulated db failure');
      return realBatch(statements as never);
    });

    const first = await cancelShowtime(showtimeId, new Date(), toss);
    spy.mockRestore();
    expect(first.refundedOrderNos).toHaveLength(2);
    expect(first.failedOrders).toHaveLength(1);
    const failedOrderNo = first.failedOrders[0];
    const failedPk = ['pk-a', 'pk-b', 'pk-c'][orderNos.indexOf(failedOrderNo)];
    expect(first.perOrder[first.refundedOrderNos[0]]).toMatchObject({ refunded: 10000, final: 'refunded' });
    // 회차는 취소됐고 실패한 주문은 토스에서만 취소된 상태다.
    expect((await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, showtimeId) }))?.status).toBe('cancelled');
    expect((await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, failedOrderNo) }))?.status).toBe('paid');
    expect(toss._payments.get(failedPk)?.cancels).toHaveLength(1);

    const second = await cancelShowtime(showtimeId, new Date(), toss);
    expect(second.refundedOrderNos).toEqual([failedOrderNo]);
    expect(second.failedOrders).toEqual([]);
    expect((await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, failedOrderNo) }))?.status).toBe('refunded');
    // 토스는 같은 멱등키를 재생했으므로 그 결제의 취소는 여전히 한 번뿐이고 refunds도 주문당 한 줄이다.
    expect(toss._payments.get(failedPk)?.cancels).toHaveLength(1);
    const refundRows = await db.query.refunds.findMany({ where: (r, { eq }) => eq(r.status, 'done') });
    expect(refundRows).toHaveLength(3);
  });

  it('주문별 결과에 실제 환불액이 실린다 — 체크인 티켓이 섞이면 부분, 전부 체크인이면 0·checked_in_only', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, orderNo, toss } = await seedPaidOrder(db, 2);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    await db.run(sql`UPDATE show_tickets SET status = 'issued', checked_in_at = unixepoch() WHERE id = ${tickets[0].id}`);
    await db.run(sql`UPDATE show_tickets SET status = 'issued' WHERE id = ${tickets[1].id}`);

    const r = await cancelShowtime(showtimeId, new Date(), toss);
    expect(r.perOrder[orderNo]).toMatchObject({ refunded: 10000, checkedInValue: 10000, final: 'partially_refunded', skipped: null });

    const all = await createTestDb();
    mockDb = all.db;
    const paid = await seedPaidOrder(all.db, 1);
    await all.db.run(sql`UPDATE show_tickets SET status = 'issued', checked_in_at = unixepoch() WHERE order_no = ${paid.orderNo}`);
    const r2 = await cancelShowtime(paid.showtimeId, new Date(), paid.toss);
    expect(r2.perOrder[paid.orderNo]).toMatchObject({ refunded: 0, skipped: 'checked_in_only', final: 'unchanged' });
    expect(r2.refundedOrderNos).toEqual([]);
  });
});
