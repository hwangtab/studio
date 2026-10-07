import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

import { createShowOrder, expireStaleShowOrders } from './service';
import { confirmShowOrder, autoCancelShowApproval } from './confirm';
import { cancelShowtime } from './showtimeOps';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';

async function seedShow(db: ShowsTestDb, capacity = 10) {
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
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  return { showtimeId, ticketTypeId: 'type-1' };
}

describe('confirmShowOrder', () => {
  it('정상 결제를 확인하면 티켓이 issued로 바뀌고 entry_number가 배정된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'a', buyerContact: '010' }, new Date());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const toss = createFakeToss();
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 20000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('confirmed');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status === 'issued')).toBe(true);
    expect(tickets.map((t) => t.entryNumber).sort()).toEqual([1, 2]);
  });

  it('이미 확인된 주문을 다시 확인하면 replay로 처리된다(중복 확정 없음)', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    const second = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    expect(second.status).toBe('already_confirmed');
  });

  it('토스 확정이 NETWORK_ERROR면 실패로 낙인찍지 않고 재시도 가치가 있는 코드(toss_unresolved)로 정규화한다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault(`confirm:pk1`, { code: 'NETWORK_ERROR' });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome).toEqual({ status: 'error', code: 'toss_unresolved' });
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('pending'); // failed로 바뀌지 않아야 한다 — 재시도(웹훅 500)가 다시 확인한다
  });

  it('ALREADY_PROCESSED_PAYMENT + 재조회 성공 — 정상 확정과 같은 경로로 기록한다(paid/issued)', async () => {
    // 토스는 이미 이 결제를 승인했는데(예: 첫 confirmPayment 응답을 우리가 못 받고 재시도한
    // 경우) 우리 DB만 뒤처진 상황을 재현한다. confirmPayment는 ALREADY_PROCESSED_PAYMENT로
    // 거절하지만, fetchPayment는 실제 승인 사실(DONE + 우리 주문·금액과 일치)을 돌려준다.
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault('confirm:pk1', { code: 'ALREADY_PROCESSED_PAYMENT' });
    // 재조회가 성공하도록 fakeToss의 내부 결제 저장소에 "토스 쪽엔 이미 있는" 결제를 심어 둔다.
    toss._payments.set('pk1', {
      paymentKey: 'pk1', orderId: created.orderNo, status: 'DONE', totalAmount: 20000,
      approvedAt: new Date().toISOString(), cancels: [],
    });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 20000 }, { trustedByWebhook: true }, toss);
    expect(outcome.status).toBe('confirmed');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('paid');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status === 'issued')).toBe(true);
  });

  it('ALREADY_PROCESSED_PAYMENT인데 재조회를 못 찾으면(불일치) 최종이 아니라 재시도 대상(toss_unresolved)으로 끝나고 주문은 건드리지 않는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault('confirm:pk1', { code: 'ALREADY_PROCESSED_PAYMENT' });
    // fetchPayment가 아무것도 못 찾는 경우(fakeToss._payments를 비워 둔다) — "실제로 뭐가
    // 승인됐는지조차 확인 못 한" 상태다. 최종 결론(예: declined)으로 낙인하지 않는다.
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    expect(outcome).toEqual({ status: 'error', code: 'toss_unresolved' });
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('pending'); // 건드리지 않았다 — 재시도가 다시 판정한다
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status === 'held')).toBe(true); // 티켓도 그대로 held
  });

  it('확정 거절 코드면 failed로 기록된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault(`confirm:pk1`, { code: 'REJECT_CARD_COMPANY' });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('declined');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('failed');
  });

  it('토스 승인 직전 다른 실행이 주문을 붙잡으면(orders 전이 0행) 티켓을 issued로 바꾸지 않는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
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
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status === 'held')).toBe(true);
  });

  it('동시 확정 경합으로 payment_key가 이미 기록돼 있고 주문이 paid면 예외 대신 재생으로 처리된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    // 이미 다른 실행(경합에서 이긴 쪽)이 같은 paymentKey로 결제 기록을 남기고 주문을 paid로
    // 전이시켜 뒀다고 가정한다 — payments.payment_key는 UNIQUE라 이 확정 시도의 INSERT는
    // 제약 위반으로 실패해야 한다. 실제 이긴 쪽의 batch는 payments INSERT와 orders→paid
    // 전이를 한 트랜잭션으로 커밋하므로(원자적), 이 픽스처도 두 문장을 함께 반영해야
    // "payments 행은 있는데 주문은 아직 pending"인 있을 수 없는 부분 상태를 만들지 않는다
    // (그런 부분 상태에서는 auto_cancel_conflict 분기가 잘못 타 이 테스트가 틀린 이유로
    // 통과하게 된다).
    await db.run(sql`
      INSERT INTO payments (id, order_id, payment_key) VALUES ('existing-payment', ${order!.id}, 'pk1')
    `);
    await db.run(sql`UPDATE orders SET status = 'paid' WHERE id = ${order!.id}`);
    const toss = createFakeToss();
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('already_confirmed');
  });

  it('payment_key가 이미 기록돼 있지만 주문이 paid가 아니면(auto-cancel이 먼저 이김) already_confirmed로 오보고하지 않는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    const toss = createFakeToss();
    // confirmShowOrder가 이 주문을 'pending'으로 이미 읽은 뒤(그래서 CONCLUDED_STATUSES
    // 초반 판정을 통과한 뒤), toss.confirmPayment 응답 직전에 다른 실행(autoCancelShowApproval)이
    // 이 paymentKey로 payments 행을 남기고 주문을 refunded로 끝냈다고 가정한다 — 미리 order를
    // refunded로 세팅해 두면 CONCLUDED_STATUSES 판정에서 애초에 already_confirmed로 조기
    // 반환돼 이 테스트가 노리는 catch 분기(payments INSERT의 UNIQUE 충돌)를 지나가 버리므로,
    // 인터셉트 훅으로 "이미 통과한 뒤" 시점에 상태를 바꾼다.
    toss.setInterceptHook(async () => {
      await db.run(sql`
        INSERT INTO payments (id, order_id, payment_key) VALUES ('existing-payment', ${order!.id}, 'pk1')
      `);
      await db.run(sql`UPDATE orders SET status = 'refunded' WHERE id = ${order!.id}`);
    });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('auto_cancel_conflict');
  });
});

