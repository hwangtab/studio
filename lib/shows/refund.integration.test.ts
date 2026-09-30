import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

import { createShowOrder } from './service';
import { confirmShowOrder } from './confirm';
import { refundShowTickets, syncShowCancelsFromToss } from './refund';

async function seedAndPay(db: ShowsTestDb, quantity: number) {
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
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 2);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('refunded');
    if (outcome.status === 'refunded') {
      expect(outcome.amount).toBe(10000);
      expect(outcome.orderStatus).toBe('partially_refunded');
    }
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('partially_refunded');
    const refundedTicket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[0].id) });
    expect(refundedTicket?.status).toBe('refunded');
    const untouchedTicket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[1].id) });
    expect(untouchedTicket?.status).toBe('issued');
  });

  it('주문의 모든 티켓을 환불하면 주문 상태가 refunded로 갱신된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('refunded');
    if (outcome.status === 'refunded') expect(outcome.orderStatus).toBe('refunded');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
  });

  it('이미 체크인된 티켓은 환불 대상에서 제외된다(거부)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    await db.run(sql`update show_tickets set checked_in_at = unixepoch() where id = ${tickets[0].id}`);
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('checked_in');
    const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('issued'); // 체크인된 상태 그대로, 'refunding'으로 넘어가지 않는다
  });

  it('공연 시작 이후(체크인 없이도)는 환불 요율이 0%라 거부된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    // 공연 시작 이후 시점을 공지 시점으로 넘긴다.
    const afterShowStart = new Date(Date.now() + 86400 * 21 * 1000);
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: afterShowStart }, toss);
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('after_showtime_start');
  });

  it('토스 취소가 NETWORK_ERROR면 선점(refunding)을 유지하고 toss_unknown을 반환한다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    // 멱등 키는 finding #2 수정 후 (주문번호, 금액)이 아니라 (주문번호, 정렬된 티켓 id들)로
    // 만들어진다 — 장애 주입 키도 실제 코드가 만드는 키와 같은 형태로 맞춘다.
    toss.injectFault(`cancel:tkt-refund:${orderNo}:${tickets[0].id}`, { code: 'NETWORK_ERROR' });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('toss_unknown');
    const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('refunding');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('paid'); // 되돌리지도, 확정하지도 않는다
  });

  // finding #2(Critical) 회귀 — 같은 주문의 단가가 같은 두 티켓을 서로 다른 시점에 각각
  // 환불하면, 예전 멱등 키(주문번호+금액)는 두 호출 모두 같은 키(`tkt-refund:<orderNo>:10000`)를
  // 만들어 토스가 두 번째 호출을 replay로 처리했다 — 실제로는 10,000원만 취소되는데 우리
  // 기록은 두 장 다 환불(20,000원)로 남는 과소 환불이었다. 티켓 id를 키에 넣은 뒤에는 두
  // 호출이 서로 다른 키를 만들어 fake의 cancels[]가 실제로 두 번 늘어나야 한다.
  it('같은 주문의 단가가 같은 두 티켓을 각각 환불하면 토스가 매번 새 금액을 취소한다(과소 환불 방지)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 2); // 10,000원 티켓 두 장, 총 20,000원
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    expect(tickets).toHaveLength(2);

    const first = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(first.status).toBe('refunded');
    if (first.status === 'refunded') expect(first.amount).toBe(10000);

    const second = await refundShowTickets({ orderNo, ticketIds: [tickets[1].id], noticeAt: new Date() }, toss);
    expect(second.status).toBe('refunded');
    if (second.status === 'refunded') expect(second.amount).toBe(10000);

    // 핵심 — 토스 쪽에 실제로 두 번의 별도 취소가 나갔는지(replay가 아닌지)를 fake의
    // 호출 추적(cancels[])으로 직접 확인한다. 고치기 전에는 두 번째 호출이 첫 번째 응답을
    // 재생해 cancels가 1건에 머물렀다.
    const tossPayment = toss._payments.get('pk1');
    expect(tossPayment?.cancels?.length).toBe(2);
    const totalCancelledAtToss = (tossPayment?.cancels ?? []).reduce((sum: number, c) => sum + c.cancelAmount, 0);
    expect(totalCancelledAtToss).toBe(20000); // 10,000이 아니라 실제로 20,000이 나갔다

    // 우리 기록도 실제로 나간 금액과 일치해야 한다(과대 계상 없음, 과소 계상 없음).
    const doneRefunds = await db.query.refunds.findMany({ where: (r, { eq }) => eq(r.status, 'done') });
    const totalRecorded = doneRefunds.reduce((sum: number, r) => sum + r.amount, 0);
    expect(totalRecorded).toBe(20000);

    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded'); // 두 장 다 환불됐으니 전액 환불
  });

  it('토스가 확정 거절하면 선점을 되돌리고 실패 환불 행을 남긴다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    toss.injectFault(`cancel:tkt-refund:${orderNo}:${tickets[0].id}`, { code: 'ALREADY_CANCELED_PAYMENT', message: '이미 취소된 결제' });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.reason).toBe('toss_failed');
    const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('issued'); // 선점이 되돌아갔다
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('paid');
    const failedRefund = await db.query.refunds.findFirst({ where: (r, { eq }) => eq(r.status, 'failed') });
    expect(failedRefund?.amount).toBe(10000);
  });
});

