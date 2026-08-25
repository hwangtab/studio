jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn() }));
jest.mock('./toss', () => ({ cancelPayment: jest.fn() }));
jest.mock('./gcal', () => ({ deleteBookingEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('./email', () => ({ sendBookingCancelledEmails: jest.fn().mockResolvedValue(null) }));
// getDb()가 매 호출 같은 객체를 돌려주도록 mock db를 factory 스코프에 고정한다 (confirm.test.ts와 동일 이유
// — cancel.ts도 한 실행 안에서 getDb()를 여러 번 부르므로 batch·insert·후처리 update가 같은 참조를 봐야 한다).
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

import { cancelBookingWithRefund } from './cancel';
import { findOrderByOrderNo } from './service';
import { cancelPayment } from './toss';
import { deleteBookingEvent } from './gcal';
import { sendBookingCancelledEmails } from './email';
import { getDb } from '../../db/client';

type MockDb = {
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
    expect(mockDb().batch).toHaveBeenCalled();
    const refundInsert = insertValuesCallsOf(mockDb()).find((c) => c.status === 'done');
    expect(refundInsert).toMatchObject({ amount: 0, status: 'done' });
    // 환불액 0원이면 orders.status는 그대로 유지된다.
    const orderStatusUpdate = setCallsOf(mockDb()).find((c) => 'status' in c && !('cancelledAt' in c));
    expect(orderStatusUpdate).toMatchObject({ status: 'paid' });
  });

  it('3일 전 취소는 전액 cancelPayment를 호출하고 orders를 refunded로 전환한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue(cancelOk);
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, refundAmount: 275000 });
    expect(cancelPayment).toHaveBeenCalledWith({ paymentKey: 'pk', cancelReason: '고객 셀프 취소', cancelAmount: 275000 });
    const db = mockDb();
    const bookingCancel = setCallsOf(db).find((c) => 'cancelledAt' in c);
    expect(bookingCancel).toMatchObject({ status: 'cancelled' });
    const orderStatusUpdate = setCallsOf(db).find((c) => 'status' in c && !('cancelledAt' in c));
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
    expect(cancelPayment).toHaveBeenCalledWith({ paymentKey: 'pk', cancelReason: '관리자 임의 환불', cancelAmount: 50000 });
    const orderStatusUpdate = setCallsOf(mockDb()).find((c) => 'status' in c && !('cancelledAt' in c));
    expect(orderStatusUpdate).toMatchObject({ status: 'partially_refunded' });
  });

  it('토스 취소가 실패하면 refunds에 failed로 기록하고 toss_failed를 반환한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'REJECT_CARD', message: '취소 불가 결제' });
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: false, code: 'toss_failed', message: '취소 불가 결제' });
    const failedRefund = insertValuesCallsOf(mockDb()).find((c) => c.status === 'failed');
    expect(failedRefund).toMatchObject({ amount: 275000, status: 'failed' });
    expect(mockDb().batch).not.toHaveBeenCalled();
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
});