describe('autoCancelShowApproval', () => {
  it('만료된 pending 주문을 소유권 CAS로 취소하면 결제 취소가 기록된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    // 결제 승인 API가 approved로 응답했다고 가정(오토캔슬 대상은 approved-but-not-recorded 상태).
    // 우리 DB에는 아직 payments 행이 없으므로(진짜 고아 승인), paymentKey를 직접 넘긴다 —
    // finding #3 수정 후 이 함수는 orderNo만으로 토스에 물을 수 없다(실제 fetchPayment는
    // paymentKey로만 조회하고, payments 테이블에도 아직 찾을 행이 없다).
    await toss.confirmPayment({ paymentKey: 'pk1', orderId: created.orderNo, amount: 10000 });
    const outcome = await autoCancelShowApproval(created.orderNo, toss, 'pk1');
    expect(outcome.status).toBe('cancelled');
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('refunded');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status === 'void')).toBe(true);
  });

  // finding #4 회귀 테스트. 예전엔 이 정확한 시나리오(취소 대상 payments 행이 이미 있는
  // 상태에서 autoCancelShowApproval의 마지막 batch가 다시 그 paymentKey로 INSERT를 시도)가
  // UNIQUE 위반으로 batch 전체를 실패시켜 "토스 취소는 성공했는데(돈은 돌아갔는데) 우리
  // 기록은 없는" ledger_write_failed로 끝났다 — 주문은 auto_cancel_pending에 영원히 멈춘다.
  // 고친 코드는 payments·refunds INSERT를 둘 다 "이미 있으면 건드리지 않는" 조건부 INSERT로
  // 바꿔서, 이 배치가 기존 행을 그대로 재사용하고 환불 기록·주문 전이까지 마무리한다.
  it('취소 대상 payments 행이 이미 있어도(같은 paymentKey) UNIQUE 위반 없이 재사용해 refunded로 끝난다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    await toss.confirmPayment({ paymentKey: 'pk1', orderId: created.orderNo, amount: 10000 });
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    // "다른 실행(예: confirmShowOrder 자신의 게이트-실패 batch)이 먼저 payments 행을 남겨
    // 뒀다"를 재현한다 — payment_key로 이 함수가 paymentKey를 찾을 수 있게(third arg 없이).
    await db.run(sql`
      INSERT INTO payments (id, order_id, payment_key) VALUES ('existing-payment', ${order!.id}, 'pk1')
    `);
    const outcome = await autoCancelShowApproval(created.orderNo, toss);
    expect(outcome.status).toBe('cancelled');
    const afterOrder = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(afterOrder?.status).toBe('refunded');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status === 'void')).toBe(true);
    // 정확히 하나의 payments 행(중복 INSERT 없음)과 하나의 refunds 행.
    const paymentRows = await db.query.payments.findMany({ where: (p, { eq }) => eq(p.paymentKey, 'pk1') });
    expect(paymentRows.length).toBe(1);
    const refundRows = await db.query.refunds.findMany({ where: (r, { eq }) => eq(r.paymentId, 'existing-payment') });
    expect(refundRows.length).toBe(1);
    expect(refundRows[0].amount).toBe(10000);
  });
});

