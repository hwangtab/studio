// PENDING_HOLD_SECONDS도 함께 노출한다 — confirm.ts가 선점 만료를 스스로 판정할 때 쓴다.
jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn(), PENDING_HOLD_SECONDS: 900 }));
jest.mock('./toss', () => ({ confirmPayment: jest.fn(), fetchPayment: jest.fn() }));
jest.mock('./gcal', () => ({ createBookingEvent: jest.fn().mockResolvedValue('evt1') }));
jest.mock('./email', () => ({ sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null) }));
// getDb()가 매 호출 같은 객체를 돌려주도록 mock db를 factory 스코프에 고정한다 —
// confirm.ts는 한 실행 안에서 getDb()를 여러 번 부르므로(toss_rejected 분기 / batch / 후처리),
// 테스트가 batch·payments 조회 결과를 mockResolvedValueOnce 등으로 제어하려면 같은 참조가 필요하다.
jest.mock('../../db/client', () => {
  const batch = jest.fn().mockResolvedValue([]);
  const run = jest.fn().mockResolvedValue({ rowsAffected: 1 });
  const paymentsFindFirst = jest.fn().mockResolvedValue(undefined);
  const insertValues = jest.fn().mockReturnValue({});
  const insert = jest.fn().mockReturnValue({ values: insertValues });
  const updateWhere = jest.fn().mockReturnValue({});
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });
  const db = { batch, run, insert, update, query: { payments: { findFirst: paymentsFindFirst } } };
  return { getDb: () => db };
});

import { confirmBookingPayment } from './confirm';
import { findOrderByOrderNo } from './service';
import { confirmPayment, fetchPayment } from './toss';
import { createBookingEvent } from './gcal';
import { sendBookingConfirmedEmails } from './email';
import { getDb } from '../../db/client';

type MockDb = {
  batch: jest.Mock;
  run: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  query: { payments: { findFirst: jest.Mock } };
};

const mockDb = () => getDb() as unknown as MockDb;

/** db.update(...).set(...) 호출 인자 전체 — update 체인은 테이블과 무관하게 같은 updateSet mock을 공유한다. */
const setCallsOf = (db: MockDb): object[] =>
  db.update.mock.results.length
    ? (db.update.mock.results[0].value.set as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as object)
    : [];

/** db.insert(...).values(...) 호출 인자 전체 — insert 체인도 테이블과 무관하게 같은 values mock을 공유한다. */
const insertValuesCallsOf = (db: MockDb): Record<string, unknown>[] =>
  db.insert.mock.results.length
    ? (db.insert.mock.results[0].value.values as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>)
    : [];

const order = (over: object = {}) => ({
  id: 'o1', orderNo: 'SNB-1', status: 'pending', totalAmount: 275000,
  // 선점 만료 판정의 기준 — 기본값은 "방금 만든 주문"이라 만료 검사에 걸리지 않는다.
  createdAt: new Date(),
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
  manageToken: 't', bookings: [{ id: 'b1', status: 'pending', startAt: new Date(), endAt: new Date(), durationHours: 3, serviceType: 'recording', customerNote: null }],
  payments: [], ...over,
});

const paidToss = { ok: true, payment: { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 275000 } };

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  jest.clearAllMocks();
});

