jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn() }));
jest.mock('./toss', () => ({ cancelPayment: jest.fn() }));
jest.mock('./gcal', () => ({ deleteBookingEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('./email', () => ({
  sendBookingCancelledEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderCancelledEmails: jest.fn().mockResolvedValue(null),
}));
// getDb()가 매 호출 같은 객체를 돌려주도록 mock db를 factory 스코프에 고정한다 (confirm.test.ts와 동일 이유
// — cancel.ts도 한 실행 안에서 getDb()를 여러 번 부르므로 claim(run)·batch·insert·후처리 update가 같은
// 참조를 봐야 한다). run 기본값은 rowsAffected:1 — "선점 성공"이 기본 경로다.
jest.mock('../../db/client', () => {
  const run = jest.fn().mockResolvedValue({ rowsAffected: 1 });
  const batch = jest.fn().mockResolvedValue([]);
  const insertValues = jest.fn().mockReturnValue({});
  const insert = jest.fn().mockReturnValue({ values: insertValues });
  const updateWhere = jest.fn().mockReturnValue({});
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });
  const db = { run, batch, insert, update };
  return { getDb: () => db };
});

import { cancelBookingWithRefund } from './cancel';
import { findOrderByOrderNo } from './service';
import { cancelPayment } from './toss';
import { deleteBookingEvent } from './gcal';
import { sendBookingCancelledEmails, sendMixingOrderCancelledEmails } from './email';
import { getDb } from '../../db/client';

type MockDb = {
  run: jest.Mock;
  batch: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

const mockDb = () => getDb() as unknown as MockDb;

/** db.update(...).set(...) 호출 인자 전체 — update 체인은 테이블과 무관하게 같은 updateSet mock을 공유한다. */
const setCallsOf = (db: MockDb): Record<string, unknown>[] =>
  db.update.mock.results.length
    ? (db.update.mock.results[0].value.set as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>)
    : [];

/** db.insert(...).values(...) 호출 인자 전체 — insert 체인도 테이블과 무관하게 같은 values mock을 공유한다. */
const insertValuesCallsOf = (db: MockDb): Record<string, unknown>[] =>
  db.insert.mock.results.length
    ? (db.insert.mock.results[0].value.values as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>)
    : [];

const DAY_MS = 24 * 60 * 60 * 1000;
// KST 09:00 고정 — daysUntilKst 경계 계산이 자정 언저리 로컬 실행 환경에 흔들리지 않도록.
const NOW = new Date('2026-08-20T00:00:00Z');
const SAME_DAY_LATER = new Date(NOW.getTime() + 3 * 60 * 60 * 1000); // 같은 KST 날짜, 몇 시간 뒤
const THREE_DAYS_LATER = new Date(NOW.getTime() + 3 * DAY_MS);
const ONE_DAY_LATER = new Date(NOW.getTime() + DAY_MS); // 50% 환불 티어(1~2일 전)
const BEFORE_NOW = new Date(NOW.getTime() - 60 * 60 * 1000); // 이미 지난 시각

const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1', orderNo: 'SNB-1', status: 'paid', totalAmount: 275000,
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
  manageToken: 't',
  bookings: [
    {
      id: 'b1', status: 'confirmed', startAt: THREE_DAYS_LATER, endAt: THREE_DAYS_LATER,
      durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: 'evt1',
    },
  ],
  payments: [{ id: 'p1', paymentKey: 'pk' }],
  ...over,
});

const cancelOk = { ok: true, payment: { paymentKey: 'pk', cancels: [{ transactionKey: 'ck1', cancelAmount: 275000 }] } };

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  jest.clearAllMocks();
});

