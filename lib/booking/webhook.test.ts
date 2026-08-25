jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn() }));
jest.mock('./toss', () => ({ fetchPayment: jest.fn() }));
jest.mock('./confirm', () => ({ confirmBookingPayment: jest.fn() }));
// getDb()가 매 호출 같은 객체를 돌려주도록 mock db를 factory 스코프에 고정한다 (confirm.test.ts·
// cancel.test.ts와 동일 이유 — webhook.ts도 한 실행 안에서 getDb()를 여러 번 부른다:
// webhookEvents insert → (분기에 따라) refunds insert·bookings/orders update가 담긴 batch).
jest.mock('../../db/client', () => {
  const batch = jest.fn().mockResolvedValue([]);
  const insertValues = jest.fn().mockReturnValue({});
  const insert = jest.fn().mockReturnValue({ values: insertValues });
  const updateWhere = jest.fn().mockReturnValue({});
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });
  const db = { batch, insert, update };
  return { getDb: () => db };
});

import { processTossWebhook } from './webhook';
import { findOrderByOrderNo } from './service';
import { fetchPayment } from './toss';
import { confirmBookingPayment } from './confirm';
import { getDb } from '../../db/client';

type MockDb = {
  batch: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
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
  it('같은 eventKey가 두 번 도착하면 두 번째는 fetchPayment를 부르지 않는다 (멱등)', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue(doneTossResult);
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmBookingPayment as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'SNB-1' });

    const first = await processTossWebhook(donePayload);
    expect(first).toEqual({ status: 200 });
    expect(fetchPayment).toHaveBeenCalledTimes(1);

    // 두 번째 도착 — webhookEvents INSERT가 unique 위반으로 실패한다.
    mockDb().insert.mock.results[0].value.values.mockImplementationOnce(() => {
      throw new Error('UNIQUE constraint failed: webhook_events.event_key');
    });
    const second = await processTossWebhook(donePayload);
    expect(second).toEqual({ status: 200 });
    expect(fetchPayment).toHaveBeenCalledTimes(1); // 여전히 1회 — 두 번째는 재조회도 안 갔다
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
    expect(mockDb().batch).not.toHaveBeenCalled(); // refunds insert·상태 전이 모두 스킵됨
  });

  it('CANCELED 동기화는 booking을 cancelled로, order를 refunded로 전이한다 (취소 API는 다시 부르지 않는다)', async () => {
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
    expect(db.batch).toHaveBeenCalled();
    const refundInsert = insertValuesCallsOf(db).find((c) => c.reason === '토스 외부 취소 동기화');
    expect(refundInsert).toMatchObject({ paymentId: 'p1', amount: 275000, requestedBy: 'webhook', status: 'done' });
    const bookingUpdate = setCallsOf(db).find((c) => c.status === 'cancelled');
    expect(bookingUpdate).toBeDefined();
    const orderUpdate = setCallsOf(db).find((c) => c.status === 'refunded');
    expect(orderUpdate).toBeDefined();
  });

  it('재조회(fetchPayment) 네트워크 실패는 500을 반환한다 (토스가 재시도하도록)', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'fetch failed' });
    const result = await processTossWebhook(donePayload);
    expect(result).toEqual({ status: 500 });
    expect(confirmBookingPayment).not.toHaveBeenCalled();
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
});
