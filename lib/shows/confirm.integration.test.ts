import { sql } from 'drizzle-orm';

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

  it('토스 승인 직전 다른 실행이 주문을 붙잡으면(orders 전이 0행) 티켓을 issued로 바꾸지 않는다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    // confirmPayment 응답 직전(=우리 batch를 쏘기 전) 다른 실행(autoCancelShowApproval)이
    // 이 주문을 먼저 붙잡아 auto_cancel_pending으로 바꿨다고 가정 — orders UPDATE는 0행이
    // 되지만, 그 순간 show_tickets는 아직 'held'라서 가드 없이는 그대로 issued로 넘어간다.
    toss.setInterceptHook(async () => {
      await db.run(sql`UPDATE orders SET status = 'auto_cancel_pending' WHERE order_no = ${created.orderNo}`);
    });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('sold_out');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t: any) => t.status === 'held')).toBe(true);
  });

  it('동시 확정 경합으로 payment_key가 이미 기록돼 있으면 예외 대신 재생으로 처리된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    // 이미 다른 실행(경합에서 이긴 쪽)이 같은 paymentKey로 결제 기록을 남겨 뒀다고 가정한다 —
    // payments.payment_key는 UNIQUE라 이 확정 시도의 INSERT는 제약 위반으로 실패해야 한다.
    await db.run(sql`
      INSERT INTO payments (id, order_id, payment_key) VALUES ('existing-payment', ${order!.id}, 'pk1')
    `);
    const toss = createFakeToss();
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('already_confirmed');
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

describe('assignEntryNumbers 원자성', () => {
  it('같은 회차의 서로 다른 두 주문을 확정해도 entry_number가 겹치지 않는다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    // MAX(entry_number)를 미리 한 번 읽어 두는 예전 구현이라면, 두 주문이 이 값을 함께
    // 읽고 둘 다 같은 다음 번호를 계산할 수 있었다 — 지금은 UPDATE의 서브쿼리가 실행(커밋)
    // 시점의 값을 다시 읽으므로, 순서대로 처리하는 두 주문도 번호가 절대 겹치지 않는다.
    const first = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'a', buyerContact: '010' }, new Date());
    const second = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'b', buyerContact: '010' }, new Date());
    if (!first.ok || !second.ok) throw new Error('setup failed');

    const toss = createFakeToss();
    const firstOutcome = await confirmShowOrder({ orderNo: first.orderNo, paymentKey: 'pk-a', amount: 20000 }, { trustedByWebhook: false }, toss);
    const secondOutcome = await confirmShowOrder({ orderNo: second.orderNo, paymentKey: 'pk-b', amount: 20000 }, { trustedByWebhook: false }, toss);
    expect(firstOutcome.status).toBe('confirmed');
    expect(secondOutcome.status).toBe('confirmed');

    const firstTickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, first.orderNo) });
    const secondTickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, second.orderNo) });
    const firstNumbers = firstTickets.map((t: any) => t.entryNumber).sort();
    const secondNumbers = secondTickets.map((t: any) => t.entryNumber).sort();

    expect(firstNumbers).toEqual([1, 2]);
    expect(secondNumbers).toEqual([3, 4]);
    // 두 주문의 번호 집합이 겹치지 않는다는 것을 명시적으로도 확인한다.
    expect(firstNumbers.some((n: number) => secondNumbers.includes(n))).toBe(false);
  });
});
