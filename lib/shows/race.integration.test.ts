import { createTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';
import { confirmShowOrder, autoCancelShowApproval } from './confirm';
import { createFakeToss } from '../../tests/fakes/fakeToss';

async function seedTightShow(db: any, capacity: number) {
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

describe('race: 정원 마지막 1석 경쟁', () => {
  test('정원 1석에 동시 실행된 두 주문 중 정확히 하나만 성공한다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedTightShow(db, 1);

    const [r1, r2] = await Promise.all([
      createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date()),
      createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'b', buyerContact: '010' }, new Date()),
    ]);

    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    if (failures[0] && !failures[0].ok) expect(failures[0].code).toBe('sold_out');
  });

  test('N=5 반복 실행에도 항상 정확히 하나만 성공한다(무작위 교차 실행 근사)', async () => {
    for (let i = 0; i < 5; i++) {
      const { db } = await createTestDb();
      (global as any).__testDb = db;
      const { showtimeId, ticketTypeId } = await seedTightShow(db, 1);
      const results = await Promise.all([
        createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date()),
        createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'b', buyerContact: '010' }, new Date()),
        createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'c', buyerContact: '010' }, new Date()),
      ]);
      expect(results.filter((r) => r.ok).length).toBe(1);
    }
  });
});

describe('race: 결제확인 vs 자동취소', () => {
  /**
   * "끼어들기 훅"으로 confirmShowOrder가 toss.confirmPayment 응답을 받기 직전에
   * autoCancelShowApproval을 완주시켜, 두 경로가 같은 주문을 동시에 붙잡으려 할 때
   * 시스템이 항상 하나의 일관된 최종 상태로 수렴하는지 검증한다.
   *
   * autoCancelShowApproval이 fetchPayment로 "토스 쪽엔 이미 승인이 있다"를 확인해야
   * CAS 선점 이후 되돌리지 않고 끝까지 진행하므로, 인터셉트가 걸리는 시점(토스가 아직
   * confirmPayment 결과를 우리 쪽에 반환하기 전 — 즉 fake의 내부 `_payments`에 아직
   * 기록되기 전)에 맞춰 payments 맵을 미리 심어 둔다. 이는 "직전 confirm 시도가 이미
   * 토스 쪽에서는 완료됐는데(예: 응답을 놓쳐 재시도 중) 우리 DB는 아직 반영 전"인
   * 실제로 있을 수 있는 순서를 재현한다.
   */
  test('confirmPayment 응답 직전 자동취소가 끼어들어 먼저 완주해도, 유령발권이나 이중환불 없이 하나의 최종 상태로 수렴한다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedTightShow(db, 10);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');

    const toss = createFakeToss();
    // 토스 쪽엔 이미 DONE으로 남아 있는 것처럼 미리 심어 둔다 — autoCancelShowApproval의
    // fetchPayment가 이 값을 찾아야 CAS 선점을 되돌리지 않고 끝까지(취소까지) 진행한다.
    toss._payments.set('pk1', {
      paymentKey: 'pk1',
      orderId: created.orderNo,
      status: 'DONE',
      totalAmount: 10000,
      approvedAt: new Date().toISOString(),
      cancels: [],
    });

    let autoCancelRan = false;
    toss.setInterceptHook(async () => {
      if (!autoCancelRan) {
        autoCancelRan = true;
        await autoCancelShowApproval(created.orderNo, toss);
      }
    });

    let confirmOutcome: Awaited<ReturnType<typeof confirmShowOrder>> | undefined;
    let thrown: unknown;
    try {
      confirmOutcome = await confirmShowOrder(
        { orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 },
        { trustedByWebhook: false },
        toss,
      );
    } catch (error) {
      thrown = error;
    }

    // 어느 쪽도 처리되지 않은 예외로 끝나면 안 된다.
    expect(thrown).toBeUndefined();
    expect(autoCancelRan).toBe(true);

    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    // 두 경로가 서로 다른 최종 상태를 주장하며 충돌하지 않는다 — paid거나 refunded 둘 중
    // 하나로 수렴한다. auto_cancel_pending에 멈춰 있거나 다른 상태로 남으면 실패.
    expect(['paid', 'refunded']).toContain(order?.status);

    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
    if (order?.status === 'refunded') {
      // 주문이 환불로 끝났다면 그 어떤 티켓도 issued(유령발권)로 남으면 안 된다.
      expect(tickets.every((t: any) => t.status !== 'issued')).toBe(true);
    } else if (order?.status === 'paid') {
      // 주문이 확정으로 끝났다면 모든 티켓이 issued여야 한다 — held로 남거나 void가 되면 안 된다.
      expect(tickets.every((t: any) => t.status === 'issued')).toBe(true);
    }

    // payments 테이블에 이 paymentKey로 기록된 행은 정확히 하나 — 이중 기록이 없다.
    const paymentRows = await db.query.payments.findMany({ where: (p: any, { eq }: any) => eq(p.paymentKey, 'pk1') });
    expect(paymentRows.length).toBe(1);

    // refunds는 자동취소가 실제로 완주했을 때만(그리고 그때만) 생기고, 항상 최대 1건이어야
    // 한다 — 이중 환불이 없다.
    const refundRows = await db.query.refunds.findMany();
    expect(refundRows.length).toBeLessThanOrEqual(1);
    if (order?.status === 'refunded') {
      expect(refundRows.length).toBe(1);
    } else {
      expect(refundRows.length).toBe(0);
    }

    // confirmShowOrder가 무엇을 보고했든(confirmed/already_confirmed/sold_out/error 중
    // 하나), 그 값과 DB의 최종 상태가 서로 모순되지 않아야 한다 — "confirmed"라고 보고했는데
    // 실제로는 refunded인 경우를 잡는다.
    expect(confirmOutcome).toBeDefined();
    if (confirmOutcome) {
      if (confirmOutcome.status === 'confirmed') {
        expect(order?.status).toBe('paid');
      }
      // sold_out/already_confirmed/error(recording_failed 등)는 order.status가 refunded여도
      // 모순이 아니다 — "이 시도는 확정에 이르지 못했다"는 뜻이므로 위 paid/refunded 수렴
      // 검증으로 충분하다.
    }
  });

  test('반복 실행에도 매번 하나의 최종 상태로 수렴한다(N=5)', async () => {
    for (let i = 0; i < 5; i++) {
      const { db } = await createTestDb();
      (global as any).__testDb = db;
      const { showtimeId, ticketTypeId } = await seedTightShow(db, 10);
      const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
      if (!created.ok) throw new Error('setup failed');

      const toss = createFakeToss();
      toss._payments.set('pk1', {
        paymentKey: 'pk1',
        orderId: created.orderNo,
        status: 'DONE',
        totalAmount: 10000,
        approvedAt: new Date().toISOString(),
        cancels: [],
      });

      let autoCancelRan = false;
      toss.setInterceptHook(async () => {
        if (!autoCancelRan) {
          autoCancelRan = true;
          await autoCancelShowApproval(created.orderNo, toss);
        }
      });

      await expect(
        confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss),
      ).resolves.toBeDefined();

      const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
      expect(['paid', 'refunded']).toContain(order?.status);

      const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
      if (order?.status === 'refunded') {
        expect(tickets.every((t: any) => t.status !== 'issued')).toBe(true);
      } else {
        expect(tickets.every((t: any) => t.status === 'issued')).toBe(true);
      }

      const paymentRows = await db.query.payments.findMany({ where: (p: any, { eq }: any) => eq(p.paymentKey, 'pk1') });
      expect(paymentRows.length).toBe(1);
    }
  });
});