describe('assignEntryNumbers', () => {
  // 이 테스트는 두 confirmShowOrder 호출을 순차(await)로 실행한다 — 실제 동시 실행이 서로
  // 끼어드는 것을 재현하지 않는다(단일 동기 libsql :memory: 커넥션으로는 진짜 인터리빙을
  // 만들 수 없다). 그래서 이름·주석 모두 "겹치지 않는다"만 증명한다고 정직하게 적는다 —
  // MAX(entry_number) 선읽기+JS 카운터로 되돌리면 두 호출이 순차라도 통과해 버리므로(각
  // 호출이 자기 배정 전에 매번 새로 커밋된 값을 다시 읽는 원자적 UPDATE인지가 핵심이지,
  // 두 호출의 실행 순서가 핵심이 아니다), 이 테스트가 실제로 잡는 것은 "티켓별 UPDATE가
  // 매 순간 최신 커밋 값을 본다"는 성질이다. **진짜 동시 실행(두 요청이 물리적으로 겹치는
  // 경우)에 대한 회귀 증명은 이 계획의 Task 15가 담당한다** — 그 태스크가 이런 종류의
  // 인터리빙을 다루는 것으로 이미 계획돼 있어, 여기서 추가로 흉내 내지 않는다.
  it('같은 회차의 서로 다른 두 주문을 순차로 확정해도 entry_number가 겹치지 않는다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const first = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'a', buyerContact: '010' }, new Date());
    const second = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'b', buyerContact: '010' }, new Date());
    if (!first.ok || !second.ok) throw new Error('setup failed');

    const toss = createFakeToss();
    const firstOutcome = await confirmShowOrder({ orderNo: first.orderNo, paymentKey: 'pk-a', amount: 20000 }, { trustedByWebhook: false }, toss);
    const secondOutcome = await confirmShowOrder({ orderNo: second.orderNo, paymentKey: 'pk-b', amount: 20000 }, { trustedByWebhook: false }, toss);
    expect(firstOutcome.status).toBe('confirmed');
    expect(secondOutcome.status).toBe('confirmed');

    const firstTickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, first.orderNo) });
    const secondTickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, second.orderNo) });
    const firstNumbers = firstTickets.map((t) => t.entryNumber).sort();
    const secondNumbers = secondTickets.map((t) => t.entryNumber).sort();

    expect(firstNumbers).toEqual([1, 2]);
    expect(secondNumbers).toEqual([3, 4]);
    // 두 주문의 번호 집합이 겹치지 않는다는 것을 명시적으로도 확인한다.
    expect(firstNumbers.some((n) => secondNumbers.includes(n))).toBe(false);
  });
});