describe('syncShowCancelsFromToss', () => {
  it('전액 취소 이벤트를 받으면 주문과 티켓이 모두 무효화된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo } = await seedAndPay(db, 1);
    await syncShowCancelsFromToss(orderNo, {
      paymentKey: 'pk1', orderId: orderNo, status: 'CANCELED', totalAmount: 10000,
      cancels: [{ transactionKey: 'tx-1', cancelAmount: 10000, cancelReason: '[#autocancel:x:1] 자동취소' }],
    });
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    expect(tickets.every((t) => t.status === 'refunded' || t.status === 'void')).toBe(true);
  });

  it('부분 취소 이벤트를 받으면 주문이 partially_refunded로 갱신되고 누락됐던 환불 기록이 채워진다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo } = await seedAndPay(db, 2); // 총 20000원
    await syncShowCancelsFromToss(orderNo, {
      paymentKey: 'pk1', orderId: orderNo, status: 'PARTIAL_CANCELED', totalAmount: 20000,
      cancels: [{ transactionKey: 'tx-1', cancelAmount: 10000, cancelReason: '콘솔에서 직접 취소' }],
    });
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('partially_refunded');
    const doneRefunds = await db.query.refunds.findMany({ where: (r, { eq }) => eq(r.status, 'done') });
    expect(doneRefunds.reduce((sum: number, r) => sum + r.amount, 0)).toBe(10000);
  });

  it('같은 취소 이벤트가 두 번 도착해도 refunds 행의 합계는 한 번만큼만 남는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo } = await seedAndPay(db, 1);
    const payload = {
      paymentKey: 'pk1', orderId: orderNo, status: 'CANCELED' as const, totalAmount: 10000,
      cancels: [{ transactionKey: 'tx-1', cancelAmount: 10000, cancelReason: '콘솔에서 직접 취소' }],
    };
    await syncShowCancelsFromToss(orderNo, payload);
    await syncShowCancelsFromToss(orderNo, payload);
    const doneRefunds = await db.query.refunds.findMany({ where: (r, { eq }) => eq(r.status, 'done') });
    expect(doneRefunds.reduce((sum: number, r) => sum + r.amount, 0)).toBe(10000);
  });

  it('NETWORK_ERROR로 refunding에 머물던 티켓을 웹훅 대사가 refunded로 확정한다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    toss.injectFault(`cancel:tkt-refund:${orderNo}:${tickets[0].id}`, { code: 'NETWORK_ERROR' });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('toss_unknown');

    // 웹훅이 뒤늦게 "사실은 취소됐다"를 들고 온다 — 태그는 실제 코드가 만드는 형태
    // (`tkt-refund:<orderNo>:<정렬된 티켓 id들>`)와 같다.
    await syncShowCancelsFromToss(orderNo, {
      paymentKey: 'pk1', orderId: orderNo, status: 'CANCELED', totalAmount: 10000,
      cancels: [{ transactionKey: 'tx-late', cancelAmount: 10000, cancelReason: `[#tkt-refund:${orderNo}:${tickets[0].id}] 공연 티켓 환불` }],
    });
    const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, tickets[0].id) });
    expect(ticket?.status).toBe('refunded');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
  });
});