describe('confirmBookingPayment', () => {
  it('금액 불일치면 토스를 부르지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 1000 });
    expect(r).toMatchObject({ ok: false, code: 'amount_mismatch' });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('이미 paid면 재승인 없이 성공 (새로고침 멱등)', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'paid' }));
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toMatchObject({ ok: true });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('정상 경로는 토스 승인 후 성공', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
  });

  it('토스가 거절하면 orders를 failed로 마킹하고 토스 메시지를 그대로 전달한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'REJECT_CARD', message: '한도 초과' });
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: false, code: 'toss_rejected', message: '한도 초과' });
    expect(mockDb().run).toHaveBeenCalled();
  });

  it('CONFIG_ERROR는 고객에게 일반 문구로 치환하고 원문은 서버 로그에만 남긴다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue({
      ok: false, code: 'CONFIG_ERROR', message: 'TOSS_SECRET_KEY가 설정되지 않았습니다.',
    });
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({
      ok: false, code: 'toss_rejected',
      message: '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('NETWORK_ERROR도 CONFIG_ERROR와 같은 일반 문구로 치환한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'fetch failed' });
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({
      ok: false, code: 'toss_rejected',
      message: '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    });
  });

  // ALREADY_PROCESSED_PAYMENT는 "실패"가 아니라 "우리 DB만 뒤처졌다"는 신호다. 웹훅 DONE 복구와
  // success 페이지 이중 새로고침이 여기로 온다 — failed로 마킹하면 돈이 들어온 주문이 실패로 확정된다.
  const alreadyProcessed = { ok: false, code: 'ALREADY_PROCESSED_PAYMENT', message: '이미 처리된 결제 입니다.' };

  it('ALREADY_PROCESSED_PAYMENT면 재조회로 승인을 확인하고 정상 확정 경로로 기록한다 (failed 마킹 금지)', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(alreadyProcessed);
    (fetchPayment as jest.Mock).mockResolvedValue({
      ok: true,
      payment: { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 275000, method: '카드' },
    });
    const db = mockDb();
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
    expect(db.batch).toHaveBeenCalled(); // 정상 승인과 같은 batch 경로
    expect(db.run).not.toHaveBeenCalled(); // orders를 failed로 마킹하는 db.run이 없다
    // rawResponse는 재조회한 payment로 남는다.
    const paymentInsert = insertValuesCallsOf(db).find((c) => 'paymentKey' in c);
    expect(paymentInsert).toMatchObject({ paymentKey: 'pk', method: '카드' });
  });

  it('ALREADY_PROCESSED_PAYMENT인데 재조회 금액이 다르면 기록도 failed 마킹도 하지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(alreadyProcessed);
    (fetchPayment as jest.Mock).mockResolvedValue({
      ok: true,
      payment: { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 100000 },
    });
    const db = mockDb();
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({
      ok: false, code: 'toss_rejected',
      message: '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    });
    expect(db.batch).not.toHaveBeenCalled();
    expect(db.run).not.toHaveBeenCalled(); // 재시도 여지를 남긴다 — pending 그대로
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('ALREADY_PROCESSED_PAYMENT인데 재조회 자체가 실패하면 판정을 보류한다 (failed 마킹 금지)', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(alreadyProcessed);
    (fetchPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', message: 'fetch failed' });
    const db = mockDb();
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
    expect(db.batch).not.toHaveBeenCalled();
    expect(db.run).not.toHaveBeenCalled();
  });

  // H-2 회귀: 결제창을 900초 넘게 방치한 pending 주문. expireStaleOrders는 슬롯 조회·관리자
  // 목록에서만 lazy 호출되므로 status는 아직 'pending'이고, 그 사이 겹침 검사(900초 지난
  // pending은 무시)를 통과한 다른 고객이 같은 슬롯을 확정했을 수 있다. 여기서 승인을 부르면
  // 같은 슬롯에 confirmed 예약 2건이 생긴다 — 승인 전이므로 거부는 과금 없이 끝난다.
  describe('선점 만료(PENDING_HOLD_SECONDS) 주문', () => {
    const staleOrder = () => order({ createdAt: new Date(Date.now() - 901 * 1000) });

    it('900초가 지난 pending 주문은 토스 승인을 부르지 않고 invalid_state로 거부한다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(staleOrder());
      const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
      expect(r).toEqual({
        ok: false, code: 'invalid_state',
        message: '결제 대기 시간이 만료된 주문입니다. 슬롯이 해제되었으니 다시 예약해 주세요.',
      });
      expect(confirmPayment).not.toHaveBeenCalled(); // 돈이 움직이기 전에 멈춘다
      expect(mockDb().batch).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[booking-confirm] 선점 만료 주문의 승인 요청 — 토스를 부르지 않고 거부',
        expect.objectContaining({ orderNo: 'SNB-1' }),
      );
    });

    it('웹훅이 만료 주문을 들고 와도 영구 실패(invalid_state)라 재시도 루프를 만들지 않는다', async () => {
      // webhook.ts의 isTransientConfirmFailure가 invalid_state를 영구 실패로 보고 200으로 끝낸다.
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(staleOrder());
      const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
      expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    });

    it('900초 이내면 평소대로 승인한다 (경계 회귀 — 정상 결제를 막지 않는다)', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ createdAt: new Date(Date.now() - 899 * 1000) }));
      (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
      const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
      expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
      expect(confirmPayment).toHaveBeenCalled();
    });

    it('이미 paid인 주문은 만료 검사보다 먼저 멱등 성공으로 답한다 (뒤늦은 새로고침이 깨지지 않는다)', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'paid', createdAt: new Date(Date.now() - 86400 * 1000) }));
      const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
      expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
    });
  });

  it('토스 승인 후 DB 기록이 실패하고 payments에도 없으면 recording_failed', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
    const db = mockDb();
    db.batch.mockRejectedValueOnce(new Error('DB 커넥션 끊김'));
    db.query.payments.findFirst.mockResolvedValueOnce(undefined);
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({
      ok: false,
      code: 'recording_failed',
      message: '결제는 완료되었으나 예약 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('DB 기록이 실패했지만 payments에 이미 있으면 동시 확정에서 다른 쪽이 이긴 것 — 성공(멱등)', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
    const db = mockDb();
    db.batch.mockRejectedValueOnce(new Error('UNIQUE constraint failed: payments.payment_key'));
    db.query.payments.findFirst.mockResolvedValueOnce({ id: 'p1', paymentKey: 'pk' });
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
  });

  it('batch도 멱등 판정 조회도 둘 다 실패하면 throw 대신 recording_failed로 떨어진다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
    const db = mockDb();
    db.batch.mockRejectedValueOnce(new Error('DB 커넥션 끊김'));
    db.query.payments.findFirst.mockRejectedValueOnce(new Error('같은 커넥션도 죽음'));
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({
      ok: false,
      code: 'recording_failed',
      message: '결제는 완료되었으나 예약 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('gcal 실패 시 bookings.gcalError 기록이 호출되고 승인 결과는 성공으로 유지된다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
    (createBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('캘린더 이벤트 생성 실패: 500'));
    const db = mockDb();
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
    const gcalErrorCall = setCallsOf(db).find((c) => 'gcalError' in c);
    expect(gcalErrorCall).toBeDefined();
    expect((gcalErrorCall as { gcalError: string }).gcalError).toContain('캘린더 이벤트 생성 실패: 500');
  });

  it('이메일 발송이 실패하면 orders.notificationError 기록이 호출된다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
    (sendBookingConfirmedEmails as jest.Mock).mockResolvedValueOnce('customer:TIMEOUT');
    const db = mockDb();
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
    const notificationErrorCall = setCallsOf(db).find((c) => 'notificationError' in c);
    expect(notificationErrorCall).toBeDefined();
    expect((notificationErrorCall as { notificationError: string }).notificationError).toBe('customer:TIMEOUT');
  });

  it('bookings가 없는 주문은 후처리를 생략하고 방어 로그만 남긴 채 성공을 반환한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ bookings: [] }));
    (confirmPayment as jest.Mock).mockResolvedValue(paidToss);
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
    expect(createBookingEvent).not.toHaveBeenCalled();
    expect(sendBookingConfirmedEmails).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[booking-confirm] bookings 없는 주문 — 후처리 생략',
      expect.objectContaining({ orderNo: 'SNB-1' }),
    );
  });
});
