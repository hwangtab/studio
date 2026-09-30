import { createTestDb } from '../../tests/helpers/showsDb';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';
import { confirmShowOrder, autoCancelShowApproval } from './confirm';

async function seedShow(db: any) {
  const showId = 'show-1';
  await db.insert(shows).values({
    id: showId,
    slug: 's1',
    title: 't',
    presenterName: 'p',
    performers: 'a',
    ageRating: '전체',
    runningMinutes: 60,
    venueName: 'v',
    venueAddress: 'addr',
    description: 'd',
    status: 'published',
  });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  return { showtimeId, ticketTypeId: 'type-1' };
}

describe('confirmShowOrder', () => {
  it('정상 결제를 확인하면 티켓이 issued로 바뀌고 entry_number가 배정된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'a', buyerContact: '010' }, new Date());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const toss = createFakeToss();
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 20000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('confirmed');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t: any) => t.status === 'issued')).toBe(true);
    expect(tickets.map((t: any) => t.entryNumber).sort()).toEqual([1, 2]);
  });

  it('이미 확인된 주문을 다시 확인하면 replay로 처리된다(중복 확정 없음)', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    const second = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    expect(second.status).toBe('already_confirmed');
  });

  it('토스 확정이 NETWORK_ERROR면 실패로 낙인찍지 않는다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault(`confirm:pk1`, { code: 'NETWORK_ERROR' });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('error');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('pending'); // failed로 바뀌지 않아야 한다
  });

  it('확정 거절 코드면 failed로 기록된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault(`confirm:pk1`, { code: 'REJECT_CARD_COMPANY' });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('declined');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('failed');
  });
});

describe('autoCancelShowApproval', () => {
  it('만료된 pending 주문을 소유권 CAS로 취소하면 결제 취소가 기록된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    // 결제 승인 API가 approved로 응답했다고 가정(오토캔슬 대상은 approved-but-not-recorded 상태)
    await toss.confirmPayment({ paymentKey: 'pk1', orderId: created.orderNo, amount: 10000 });
    const outcome = await autoCancelShowApproval(created.orderNo, toss);
    expect(outcome.status).toBe('cancelled');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('refunded');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t: any) => t.status === 'void')).toBe(true);
  });
});
