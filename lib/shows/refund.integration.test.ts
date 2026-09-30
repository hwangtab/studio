import { sql } from 'drizzle-orm';

import { createTestDb } from '../../tests/helpers/showsDb';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';
import { confirmShowOrder } from './confirm';
import { refundShowTickets, syncShowCancelsFromToss } from './refund';

async function seedAndPay(db: any, quantity: number) {
  const showId = 'show-1';
  await db.insert(shows).values({
    id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a',
    ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published',
  });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 20; // 20일 뒤 = 100% 환불 구간
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  const created = await createShowOrder(
    { showtimeId, ticketTypeId: 'type-1', quantity, buyerName: 'a', buyerContact: '010' },
    new Date(),
  );
  if (!created.ok) throw new Error('setup failed');
  const toss = createFakeToss();
  await confirmShowOrder(
    { orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 * quantity },
    { trustedByWebhook: false },
    toss,
  );
  return { orderNo: created.orderNo, toss, showtimeId };
}

describe('refundShowTickets', () => {
  it('20일 전 취소는 100% 환불되고 주문 상태가 partially_refunded로 갱신된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 2);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('refunded');
    if (outcome.status === 'refunded') {
      expect(outcome.amount).toBe(10000);
      expect(outcome.orderStatus).toBe('partially_refunded');
    }
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('partially_refunded');
    const refundedTicket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(refundedTicket?.status).toBe('refunded');
    const untouchedTicket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[1].id) });
    expect(untouchedTicket?.status).toBe('issued');
  });

  it('주문의 모든 티켓을 환불하면 주문 상태가 refunded로 갱신된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('refunded');
    if (outcome.status === 'refunded') expect(outcome.orderStatus).toBe('refunded');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
  });

  it('이미 체크인된 티켓은 환불 대상에서 제외된다(거부)', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    await db.run(sql`update show_tickets set checked_in_at = unixepoch() where id = ${tickets[0].id}`);
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('checked_in');
    const ticket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('issued'); // 체크인된 상태 그대로, 'refunding'으로 넘어가지 않는다
  });

  it('공연 시작 이후(체크인 없이도)는 환불 요율이 0%라 거부된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    // 공연 시작 이후 시점을 공지 시점으로 넘긴다.
    const afterShowStart = new Date(Date.now() + 86400 * 21 * 1000);
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: afterShowStart }, toss);
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('after_showtime_start');
  });

  it('토스 취소가 NETWORK_ERROR면 선점(refunding)을 유지하고 toss_unknown을 반환한다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    toss.injectFault('cancel:tkt-refund:' + orderNo + ':10000', { code: 'NETWORK_ERROR' });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('toss_unknown');
    const ticket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('refunding');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('paid'); // 되돌리지도, 확정하지도 않는다
  });

  it('토스가 확정 거절하면 선점을 되돌리고 실패 환불 행을 남긴다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    toss.injectFault('cancel:tkt-refund:' + orderNo + ':10000', { code: 'ALREADY_CANCELED_PAYMENT', message: '이미 취소된 결제' });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('toss_failed');
    const ticket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('issued'); // 선점이 되돌아갔다
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('paid');
    const failedRefund = await db.query.refunds.findFirst({ where: (r: any, { eq }: any) => eq(r.status, 'failed') });
    expect(failedRefund?.amount).toBe(10000);
  });
});

describe('syncShowCancelsFromToss', () => {
  it('전액 취소 이벤트를 받으면 주문과 티켓이 모두 무효화된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo } = await seedAndPay(db, 1);
    await syncShowCancelsFromToss(orderNo, {
      paymentKey: 'pk1', orderId: orderNo, status: 'CANCELED', totalAmount: 10000,
      cancels: [{ transactionKey: 'tx-1', cancelAmount: 10000, cancelReason: '[#autocancel:x:1] 자동취소' }],
    });
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    expect(tickets.every((t: any) => t.status === 'refunded' || t.status === 'void')).toBe(true);
  });

  it('부분 취소 이벤트를 받으면 주문이 partially_refunded로 갱신되고 누락됐던 환불 기록이 채워진다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo } = await seedAndPay(db, 2); // 총 20000원
    await syncShowCancelsFromToss(orderNo, {
      paymentKey: 'pk1', orderId: orderNo, status: 'PARTIAL_CANCELED', totalAmount: 20000,
      cancels: [{ transactionKey: 'tx-1', cancelAmount: 10000, cancelReason: '콘솔에서 직접 취소' }],
    });
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('partially_refunded');
    const doneRefunds = await db.query.refunds.findMany({ where: (r: any, { eq }: any) => eq(r.status, 'done') });
    expect(doneRefunds.reduce((sum: number, r: any) => sum + r.amount, 0)).toBe(10000);
  });

  it('같은 취소 이벤트가 두 번 도착해도 refunds 행의 합계는 한 번만큼만 남는다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo } = await seedAndPay(db, 1);
    const payload = {
      paymentKey: 'pk1', orderId: orderNo, status: 'CANCELED' as const, totalAmount: 10000,
      cancels: [{ transactionKey: 'tx-1', cancelAmount: 10000, cancelReason: '콘솔에서 직접 취소' }],
    };
    await syncShowCancelsFromToss(orderNo, payload);
    await syncShowCancelsFromToss(orderNo, payload);
    const doneRefunds = await db.query.refunds.findMany({ where: (r: any, { eq }: any) => eq(r.status, 'done') });
    expect(doneRefunds.reduce((sum: number, r: any) => sum + r.amount, 0)).toBe(10000);
  });

  it('NETWORK_ERROR로 refunding에 머물던 티켓을 웹훅 대사가 refunded로 확정한다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    toss.injectFault('cancel:tkt-refund:' + orderNo + ':10000', { code: 'NETWORK_ERROR' });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('toss_unknown');

    // 웹훅이 뒤늦게 "사실은 취소됐다"를 들고 온다.
    await syncShowCancelsFromToss(orderNo, {
      paymentKey: 'pk1', orderId: orderNo, status: 'CANCELED', totalAmount: 10000,
      cancels: [{ transactionKey: 'tx-late', cancelAmount: 10000, cancelReason: `[#tkt-refund:${orderNo}:10000] 공연 티켓 환불` }],
    });
    const ticket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('refunded');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
  });
});
