import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));

import { getPublicShowBySlug, getShowOrderForManage, isShowtimeOnPublishedShow, listPublicShows } from './queries';
import { createShowOrder } from './service';

const NOW = new Date('2026-10-03T00:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

async function seed(db: ShowsTestDb, status: 'draft' | 'published' | 'cancelled' = 'published') {
  await db.insert(shows).values({
    id: 'show-1', slug: 'live-1', title: '라이브', presenterName: '스튜디오 놀', performers: '밴드', ageRating: '전체',
    runningMinutes: 90, venueName: '놀', venueAddress: '서울', description: '소개', coverImage: '/images/shows/x.webp', status,
  });
  await db.insert(showZones).values({ id: 'zone-1', showId: 'show-1', code: 'A', label: '전석', capacity: 3 });
  const startsAt = nowSec + 86400 * 10;
  await db.insert(showtimes).values([
    { id: 'st-1', showId: 'show-1', startsAt, salesCloseAt: startsAt - 3600 },
    { id: 'st-2', showId: 'show-1', startsAt: startsAt + 86400, salesCloseAt: startsAt + 86400 - 3600 },
  ]);
  await db.insert(showTicketTypes).values([
    { id: 'tt-1', showId: 'show-1', zoneId: 'zone-1', name: '일반', price: 20000, quota: null },
    { id: 'tt-vip', showId: 'show-1', zoneId: 'zone-1', name: '후원', price: 30000, quota: 1 },
  ]);
}

describe('getPublicShowBySlug', () => {
  beforeEach(async () => {
    testDb = (await createTestDb()).db;
  });

  it('draft·없는 slug는 null, published는 회차·티켓·잔여석을 돌려준다', async () => {
    await seed(testDb);
    expect(await getPublicShowBySlug('nope', NOW)).toBeNull();
    const show = await getPublicShowBySlug('live-1', NOW);
    expect(show?.title).toBe('라이브');
    expect(show?.ticketTypes.map((t) => t.name)).toEqual(['일반', '후원']);
    expect(show?.showtimes).toHaveLength(2);
    expect(show?.showtimes[0]).toMatchObject({ saleState: 'open', remaining: { 'tt-1': 3, 'tt-vip': 1 } });
  });

  it('draft 공연은 노출하지 않는다', async () => {
    await seed(testDb, 'draft');
    expect(await getPublicShowBySlug('live-1', NOW)).toBeNull();
    expect(await isShowtimeOnPublishedShow('st-1')).toBe(false);
  });

  it('보류(held) 주문도 잔여석에서 빠지고, 회차별로 격리된다', async () => {
    await seed(testDb);
    const r = await createShowOrder({ showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 2, buyerName: '홍길동', buyerContact: '010-1', buyerEmail: '' }, NOW);
    expect(r.ok).toBe(true);
    const show = await getPublicShowBySlug('live-1', NOW);
    expect(show?.showtimes[0].remaining).toEqual({ 'tt-1': 1, 'tt-vip': 1 });
    expect(show?.showtimes[1].remaining).toEqual({ 'tt-1': 3, 'tt-vip': 1 });
  });

  it('잔여석 화면 숫자와 판매 결과가 같은 기준이다 — 화면이 1석이라면 1매는 팔리고 2매는 막힌다', async () => {
    await seed(testDb);
    await createShowOrder({ showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 2, buyerName: '홍길동', buyerContact: '010-1', buyerEmail: '' }, NOW);
    const show = await getPublicShowBySlug('live-1', NOW);
    expect(show?.showtimes[0].remaining['tt-1']).toBe(1);
    expect(await createShowOrder({ showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 2, buyerName: 'a', buyerContact: '010', buyerEmail: '' }, NOW)).toEqual({ ok: false, code: 'sold_out' });
    expect((await createShowOrder({ showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 1, buyerName: 'a', buyerContact: '010', buyerEmail: '' }, NOW)).ok).toBe(true);
  });

  it('판매마감이 지난 회차는 closed, 취소된 공연은 모든 회차가 cancelled', async () => {
    await seed(testDb);
    const late = new Date((nowSec + 86400 * 10 - 1800) * 1000);
    const closed = await getPublicShowBySlug('live-1', late);
    expect(closed?.showtimes[0].saleState).toBe('closed');
    await testDb.run(sql`UPDATE shows SET status = 'cancelled'`);
    const cancelled = await getPublicShowBySlug('live-1', NOW);
    expect(cancelled?.cancelled).toBe(true);
    expect(cancelled?.showtimes.every((s) => s.saleState === 'cancelled')).toBe(true);
  });
});

describe('getShowOrderForManage', () => {
  beforeEach(async () => {
    testDb = (await createTestDb()).db;
  });

  it('토큰이 맞을 때만 주문을 돌려주고, 틀리면 null(존재 여부 노출 방지)', async () => {
    await seed(testDb);
    const r = await createShowOrder({ showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 1, buyerName: '홍길동', buyerContact: '010-1', buyerEmail: '' }, NOW);
    if (!r.ok) throw new Error('seed failed');
    const order = await testDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, r.orderNo) });
    expect(await getShowOrderForManage(r.orderNo, 'wrong-token', NOW)).toBeNull();
    expect(await getShowOrderForManage('TKT-20260101-AAAAAAAA', order!.manageToken, NOW)).toBeNull();
    const view = await getShowOrderForManage(r.orderNo, order!.manageToken, NOW);
    expect(view).toMatchObject({ orderNo: r.orderNo, showTitle: '라이브', buyerName: '홍길동', totalAmount: 20000 });
    // 아직 결제 전(held) — 환불 가능 금액은 없다.
    expect(view?.tickets[0].refundAmountNow).toBeNull();
  });

  it('발권된 티켓은 취소환불표 비율로 환불 예상액을 계산하고, 입장 처리된 티켓은 null', async () => {
    await seed(testDb);
    const r = await createShowOrder({ showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 2, buyerName: '홍길동', buyerContact: '010-1', buyerEmail: '' }, NOW);
    if (!r.ok) throw new Error('seed failed');
    await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
    await testDb.run(sql`UPDATE show_tickets SET status = 'issued' WHERE order_no = ${r.orderNo}`);
    const tickets = await testDb.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, r.orderNo) });
    await testDb.run(sql`UPDATE show_tickets SET checked_in_at = 1 WHERE id = ${tickets[0].id}`);
    const order = await testDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, r.orderNo) });
    const view = await getShowOrderForManage(r.orderNo, order!.manageToken, NOW);
    // 공연 10일 전 → 100%.
    expect(view?.refundPctNow).toBe(100);
    const byId = Object.fromEntries(view!.tickets.map((t) => [t.id, t]));
    expect(byId[tickets[0].id].refundAmountNow).toBeNull();
    expect(byId[tickets[1].id].refundAmountNow).toBe(20000);
  });
});

describe('listPublicShows', () => {
  beforeEach(async () => {
    testDb = (await createTestDb()).db;
  });

  it('draft는 목록에 없고, 앞날 회차가 있는 공개 공연은 upcoming에 들어간다', async () => {
    await seed(testDb);
    const list = await listPublicShows(NOW);
    expect(list.upcoming.map((s) => s.slug)).toEqual(['live-1']);
    expect(list.past).toEqual([]);

    testDb = (await createTestDb()).db;
    await seed(testDb, 'draft');
    expect(await listPublicShows(NOW)).toEqual({ upcoming: [], past: [] });
  });

  it('취소된 공연과 모든 회차가 지난 공연은 past로 간다', async () => {
    await seed(testDb, 'cancelled');
    expect((await listPublicShows(NOW)).past.map((s) => s.slug)).toEqual(['live-1']);

    testDb = (await createTestDb()).db;
    await seed(testDb);
    const later = new Date(NOW.getTime() + 60 * 86400 * 1000);
    const list = await listPublicShows(later);
    expect(list.upcoming).toEqual([]);
    expect(list.past.map((s) => s.slug)).toEqual(['live-1']);
  });
});
