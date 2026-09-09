jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn() }));
jest.mock('./toss', () => ({ fetchPayment: jest.fn() }));
jest.mock('./confirm', () => ({ confirmBookingPayment: jest.fn() }));
jest.mock('../funding/confirm', () => ({
  confirmFundingPledge: jest.fn().mockResolvedValue({ ok: true, orderNo: 'FND-1', manageToken: 't', projectSlug: 'demo' }),
  syncFundingCancelledFromToss: jest.fn().mockResolvedValue(undefined),
}));
// getDb()가 매 호출 같은 객체를 돌려주도록 mock db를 factory 스코프에 고정한다 (confirm.test.ts·
// cancel.test.ts와 동일 이유 — webhook.ts도 한 실행 안에서 getDb()를 여러 번 부른다:
// webhookEvents insert → (CANCELED 분기라면) booking 선점 run → refunds insert·orders update가
// 담긴 batch). run 기본값은 rowsAffected:1 — "선점 성공"이 기본 경로다(cancel.test.ts와 동일).
jest.mock('../../db/client', () => {
  const batch = jest.fn().mockResolvedValue([]);
  const run = jest.fn().mockResolvedValue({ rowsAffected: 1 });
  const insertValues = jest.fn().mockReturnValue({});
  const insert = jest.fn().mockReturnValue({ values: insertValues });
  const updateWhere = jest.fn().mockReturnValue({});
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });
  // 멱등 키 회수(DELETE)와 환불 대사 조회. deleteWhere를 awaits 가능한 값으로 두면 충분하다.
  const deleteWhere = jest.fn().mockResolvedValue({ rowsAffected: 1 });
  const del = jest.fn().mockReturnValue({ where: deleteWhere });
  const refundsFindMany = jest.fn().mockResolvedValue([]);
  const db = { batch, run, insert, update, delete: del, query: { refunds: { findMany: refundsFindMany } } };
  return { getDb: () => db };
});

import { processTossWebhook } from './webhook';
import { findOrderByOrderNo } from './service';
import { fetchPayment } from './toss';
import { confirmBookingPayment } from './confirm';
import { confirmFundingPledge } from '../funding/confirm';
import { getDb } from '../../db/client';

type MockDb = {
  batch: jest.Mock;
  run: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  query: { refunds: { findMany: jest.Mock } };
};

const mockDb = () => getDb() as unknown as MockDb;

/** db.insert(...).values(...) 호출 인자 전체 — insert 체인은 테이블과 무관하게 같은 values mock을 공유한다. */
const insertValuesCallsOf = (db: MockDb): Record<string, unknown>[] =>
  db.insert.mock.results.length
    ? (db.insert.mock.results[0].value.values as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>)
    : [];

/** db.update(...).set(...) 호출 인자 전체 — update 체인도 테이블과 무관하게 같은 updateSet mock을 공유한다. */
const setCallsOf = (db: MockDb): Record<string, unknown>[] =>
  db.update.mock.results.length
    ? (db.update.mock.results[0].value.set as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>)
    : [];

const donePayload = { data: { paymentKey: 'pk1', status: 'DONE' } };

const doneTossResult = {
  ok: true,
  payment: { paymentKey: 'pk1', orderId: 'SNB-1', status: 'DONE', totalAmount: 275000 },
};

const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1', orderNo: 'SNB-1', status: 'pending', totalAmount: 275000,
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
  manageToken: 't',
  bookings: [{ id: 'b1', status: 'confirmed', startAt: new Date(), endAt: new Date(), durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null }],
  workOrders: [],
  payments: [{ id: 'p1', paymentKey: 'pk1' }],
  ...over,
});

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  jest.clearAllMocks();
});

