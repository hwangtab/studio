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

  it('토스 확정이 NETWORK_ERROR면 실패로 낙인찍지 않고 재시도 가치가 있는 코드(toss_unresolved)로 정규화한다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault(`confirm:pk1`, { code: 'NETWORK_ERROR' });
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    expect(outcome).toEqual({ status: 'error', code: 'toss_unresolved' });
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('pending'); // failed로 바뀌지 않아야 한다 — 재시도(웹훅 500)가 다시 확인한다
  });

  it('ALREADY_PROCESSED_PAYMENT + 재조회 성공 — 정상 확정과 같은 경로로 기록한다(paid/issued)', async () => {
    // 토스는 이미 이 결제를 승인했는데(예: 첫 confirmPayment 응답을 우리가 못 받고 재시도한
    // 경우) 우리 DB만 뒤처진 상황을 재현한다. confirmPayment는 ALREADY_PROCESSED_PAYMENT로
    // 거절하지만, fetchPayment는 실제 승인 사실(DONE + 우리 주문·금액과 일치)을 돌려준다.
    const { db } = await createTestDb();
    (global as any).__testDb = db;
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
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('paid');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t: any) => t.status === 'issued')).toBe(true);
  });

  it('ALREADY_PROCESSED_PAYMENT인데 재조회를 못 찾으면(불일치) 최종이 아니라 재시도 대상(toss_unresolved)으로 끝나고 주문은 건드리지 않는다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    toss.injectFault('confirm:pk1', { code: 'ALREADY_PROCESSED_PAYMENT' });
    // fetchPayment가 아무것도 못 찾는 경우(fakeToss._payments를 비워 둔다) — "실제로 뭐가
    // 승인됐는지조차 확인 못 한" 상태다. 최종 결론(예: declined)으로 낙인하지 않는다.
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    expect(outcome).toEqual({ status: 'error', code: 'toss_unresolved' });
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('pending'); // 건드리지 않았다 — 재시도가 다시 판정한다
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t: any) => t.status === 'held')).toBe(true); // 티켓도 그대로 held
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

  it('동시 확정 경합으로 payment_key가 이미 기록돼 있고 주문이 paid면 예외 대신 재생으로 처리된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
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
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
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

  it('토스 취소는 성공했는데 원장 기록이 실패하면 claim을 되돌리지 않고 ledger_write_failed를 반환한다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    // 결제 승인 API가 approved로 응답했다고 가정(오토캔슬 대상은 approved-but-not-recorded 상태).
    await toss.confirmPayment({ paymentKey: 'pk1', orderId: created.orderNo, amount: 10000 });
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    // finding #2 테스트와 같은 트릭 — payment_key를 미리 심어 두면, autoCancelShowApproval이
    // 토스 취소까지 성공시킨 뒤 마지막 batch의 payments INSERT가 UNIQUE 위반으로 실패한다.
    // "토스 취소는 이미 됐는데 우리 원장 기록만 실패한" 상황을 결정적으로 재현하는 방법이다.
    await db.run(sql`
      INSERT INTO payments (id, order_id, payment_key) VALUES ('existing-payment', ${order!.id}, 'pk1')
    `);
    const outcome = await autoCancelShowApproval(created.orderNo, toss);
    expect(outcome.status).toBe('ledger_write_failed');
    // claim을 되돌리지 않는다 — 되돌리면 다음 실행이 이미 취소된 결제를 또 취소하려 든다.
    const afterOrder = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(afterOrder?.status).toBe('auto_cancel_pending');
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
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
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