// finding #1(Critical) 회귀 — confirmShowOrder의 orders-UPDATE 게이트가 status IN(...)만
// 보고 회차 생존·자기 티켓 held 유지·정원을 재확인하지 않던 문제. 세 가지 재현 시나리오를
// 각각 검증한다: 회차취소 후 뒤늦은 확인, 만료 처리 후 뒤늦은 웹훅 확인, 그리고 홀드가
// 시간상 만료됐지만 크론이 아직 안 돈 상태에서의 오버셀. 세 경우 모두 "토스 승인은
// 끝났는데 우리 쪽엔 표를 못 주는" 상태가 조용히 sold_out으로만 끝나지 않고, 그 결제가
// autoCancelShowApproval과 같은 대사 경로로 실제 환불되는지까지 확인한다.
describe('finding #1 회귀 — 확정 게이트 강화', () => {
  it('회차 취소 뒤 도착한 뒤늦은 확인은 확정되지 않고, 이미 캡처된 결제는 환불된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');

    const toss = createFakeToss();
    // 주문이 아직 pending인 동안 회차가 취소된다 — cancelShowtime은 paid/partially_refunded
    // 주문만 환불 대상으로 보므로 이 pending 주문은 건드리지 않지만, showtimes.status는
    // 'cancelled'로 바뀐다.
    await cancelShowtime(showtimeId, new Date(), toss);
    const showtimeBefore = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, showtimeId) });
    expect(showtimeBefore?.status).toBe('cancelled');

    // 그 뒤에야 결제 확인(성공 리다이렉트든 웹훅이든)이 도착한다 — 토스는 이미 승인했다.
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('sold_out');

    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    // "결제는 캡처됐는데 표는 못 준다"로 끝나지 않는다 — 자동 대사로 환불까지 마무리된다.
    expect(order?.status).toBe('refunded');
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status !== 'issued')).toBe(true);

    const paymentRows = await db.query.payments.findMany({ where: (p, { eq }) => eq(p.paymentKey, 'pk1') });
    expect(paymentRows.length).toBe(1); // 이중 기록 없음
    const refundRows = await db.query.refunds.findMany();
    expect(refundRows.length).toBe(1);
    expect(refundRows[0].amount).toBe(10000); // 캡처된 금액 전액이 실제로 환불됨
  });

  it('유예 지나 만료 처리(티켓 void)된 뒤 도착한 웹훅 확인은 확정되지 않고, 캡처된 결제는 환불된다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    // 홀드+30분 유예가 이미 지난 시점에 생성됐다고 가정 — expireStaleShowOrders가 이 주문을
    // expired로, 티켓을 void로 되돌린다.
    const past = new Date(Date.now() - 1000 * 3600 * 2);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, past);
    if (!created.ok) throw new Error('setup failed');
    const expiredCount = await expireStaleShowOrders(new Date());
    expect(expiredCount).toBe(1);
    const beforeConfirm = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(beforeConfirm?.status).toBe('expired');
    const ticketsBefore = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(ticketsBefore.every((t) => t.status === 'void')).toBe(true);

    const toss = createFakeToss();
    // 웹훅 신뢰 경로 — expired도 acceptableStatuses에 들어가지만, 이 티켓은 이미 held를
    // 벗어났으므로(void) 게이트가 막아야 한다.
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    expect(outcome.status).toBe('sold_out');

    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('refunded'); // "결제 캡처, 표 없음" 상태로 남지 않는다
    const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t) => t.status === 'void')).toBe(true); // issued로 바뀌지 않음

    const paymentRows = await db.query.payments.findMany({ where: (p, { eq }) => eq(p.paymentKey, 'pk1') });
    expect(paymentRows.length).toBe(1);
    const refundRows = await db.query.refunds.findMany();
    expect(refundRows.length).toBe(1);
    expect(refundRows[0].amount).toBe(10000);
  });

  it('홀드가 시간상 만료됐지만 크론이 아직 안 돈 상태의 오버셀 — 정확히 하나만 issued로 끝난다', async () => {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db, 1); // 정원 1석
    const nowReal = new Date();

    // 주문 A — 정상 생성(홀드 유효).
    const orderA = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, nowReal);
    if (!orderA.ok) throw new Error('setup failed(A)');

    // A의 홀드가 시간상 이미 지났다고 되돌린다(30분 유예 크론은 아직 안 돌았다 — show_orders
    // 행은 그대로 남아 있고 티켓도 여전히 'held'다). 이렇게 하면 A를 뺀 나머지로 정원을 재는
    // B의 생성 시점 게이트가 A의 홀드를 "이미 끝난 것"으로 보고 세지 않는다(정상 동작 —
    // 새 구매자에게 자리를 열어 주는 것 자체는 의도된 것이다).
    await db.run(sql`UPDATE show_orders SET hold_expires_at = ${Math.floor(Date.now() / 1000) - 100} WHERE order_no = ${orderA.orderNo}`);

    // 주문 B — A의 홀드가 시간상 끝난 것으로 보여 같은 자리를 또 잡을 수 있다(오버셀 전제).
    const orderB = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'b', buyerContact: '010' }, new Date());
    expect(orderB.ok).toBe(true);
    if (!orderB.ok) throw new Error('setup failed(B)');

    // 이제 A가 먼저 확정을 시도한다 — 이 시점에 B의 홀드는 아직 유효(생성 직후)하므로, A를
    // 뺀 나머지(B)가 이미 정원을 채우고 있어 A의 확정은 막혀야 한다(정확히 이 재확인이
    // finding #1의 정원 게이트다).
    const tossA = createFakeToss();
    const outcomeA = await confirmShowOrder({ orderNo: orderA.orderNo, paymentKey: 'pk-a', amount: 10000 }, { trustedByWebhook: false }, tossA);
    expect(outcomeA.status).toBe('sold_out');

    // 이어서 B가 확정을 시도한다 — A의 티켓은 이미(A의 확정 실패로) 환불·void 처리됐으므로
    // B를 막지 않는다.
    const tossB = createFakeToss();
    const outcomeB = await confirmShowOrder({ orderNo: orderB.orderNo, paymentKey: 'pk-b', amount: 10000 }, { trustedByWebhook: false }, tossB);
    expect(outcomeB.status).toBe('confirmed');

    // 핵심 불변식 — 이 회차·구역에 issued 티켓이 정확히 하나(정원 1석)만 있어야 한다.
    const allTickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.showtimeId, showtimeId) });
    const issued = allTickets.filter((t) => t.status === 'issued');
    expect(issued.length).toBe(1);
    expect(issued[0].orderNo).toBe(orderB.orderNo);

    const orderARow = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderA.orderNo) });
    expect(orderARow?.status).toBe('refunded'); // A는 캡처된 결제가 환불로 마무리된다
  });
});