// finding(Important) 회귀 — syncShowCancelsFromToss가 주문의 'refunding' 티켓 전부를
// 쓸어 담지 않고, 이 웹훅 이벤트가 실제로 정산하는 티켓만 골라 넘기는지 확인한다.
// 같은 주문의 서로 다른 두 티켓(A, B)이 각각 독립적으로 환불 진행 중(refunding)일 때,
// A의 취소 이벤트가 먼저 도착해도 B는 건드리지 않아야 한다 — 그래야 B의 토스 응답이
// 나중에 확정 거절로 돌아왔을 때 revertClaim이 실제로 되돌릴 대상을 찾는다(고치기
// 전에는 A의 이벤트가 B까지 'refunded'로 확정해 버려, 뒤이은 거절의 revertClaim이
// "이미 refunded라 refunding이 아님"으로 0행을 매치해 아무것도 되돌리지 못했다 — 돈이
// 안 돌아간 티켓이 'refunded'로 남는 사고).
describe('syncShowCancelsFromToss — 티켓별 스코프(finding: 광범위 sweep)', () => {
  it('한 티켓의 취소 이벤트는 같은 주문의 다른 티켓(별도로 환불 진행 중)을 건드리지 않는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { orderNo, toss } = await seedAndPay(db, 2); // A, B 두 장, 총 20,000원
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
    const [ticketA, ticketB] = tickets;

    // A는 NETWORK_ERROR로 응답 없이 'refunding'에 머문다(첫 번째 독립 환불 시도).
    toss.injectFault(`cancel:tkt-refund:${orderNo}:${ticketA.id}`, { code: 'NETWORK_ERROR' });
    const outcomeA = await refundShowTickets({ orderNo, ticketIds: [ticketA.id], noticeAt: new Date() }, toss);
    expect(outcomeA.status).toBe('toss_unknown');

    // B는 별도의 독립적인 환불 시도다 — 이 시도의 토스 응답이 "아직 안 왔다"(in-flight)를
    // interceptHook으로 재현한다: B의 cancelPayment가 실제로 응답을 돌려주기 직전에,
    // A의 취소 이벤트에 대한 웹훅이 먼저 도착해 처리된다고 가정한다.
    let syncRan = false;
    toss.setInterceptHook(async () => {
      if (!syncRan) {
        syncRan = true;
        await syncShowCancelsFromToss(orderNo, {
          paymentKey: 'pk1', orderId: orderNo, status: 'PARTIAL_CANCELED', totalAmount: 20000,
          cancels: [{ transactionKey: 'tx-a', cancelAmount: 10000, cancelReason: `[#tkt-refund:${orderNo}:${ticketA.id}] 공연 티켓 환불` }],
        });
      }
    });
    // B의 토스 응답은 그 뒤 확정 거절로 돌아온다(응답 자체는 왔으니 NETWORK_ERROR가 아니다).
    toss.injectFault(`cancel:tkt-refund:${orderNo}:${ticketB.id}`, { code: 'ALREADY_CANCELED_PAYMENT', message: '이미 취소된 결제' });
    const outcomeB = await refundShowTickets({ orderNo, ticketIds: [ticketB.id], noticeAt: new Date() }, toss);

    expect(syncRan).toBe(true);
    // A의 이벤트 처리 직후 상태 — A만 확정되고 B는 여전히 refunding이어야 한다.
    const afterSyncA = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, ticketA.id) });
    expect(afterSyncA?.status).toBe('refunded');

    // B의 확정 거절 처리 — revertClaim이 실제로 대상을 찾아 되돌려야 한다(0행 매치로
    // 조용히 아무 일도 안 하면 안 된다).
    expect(outcomeB.status).toBe('rejected');
    if (outcomeB.status === 'rejected') expect(outcomeB.reason).toBe('toss_failed');
    const afterRejectB = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, ticketB.id) });
    expect(afterRejectB?.status).toBe('issued'); // 'refunded'로 잘못 남지 않고 되돌아갔다

    // 주문 상태 — A만 실제로 환불됐으니 부분 환불이어야 한다(B는 결제도, 기록도 그대로다).
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('partially_refunded');
    const doneRefunds = await db.query.refunds.findMany({ where: (r, { eq }) => eq(r.status, 'done') });
    const totalRecorded = doneRefunds.reduce((sum: number, r) => sum + r.amount, 0);
    expect(totalRecorded).toBe(10000); // A의 몫만
  });
});