describe('cancelBookingWithRefund', () => {
  it('주문을 찾을 수 없으면 not_found', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(undefined);
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-X', requestedBy: 'customer', reason: '고객 취소', now: NOW });
    expect(r).toEqual({ ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' });
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it('booking이 confirmed가 아니면 invalid_state로 거부', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(
      order({ bookings: [{ id: 'b1', status: 'pending', startAt: THREE_DAYS_LATER, endAt: THREE_DAYS_LATER, durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null }] }),
    );
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 취소', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it('셀프 취소는 이용 시작 후에는 거부한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(
      order({ bookings: [{ id: 'b1', status: 'confirmed', startAt: BEFORE_NOW, endAt: BEFORE_NOW, durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null }] }),
    );
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 취소', now: NOW });
    expect(r).toEqual({ ok: false, code: 'invalid_state', message: '이용 시작 후에는 온라인 취소가 불가합니다.' });
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it('당일 취소는 토스 호출 없이 환불 0원으로 성공한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(
      order({ bookings: [{ id: 'b1', status: 'confirmed', startAt: SAME_DAY_LATER, endAt: SAME_DAY_LATER, durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null }] }),
    );
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 취소', now: NOW });
    expect(r).toEqual({ ok: true, refundAmount: 0 });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(mockDb().run).toHaveBeenCalledTimes(1); // 선점 UPDATE 1회 — revert 없음(토스를 부르지 않았으니)
    expect(mockDb().batch).toHaveBeenCalled();
    const refundInsert = insertValuesCallsOf(mockDb()).find((c) => c.status === 'done');
    expect(refundInsert).toMatchObject({ amount: 0, status: 'done' });
    // 환불액 0원이면 orders.status는 그대로 유지된다.
    const orderStatusUpdate = setCallsOf(mockDb()).find((c) => 'status' in c);
    expect(orderStatusUpdate).toMatchObject({ status: 'paid' });
  });

  it('3일 전 취소는 전액 cancelPayment를 호출하고 orders를 refunded로 전환한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, refundAmount: 275000 });
    expect(cancelPayment).toHaveBeenCalledWith({
      paymentKey: 'pk', cancelReason: '고객 셀프 취소', cancelAmount: 275000,
      idempotencyKey: 'refund:SNB-1:275000', // 재시도가 최초 취소를 replay하도록 (주문번호, 환불액)으로 결정적
    });
    const db = mockDb();
    expect(db.run).toHaveBeenCalledTimes(1); // 선점 UPDATE만 — 토스 성공했으니 revert 없음
    const orderStatusUpdate = setCallsOf(db).find((c) => 'status' in c);
    expect(orderStatusUpdate).toMatchObject({ status: 'refunded' });
    const refundInsert = insertValuesCallsOf(db).find((c) => c.status === 'done');
    expect(refundInsert).toMatchObject({ amount: 275000, status: 'done', tossTransactionKey: 'ck1' });
  });

  it('관리자 overrideAmount는 computeRefund 대신 그대로 쓰인다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(
      order({ bookings: [{ id: 'b1', status: 'confirmed', startAt: SAME_DAY_LATER, endAt: SAME_DAY_LATER, durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null }] }),
    );
    (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
    const r = await cancelBookingWithRefund({
      orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 임의 환불', overrideAmount: 50000, now: NOW,
    });
    expect(r).toEqual({ ok: true, refundAmount: 50000 });
    expect(cancelPayment).toHaveBeenCalledWith({
      paymentKey: 'pk', cancelReason: '관리자 임의 환불', cancelAmount: 50000,
      idempotencyKey: 'refund:SNB-1:50000',
    });
    const orderStatusUpdate = setCallsOf(mockDb()).find((c) => 'status' in c);
    expect(orderStatusUpdate).toMatchObject({ status: 'partially_refunded' });
  });

  it.each([
    ['총액을 초과하면', 275001],
    ['음수면', -1],
  ])('관리자 overrideAmount가 %s invalid_state로 거부하고 아무 것도 건드리지 않는다', async (_label, overrideAmount) => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const r = await cancelBookingWithRefund({
      orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 임의 환불', overrideAmount, now: NOW,
    });
    expect(r).toEqual({ ok: false, code: 'invalid_state', message: '환불 금액이 올바르지 않습니다.' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(mockDb().run).not.toHaveBeenCalled(); // 선점보다 먼저 걸러진다
    expect(mockDb().batch).not.toHaveBeenCalled();
  });

  it('관리자 overrideAmount 0원은 유효한 액션 — 토스 미호출로 취소가 진행된다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(
      order({ bookings: [{ id: 'b1', status: 'confirmed', startAt: SAME_DAY_LATER, endAt: SAME_DAY_LATER, durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null }] }),
    );
    const r = await cancelBookingWithRefund({
      orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 임의 환불', overrideAmount: 0, now: NOW,
    });
    expect(r).toEqual({ ok: true, refundAmount: 0 });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(mockDb().batch).toHaveBeenCalled();
  });

  it('동시 선점 실패(claim rowsAffected 0)면 invalid_state를 반환하고 토스를 부르지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    mockDb().run.mockResolvedValueOnce({ rowsAffected: 0 });
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 예약입니다.' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(mockDb().batch).not.toHaveBeenCalled();
  });

  it('토스 취소가 실패하면 선점을 되돌리고(revert) refunds에 failed로 기록한 뒤 toss_failed를 반환한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'REJECT_CARD', message: '취소 불가 결제' });
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: false, code: 'toss_failed', message: '취소 불가 결제' });
    const db = mockDb();
    expect(db.run).toHaveBeenCalledTimes(2); // ① 선점 claim ② 실패 후 revert
    const failedRefund = insertValuesCallsOf(db).find((c) => c.status === 'failed');
    expect(failedRefund).toMatchObject({ amount: 275000, status: 'failed' });
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('CONFIG_ERROR/NETWORK_ERROR는 고객 노출 메시지를 일반 문구로 치환하고 원문은 로그에만 남긴다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue({
      ok: false, code: 'CONFIG_ERROR', message: 'TOSS_SECRET_KEY가 설정되지 않았습니다.',
    });
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({
      ok: false, code: 'toss_failed',
      message: '취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('토스 취소는 성공했지만 db.batch가 실패하면 recording_failed를 반환한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
    const db = mockDb();
    db.batch.mockRejectedValueOnce(new Error('DB 커넥션 끊김'));
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({
      ok: false, code: 'recording_failed',
      message: '환불은 완료되었으나 처리 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // H-1 회귀: 토스 취소 타임아웃(NETWORK_ERROR)은 "요청이 안 닿았다"와 "토스는 취소했는데
  // 응답만 늦었다"를 구분하지 못한다. 후자에서 revert가 예약을 confirmed로 되돌리면 고객이
  // 다시 취소를 눌러 같은 금액이 한 번 더 나갈 수 있다(275,000원 50% 티어에서 137,500원 초과
  // 지급 — 잔액이 남아 있어 토스가 두 번째 취소도 승인한다). 두 요청의 멱등키가 같아야
  // 토스가 최초 취소를 replay해 실제 환불이 한 번만 일어난다.
  describe('부분환불 티어의 취소 재시도 (H-1)', () => {
    const partialOrder = () =>
      order({
        bookings: [{
          id: 'b1', status: 'confirmed', startAt: ONE_DAY_LATER, endAt: ONE_DAY_LATER,
          durationHours: 3, serviceType: 'recording', customerNote: null, gcalEventId: null,
        }],
      });

    it('타임아웃 후 고객이 다시 취소해도 두 요청이 같은 멱등키를 쓴다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(partialOrder());
      // ① 토스는 실제로 취소했지만 12초 타임아웃으로 NETWORK_ERROR가 돌아온 상황.
      (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'NETWORK_ERROR', message: 'The operation was aborted due to timeout' });
      const first = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
      expect(first).toMatchObject({ ok: false, code: 'toss_failed' });

      // ② 예약이 confirmed로 revert됐으므로 고객이 다시 취소를 누른다 — 같은 50% 금액.
      (cancelPayment as jest.Mock).mockResolvedValueOnce({
        ok: true, payment: { paymentKey: 'pk', cancels: [{ transactionKey: 'ck1', cancelAmount: 137500 }] },
      });
      const second = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
      expect(second).toEqual({ ok: true, refundAmount: 137500 });

      const calls = (cancelPayment as jest.Mock).mock.calls.map((c) => c[0]);
      expect(calls).toHaveLength(2);
      expect(calls[0].cancelAmount).toBe(137500);
      expect(calls[0].idempotencyKey).toBe('refund:SNB-1:137500');
      // 두 번째 요청의 키가 같아야 토스가 최초 취소를 replay한다 — 다르면 137,500원이 또 나간다.
      expect(calls[1].idempotencyKey).toBe(calls[0].idempotencyKey);
    });

    it('관리자 overrideAmount 취소도 (주문번호, 환불액)로 결정적인 멱등키를 쓴다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(partialOrder());
      (cancelPayment as jest.Mock).mockResolvedValue({
        ok: true, payment: { paymentKey: 'pk', cancels: [{ transactionKey: 'ck1', cancelAmount: 50000 }] },
      });
      await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 임의 환불', overrideAmount: 50000, now: NOW });
      expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'refund:SNB-1:50000' }));
    });
  });

  it('gcal 삭제 실패 시 gcalError 기록이 호출되고 취소 결과는 성공으로 유지된다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
    (deleteBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('캘린더 이벤트 삭제 실패: 500'));
    const db = mockDb();
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, refundAmount: 275000 });
    const gcalErrorCall = setCallsOf(db).find((c) => 'gcalError' in c);
    expect(gcalErrorCall).toBeDefined();
    expect((gcalErrorCall as { gcalError: string }).gcalError).toContain('캘린더 이벤트 삭제 실패: 500');
  });

  it('이메일 발송이 실패하면 orders.notificationError 기록이 호출된다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
    (sendBookingCancelledEmails as jest.Mock).mockResolvedValueOnce('customer:TIMEOUT');
    const db = mockDb();
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, refundAmount: 275000 });
    const notificationErrorCall = setCallsOf(db).find((c) => 'notificationError' in c);
    expect(notificationErrorCall).toBeDefined();
    expect((notificationErrorCall as { notificationError: string }).notificationError).toBe('customer:TIMEOUT');
  });

  // 계획서 §4: 믹싱은 날짜 티어가 아니라 "작업 착수" 하나로만 갈린다 — received면 전액 환불,
  // in_progress·delivered는 고객 셀프 취소가 막히고 관리자 임의 환불만 남는다.
  describe('믹싱·마스터링 주문(work_orders) 취소', () => {
    const mixingOrder = (over: Record<string, unknown> = {}) => ({
      id: 'o1', orderNo: 'SNB-1', status: 'paid', type: 'mixing', totalAmount: 220000,
      customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
      manageToken: 't',
      bookings: [],
      workOrders: [
        { id: 'w1', status: 'received', songCount: 1, vocalTuning: false, customerNote: null, cancelledAt: null },
      ],
      payments: [{ id: 'p1', paymentKey: 'pk' }],
      ...over,
    });

    it('received 상태의 고객 셀프 취소는 전액 환불로 성공한다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(mixingOrder());
      (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
      const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
      expect(r).toEqual({ ok: true, refundAmount: 220000 });
      expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: 220000 }));
      expect(sendMixingOrderCancelledEmails).toHaveBeenCalled();
      const db = mockDb();
      const orderStatusUpdate = setCallsOf(db).find((c) => 'status' in c);
      expect(orderStatusUpdate).toMatchObject({ status: 'refunded' });
    });

    it('in_progress 상태의 고객 셀프 취소는 착수 안내 문구로 거부되고 토스를 부르지 않는다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(
        mixingOrder({ workOrders: [{ id: 'w1', status: 'in_progress', songCount: 1, vocalTuning: false, customerNote: null, cancelledAt: null }] }),
      );
      const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
      expect(r).toEqual({
        ok: false, code: 'invalid_state',
        message: '작업이 시작된 주문은 온라인으로 취소할 수 없습니다. 010-4255-7893으로 문의해 주세요.',
      });
      expect(cancelPayment).not.toHaveBeenCalled();
    });

    it('in_progress 상태의 관리자 임의 환불은 허용된다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(
        mixingOrder({ workOrders: [{ id: 'w1', status: 'in_progress', songCount: 1, vocalTuning: false, customerNote: null, cancelledAt: null }] }),
      );
      (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
      const r = await cancelBookingWithRefund({
        orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 임의 환불', overrideAmount: 100000, now: NOW,
      });
      expect(r).toEqual({ ok: true, refundAmount: 100000 });
      expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: 100000 }));
    });

    it('delivered 상태의 관리자 임의 환불도 허용된다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(
        mixingOrder({ workOrders: [{ id: 'w1', status: 'delivered', songCount: 1, vocalTuning: false, customerNote: null, cancelledAt: null }] }),
      );
      (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
      const r = await cancelBookingWithRefund({
        orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 임의 환불', overrideAmount: 220000, now: NOW,
      });
      expect(r).toEqual({ ok: true, refundAmount: 220000 });
    });

    it('이미 취소된 주문(work_orders.status=cancelled)은 invalid_state로 거부한다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(
        mixingOrder({ workOrders: [{ id: 'w1', status: 'cancelled', songCount: 1, vocalTuning: false, customerNote: null, cancelledAt: NOW }] }),
      );
      const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'admin', reason: '관리자 임의 환불', now: NOW });
      expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
      expect(cancelPayment).not.toHaveBeenCalled();
    });
  });
});