describe('processTossWebhook', () => {
  it('같은 eventKey가 두 번 도착하면 두 번째는 처리하지 않는다 (멱등)', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmBookingPayment as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'SNB-1' });

    const first = await processTossWebhook(donePayload);
    expect(first).toEqual({ status: 200 });
    expect(confirmBookingPayment).toHaveBeenCalledTimes(1);

    // 두 번째 도착 — webhookEvents INSERT가 unique 위반으로 실패한다.
    mockDb().insert.mock.results[0].value.values.mockImplementationOnce(() => {
      throw new Error('UNIQUE constraint failed: webhook_events.event_key');
    });
    const second = await processTossWebhook(donePayload);
    expect(second).toEqual({ status: 200 });
    // 멱등 키를 재조회한 실제 status로 만들기 때문에(M-1) 재조회는 키 검사보다 먼저 일어난다
    // — 늘어나는 건 토스 조회 1회뿐이고, 실제 처리는 여전히 한 번만 돈다.
    expect(confirmBookingPayment).toHaveBeenCalledTimes(1);
  });

  it('webhookEvents INSERT가 unique 위반이 아닌 DB 장애로 실패하면 500을 반환한다 (토스 재시도 유도)', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    // insert() 자체의 반환값을 이번 한 번만 바꿔치기 — 아직 첫 호출 전이라 기존 값의 values
    // mock을 mock.results로 찾아 갈 수 없다(그 방식은 이미 한 번 호출된 뒤에만 쓸 수 있다).
    mockDb().insert.mockReturnValueOnce({
      values: jest.fn().mockImplementationOnce(() => {
        throw new Error('SQLITE_IOERR: disk I/O error');
      }),
    });
    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 500 });
    expect(confirmBookingPayment).not.toHaveBeenCalled(); // 기록에 실패했으면 처리로 넘어가지 않는다
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[booking-webhook] 멱등 기록 실패 — 재시도 유도',
      // 키는 payload가 아니라 재조회한 status로 만든다 (M-1).
      expect.objectContaining({ eventKey: 'pk1:DONE' }),
    );
  });

  it('형식이 어긋난 payload는 200을 반환하고 토스를 부르지 않는다', async () => {
    const malformed = { data: { paymentKey: 123, status: 'DONE' } }; // paymentKey가 문자열이 아님
    const result = await processTossWebhook(malformed);
    expect(result).toEqual({ status: 200 });
    expect(fetchPayment).not.toHaveBeenCalled();
    expect(mockDb().insert).not.toHaveBeenCalled(); // 기록조차 하지 않는다 — 재시도해도 소용없는 요청
  });

  it('DONE 재조회 + 주문이 pending이면 confirmBookingPayment를 호출한다', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'pending' }));
    (confirmBookingPayment as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'SNB-1' });

    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 200 });
    expect(confirmBookingPayment).toHaveBeenCalledWith({ orderNo: 'SNB-1', paymentKey: 'pk1', amount: 275000 });
  });

  it('CANCELED 동기화 시 payments가 빈 배열이면 crash 대신 로그만 남기고 조용히 스킵한다', async () => {
    const cancelledTossResult = {
      ok: true,
      payment: {
        paymentKey: 'pk1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 275000,
        cancels: [{ transactionKey: 'ck1', cancelAmount: 275000 }],
      },
    };
    (fetchPayment as jest.Mock).mockResolvedValue(cancelledTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ payments: [] })); // payments 빈 배열

    const cancelledPayload = { data: { paymentKey: 'pk1', status: 'CANCELED' } };
    const result = await processTossWebhook(cancelledPayload);

    expect(result).toEqual({ status: 200 }); // 라우트 관점에선 정상 종료 — 관리자 화면에서 발견
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockDb().run).not.toHaveBeenCalled(); // 선점(claim)까지 가지 않고 그 전에 스킵됨
    expect(mockDb().batch).not.toHaveBeenCalled(); // refunds insert·상태 전이 모두 스킵됨
  });

  it('CANCELED 동기화는 booking 선점(claim) 후 refunds insert + orders를 refunded로 전이한다 (취소 API는 다시 부르지 않는다)', async () => {
    const cancelledTossResult = {
      ok: true,
      payment: {
        paymentKey: 'pk1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 275000,
        cancels: [{ transactionKey: 'ck1', cancelAmount: 275000 }],
      },
    };
    (fetchPayment as jest.Mock).mockResolvedValue(cancelledTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());

    const cancelledPayload = { data: { paymentKey: 'pk1', status: 'CANCELED' } };
    const result = await processTossWebhook(cancelledPayload);

    expect(result).toEqual({ status: 200 });
    const db = mockDb();
    expect(db.run).toHaveBeenCalledTimes(1); // booking 선점 UPDATE(cancel.ts와 동일 패턴)
    expect(db.batch).toHaveBeenCalled(); // batch는 refunds insert + orders update 2문장만
    const refundInsert = insertValuesCallsOf(db).find((c) => c.reason === '토스 외부 취소 동기화');
    expect(refundInsert).toMatchObject({ paymentId: 'p1', amount: 275000, requestedBy: 'webhook', status: 'done' });
    const orderUpdate = setCallsOf(db).find((c) => c.status === 'refunded');
    expect(orderUpdate).toBeDefined();
  });

  it('booking 선점(claim)이 실패(rowsAffected 0)해도 금액 대사가 일치하면 아무것도 기록하지 않는다', async () => {
    // paymentKey:status가 멱등 키라 PARTIAL_CANCELED와 CANCELED 두 이벤트가 동시에 통과해
    // 여기 도달할 수 있다. 먼저 온 이벤트가 booking을 이미 cancelled로 바꿨다면, 나중 이벤트의
    // claim UPDATE...WHERE status='confirmed'는 rowsAffected 0을 받는다 — 이미 기록된 환불을
    // 중복 INSERT하지 않아야 한다(대사가 일치하므로 델타 없음).
    const cancelledTossResult = {
      ok: true,
      payment: {
        paymentKey: 'pk1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 275000,
        cancels: [{ transactionKey: 'ck1', cancelAmount: 275000 }],
      },
    };
    (fetchPayment as jest.Mock).mockResolvedValue(cancelledTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const db = mockDb();
    db.run.mockResolvedValueOnce({ rowsAffected: 0 });
    db.query.refunds.findMany.mockResolvedValueOnce([{ id: 'r1', amount: 275000, status: 'done' }]);

    const cancelledPayload = { data: { paymentKey: 'pk1', status: 'CANCELED' } };
    const result = await processTossWebhook(cancelledPayload);

    expect(result).toEqual({ status: 200 }); // 웹훅 관점에선 정상 종료 — 이미 처리된 것뿐
    expect(db.run).toHaveBeenCalledTimes(1); // claim 시도는 했다
    expect(db.batch).not.toHaveBeenCalled(); // 대사 일치 — refunds insert·orders update 모두 스킵
  });

  it('claim 0인데 토스 취소액이 우리 환불 기록보다 많으면 델타를 refunds에 채우고 orders를 전이한다', async () => {
    // cancel.ts가 토스 환불까지 끝낸 뒤 refunds INSERT에 실패한 상태(recording_failed)를
    // CANCELED 웹훅이 복구하는 경로다. 조용히 return하면 "취소됐는데 환불 0원"이 영구히 남는다.
    const cancelledTossResult = {
      ok: true,
      payment: {
        paymentKey: 'pk1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 275000,
        cancels: [{ transactionKey: 'ck9', cancelAmount: 137500 }],
      },
    };
    (fetchPayment as jest.Mock).mockResolvedValue(cancelledTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'paid' }));
    const db = mockDb();
    db.run.mockResolvedValueOnce({ rowsAffected: 0 });
    db.query.refunds.findMany.mockResolvedValueOnce([]); // 기록된 done 환불 없음

    const result = await processTossWebhook({ data: { paymentKey: 'pk1', status: 'CANCELED' } });

    expect(result).toEqual({ status: 200 });
    const refundInsert = insertValuesCallsOf(db).find((c) => c.reason === '토스 취소 대사 보정');
    expect(refundInsert).toMatchObject({
      paymentId: 'p1', amount: 137500, requestedBy: 'webhook', status: 'done', tossTransactionKey: 'ck9',
    });
    const orderUpdate = setCallsOf(db).find((c) => 'status' in c);
    expect(orderUpdate).toMatchObject({ status: 'partially_refunded' });
  });

  it('booking이 이미 cancelled면 선점을 시도조차 하지 않고 곧장 대사 보정으로 간다', async () => {
    const cancelledTossResult = {
      ok: true,
      payment: {
        paymentKey: 'pk1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 275000,
        cancels: [{ transactionKey: 'ck1', cancelAmount: 275000 }],
      },
    };
    (fetchPayment as jest.Mock).mockResolvedValue(cancelledTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(
      order({
        status: 'paid',
        bookings: [{ id: 'b1', status: 'cancelled', startAt: new Date(), endAt: new Date(), durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null }],
      }),
    );
    const db = mockDb();
    db.query.refunds.findMany.mockResolvedValueOnce([]);

    const result = await processTossWebhook({ data: { paymentKey: 'pk1', status: 'CANCELED' } });

    expect(result).toEqual({ status: 200 });
    expect(db.run).not.toHaveBeenCalled(); // confirmed가 아니므로 claim UPDATE 자체가 없다
    const refundInsert = insertValuesCallsOf(db).find((c) => c.reason === '토스 취소 대사 보정');
    expect(refundInsert).toMatchObject({ amount: 275000 });
    const orderUpdate = setCallsOf(db).find((c) => 'status' in c);
    expect(orderUpdate).toMatchObject({ status: 'refunded' });
  });

  it('취소 동기화가 DB 장애로 실패하면 멱등 키를 회수하고 500을 반환한다', async () => {
    const cancelledTossResult = {
      ok: true,
      payment: {
        paymentKey: 'pk1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 275000,
        cancels: [{ transactionKey: 'ck1', cancelAmount: 275000 }],
      },
    };
    (fetchPayment as jest.Mock).mockResolvedValue(cancelledTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const db = mockDb();
    db.batch.mockRejectedValueOnce(new Error('SQLITE_IOERR: disk I/O error'));

    const result = await processTossWebhook({ data: { paymentKey: 'pk1', status: 'CANCELED' } });

    expect(result).toEqual({ status: 500 });
    expect(db.delete).toHaveBeenCalled();
  });

  // M-2: 취소 합계 0은 "반영할 취소가 없다"는 뜻이다. 예전엔 booking을 cancelled로 선점한
  // 뒤 0원 환불 행을 남겨, 실제로 취소되지 않은 예약을 취소된 것으로 만들었다.
  // lib/funding/confirm.ts의 syncFundingCancelledFromToss와 같은 방어로 선점 전에 물러난다.
  it('재조회 응답에 cancels가 없어 취소 합계가 0이면 선점도 기록도 하지 않고 물러난다', async () => {
    const cancelledTossResult = {
      ok: true,
      payment: { paymentKey: 'pk1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 275000 }, // cancels 필드 자체가 없음
    };
    (fetchPayment as jest.Mock).mockResolvedValue(cancelledTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'paid' }));

    const cancelledPayload = { data: { paymentKey: 'pk1', status: 'CANCELED' } };
    const result = await processTossWebhook(cancelledPayload);

    expect(result).toEqual({ status: 200 });
    const db = mockDb();
    expect(db.run).not.toHaveBeenCalled(); // bookings 선점 UPDATE 자체가 없다
    expect(db.batch).not.toHaveBeenCalled();
    // webhookEvents INSERT 하나뿐 — refunds 행은 만들지 않는다.
    expect(insertValuesCallsOf(db).find((c) => c.reason === '토스 외부 취소 동기화')).toBeUndefined();
    expect(setCallsOf(db).find((c) => 'status' in c)).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[booking-webhook] CANCELED 동기화 스킵 — 취소 합계 0(cancels 부재)',
      expect.objectContaining({ orderNo: 'SNB-1' }),
    );
  });

  it('재조회(fetchPayment) 네트워크 실패는 키를 남기지 않고 500을 반환한다 (토스가 재시도하도록)', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'fetch failed' });
    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 500 });
    expect(confirmBookingPayment).not.toHaveBeenCalled();
    // 재조회가 키 생성보다 앞이므로(M-1) 남긴 키가 없다 — INSERT도 회수(DELETE)도 일어나지 않는다.
    expect(mockDb().insert).not.toHaveBeenCalled();
    expect(mockDb().delete).not.toHaveBeenCalled();
  });

  it('재조회 실패로 아무 키도 안 남았으므로 같은 이벤트가 재도착하면 처음부터 다시 처리된다', async () => {
    (fetchPayment as jest.Mock)
      .mockResolvedValueOnce({ ok: false, code: 'NETWORK_ERROR', message: 'fetch failed' })
      .mockResolvedValueOnce(doneTossResult);
    (confirmBookingPayment as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'SNB-1' });

    const first = await processTossWebhook(donePayload);
    expect(first).toEqual({ status: 500 });

    const second = await processTossWebhook(donePayload);
    expect(second).toEqual({ status: 200 });
    expect(fetchPayment).toHaveBeenCalledTimes(2);
    expect(confirmBookingPayment).toHaveBeenCalledTimes(1);
  });

  // M-1 회귀: 이 엔드포인트는 무인증이고 고객은 success URL에서 자기 paymentKey를 안다.
  // 멱등 키를 payload의 status로 만들면 승인 전에 {paymentKey, status:'DONE'}을 위조 POST해
  // `pk1:DONE`을 선점할 수 있고, 뒤이어 온 진짜 DONE 웹훅이 "중복"으로 스킵된다 — success SSR
  // 까지 실패했다면 승인된 결제가 payments·confirmed booking 없이 만료된다.
  describe('위조 payload의 멱등 키 선점 (M-1)', () => {
    it('status를 DONE으로 위조해도 키는 재조회한 실제 status로 만들어진다', async () => {
      (fetchPayment as jest.Mock).mockResolvedValue({
        ok: true,
        payment: { paymentKey: 'pk1', orderId: 'SNB-1', status: 'IN_PROGRESS', totalAmount: 275000 },
      });
      const result = await processTossWebhook({ data: { paymentKey: 'pk1', status: 'DONE' } });

      expect(result).toEqual({ status: 200 });
      expect(confirmBookingPayment).not.toHaveBeenCalled(); // 실제 상태가 DONE이 아니므로 처리 없음
      const eventInsert = insertValuesCallsOf(mockDb()).find((c) => 'eventKey' in c);
      expect(eventInsert).toMatchObject({ eventKey: 'pk1:IN_PROGRESS' }); // 'pk1:DONE'이면 안 된다
    });

    it('위조 요청 뒤에 온 진짜 DONE 웹훅이 중복으로 스킵되지 않고 확정을 수행한다', async () => {
      // ① 위조: payload는 DONE인데 실제 상태는 IN_PROGRESS.
      (fetchPayment as jest.Mock).mockResolvedValueOnce({
        ok: true,
        payment: { paymentKey: 'pk1', orderId: 'SNB-1', status: 'IN_PROGRESS', totalAmount: 275000 },
      });
      await processTossWebhook({ data: { paymentKey: 'pk1', status: 'DONE' } });
      expect(confirmBookingPayment).not.toHaveBeenCalled();

      // ② 진짜 웹훅: 실제 상태 DONE. 위조가 남긴 키는 'pk1:IN_PROGRESS'라 'pk1:DONE' INSERT가
      //    성공한다(mock 기본값 = 충돌 없음) — 확정이 정상적으로 수행된다.
      (fetchPayment as jest.Mock).mockResolvedValueOnce(doneTossResult);
      (confirmBookingPayment as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'SNB-1' });
      const real = await processTossWebhook(donePayload);

      expect(real).toEqual({ status: 200 });
      expect(confirmBookingPayment).toHaveBeenCalledWith({ orderNo: 'SNB-1', paymentKey: 'pk1', amount: 275000 });
      const eventKeys = insertValuesCallsOf(mockDb()).filter((c) => 'eventKey' in c).map((c) => c.eventKey);
      expect(eventKeys).toEqual(['pk1:IN_PROGRESS', 'pk1:DONE']);
    });
  });

  it('DONE 확정이 recording_failed면 멱등 키를 회수하고 500을 반환한다 (승인됐는데 기록만 실패 — 재시도해야 복구된다)', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    (confirmBookingPayment as jest.Mock).mockResolvedValue({
      ok: false, code: 'recording_failed', message: '결제는 완료되었으나 예약 확정 처리가 지연되고 있습니다.',
    });
    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 500 });
    expect(mockDb().delete).toHaveBeenCalled();
  });

  it('DONE 확정이 invalid_state면 영구 실패라 기록을 남긴 채 200으로 끝낸다', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    (confirmBookingPayment as jest.Mock).mockResolvedValue({
      ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 주문입니다.',
    });
    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 200 });
    expect(mockDb().delete).not.toHaveBeenCalled(); // 재시도해도 같은 답 — 키를 유지한다
  });

  it('DONE인데 confirmBookingPayment가 not_found를 반환해도(주문 부재) 웹훅은 200을 반환한다', async () => {
    // webhook.ts는 confirmBookingPayment 결과를 검사하지 않는다 — "주문을 못 찾으면 200"은
    // confirmBookingPayment 내부의 not_found 판정에 기대고, 웹훅은 그 결과와 무관하게 종료한다.
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    (confirmBookingPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' });
    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 200 });
    expect(confirmBookingPayment).toHaveBeenCalledWith({ orderNo: 'SNB-1', paymentKey: 'pk1', amount: 275000 });
  });

  it('DONE + 이미 paid인 주문이면 confirmBookingPayment 내부 멱등에 맡기고 그대로 호출한다', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'paid' }));
    (confirmBookingPayment as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'SNB-1' });
    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 200 });
    expect(confirmBookingPayment).toHaveBeenCalledWith({ orderNo: 'SNB-1', paymentKey: 'pk1', amount: 275000 });
  });

  it('그 외 상태(예: READY)는 무시하고 200을 반환한다', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue({
      ok: true,
      payment: { paymentKey: 'pk1', orderId: 'SNB-1', status: 'READY', totalAmount: 275000 },
    });
    const result = await processTossWebhook({ data: { paymentKey: 'pk1', status: 'READY' } });
    expect(result).toEqual({ status: 200 });
    expect(confirmBookingPayment).not.toHaveBeenCalled();
    expect(mockDb().batch).not.toHaveBeenCalled();
  });

  it('펀딩 주문의 DONE 웹훅은 confirmFundingPledge로 간다', async () => {
    (fetchPayment as jest.Mock).mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk_f', orderId: 'FND-1', status: 'DONE', totalAmount: 5000 },
    });
    (findOrderByOrderNo as jest.Mock).mockResolvedValueOnce({
      id: 'o', orderNo: 'FND-1', type: 'funding', status: 'pending', totalAmount: 5000, bookings: [], payments: [],
    });
    const { status } = await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'DONE' } });
    expect(status).toBe(200);
    expect(confirmFundingPledge).toHaveBeenCalledWith({ orderNo: 'FND-1', paymentKey: 'pk_f', amount: 5000 });
    expect(confirmBookingPayment).not.toHaveBeenCalled();
  });
});