describe('운영자 결제 알림 — 카드 결제 신규 확정에서만 한 통', () => {
  const sendMock = sendEmail as jest.Mock;
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ ok: true });
  });

  async function pending(quantity = 2) {
    const { db } = await createTestDb();
    mockDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity, buyerName: '김<b>구매', buyerContact: '010-1234-5678' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    return { db, created };
  }

  it('확정되면 운영자에게 [공연 예매] 메일 한 통 — 공연·티켓 수·금액·연락처·관리자 링크, 구매자 값은 escape', async () => {
    const { created } = await pending(2);
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 20000 }, { trustedByWebhook: false }, createFakeToss());
    expect(outcome.status).toBe('confirmed');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const mail = sendMock.mock.calls[0][0];
    expect(mail.to).toBe(OPERATOR_EMAIL);
    expect(mail.subject).toContain('[공연 예매]');
    expect(mail.text).toContain('2매 (일반 2매)');
    expect(mail.html).toContain('20,000원');
    expect(mail.html).toContain('/admin/shows/show-1"');
    expect(mail.html).toContain('href="tel:01012345678"');
    expect(mail.html).toContain('김&lt;b&gt;구매');
    expect(mail.html).not.toContain('김<b>구매');
  });

  it('웹훅 재전달·새로고침(already_confirmed)에서는 다시 보내지 않는다', async () => {
    const { created } = await pending(1);
    const toss = createFakeToss();
    await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 20000 / 2 }, { trustedByWebhook: false }, toss);
    const again = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    const third = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(again.status).toBe('already_confirmed');
    expect(third.status).toBe('already_confirmed');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('동시에 두 번 확정해도 한 통이다', async () => {
    const { created } = await pending(1);
    const toss = createFakeToss();
    const run = () => confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    const results = await Promise.all([run(), run()]);
    expect(results.filter((r) => r.status === 'confirmed')).toHaveLength(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('발송이 실패하거나 던져도 확정은 유지되고 notification_error(고객 메일 센티널)는 그대로다', async () => {
    for (const fail of [() => sendMock.mockResolvedValue({ ok: false, errorCode: 'API_ERROR' }), () => sendMock.mockRejectedValue(new Error('boom'))]) {
      sendMock.mockReset();
      fail();
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { db, created } = await pending(1);
      const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, createFakeToss());
      spy.mockRestore();
      expect(outcome.status).toBe('confirmed');
      const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, created.orderNo) });
      expect(order?.status).toBe('paid');
      expect(order?.notificationError).toBe('send_pending');
    }
  });
});
