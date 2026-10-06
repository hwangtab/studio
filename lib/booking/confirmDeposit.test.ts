jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn(), PENDING_HOLD_SECONDS: 900 }));
jest.mock('./toss', () => ({
  ...jest.requireActual('./toss'),
  confirmPayment: jest.fn(),
  fetchPayment: jest.fn(),
  cancelPayment: jest.fn(),
}));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../db/client', () => {
  const batch = jest.fn().mockResolvedValue([{ rowsAffected: 1 }, { rowsAffected: 1 }]);
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

import { confirmDepositPayment } from './confirmDeposit';
import { findOrderByOrderNo } from './service';
import { cancelPayment, confirmPayment, fetchPayment } from './toss';
import { sendEmail } from '../email/resend';
import { getDb } from '../../db/client';

type MockDb = { batch: jest.Mock; run: jest.Mock; insert: jest.Mock; query: { payments: { findFirst: jest.Mock } } };
const mockDb = () => getDb() as unknown as MockDb;

const order = (over: object = {}) => ({
  id: 'o1', orderNo: 'SNB-1', status: 'pending', type: 'deposit', totalAmount: 400000,
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
  manageToken: 't', bookings: [], workOrders: [], payments: [], ...over,
});
const doneToss = {
  ok: true,
  payment: { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 400000, method: '카드', receipt: { url: 'https://r/1' } },
};

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
beforeEach(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => { consoleErrorSpy.mockRestore(); jest.clearAllMocks(); });

describe('confirmDepositPayment', () => {
  it('금액이 주문과 다르면 토스를 부르지 않고 거절한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 1000 });
    expect(r).toMatchObject({ ok: false, code: 'amount_mismatch' });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('deposit이 아닌 주문(세션 등)은 이 경로로 확정하지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ type: 'session' }));
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('주문이 없으면 not_found', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(undefined);
    expect(await confirmDepositPayment({ orderNo: 'X', paymentKey: 'pk', amount: 1 })).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('승인 성공 — payments INSERT + orders paid 전이를 한 batch로, 운영자 메일 1통, 영수증 반환', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(doneToss);
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1', totalAmount: 400000, receiptUrl: 'https://r/1' });
    expect(confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'SNB-1', amount: 400000 }));
    expect(mockDb().batch).toHaveBeenCalledTimes(1);
    expect(mockDb().batch.mock.calls[0][0]).toHaveLength(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(mail.text).toContain('예약금 결제가 완료되었습니다');
    expect(mail.html).toContain('400,000원');
    expect(mail.html).toContain('/admin/bookings/o1"');
    expect(mail.html).toContain('https://r/1');
  });

  it('승인 응답이 DONE이 아니면 확정하지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { ...doneToss.payment, status: 'WAITING_FOR_DEPOSIT' } });
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
    expect(mockDb().batch).not.toHaveBeenCalled();
  });

  it('운영자 메일이 실패해도 결제 확정은 유지된다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(doneToss);
    (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('smtp'));
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: true });
  });

  describe('이미 paid인 주문 (새로고침·웹훅 중복)', () => {
    const paid = () => order({ status: 'paid', payments: [{ paymentKey: 'pk', receiptUrl: 'https://r/1' }] });

    it('그 주문의 실제 paymentKey + 금액이면 재승인 없이 성공하고 메일을 다시 보내지 않는다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(paid());
      const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
      expect(r).toEqual({ ok: true, orderNo: 'SNB-1', totalAmount: 400000, receiptUrl: 'https://r/1' });
      expect(confirmPayment).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('소유 증명(paymentKey)이 없으면 성공으로 돌려주지 않는다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(paid());
      const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'other', amount: 400000 });
      expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    });

    it('웹훅 경로는 paymentKey 증명 없이 멱등 성공한다', async () => {
      (findOrderByOrderNo as jest.Mock).mockResolvedValue(paid());
      const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 }, { trustedByWebhook: true });
      expect(r).toMatchObject({ ok: true });
      expect(confirmPayment).not.toHaveBeenCalled();
    });
  });

  it('토스가 이미 처리된 결제(ALREADY_PROCESSED)를 알리면 재조회로 검증한 뒤 기록한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'ALREADY_PROCESSED_PAYMENT', message: 'x' });
    (fetchPayment as jest.Mock).mockResolvedValue(doneToss);
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: true });
    expect(mockDb().batch).toHaveBeenCalledTimes(1);
  });

  it('재조회 결과가 주문과 다르면 기록하지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'ALREADY_PROCESSED_PAYMENT', message: 'x' });
    (fetchPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { ...doneToss.payment, totalAmount: 1 } });
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: false, code: 'toss_rejected' });
    expect(mockDb().batch).not.toHaveBeenCalled();
  });

  it('카드 거절(allowlist 코드)만 주문을 failed로 낙인하고, 모르는 코드는 건드리지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'REJECT_CARD_COMPANY', message: '카드사 거절' });
    const declined = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(declined).toMatchObject({ ok: false, code: 'toss_rejected', message: '카드사 거절' });
    expect(mockDb().run).toHaveBeenCalledTimes(1);

    mockDb().run.mockClear();
    (confirmPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'UNAUTHORIZED_KEY', message: '비밀' });
    const unknown = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(unknown).toMatchObject({ ok: false, code: 'toss_rejected' });
    expect((unknown as { message: string }).message).not.toContain('비밀');
    expect(mockDb().run).not.toHaveBeenCalled();
  });

  it('paymentKey unique 위반(동시 확정에서 다른 쪽이 이김)은 멱등 성공이다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(doneToss);
    mockDb().batch.mockRejectedValueOnce(new Error('UNIQUE constraint failed: payments.payment_key'));
    mockDb().query.payments.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('DB 기록이 진짜 실패하면 recording_failed(웹훅 복구 대상)다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(doneToss);
    mockDb().batch.mockRejectedValueOnce(new Error('db down'));
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: false, code: 'recording_failed' });
  });

  it('승인 뒤 orders 전이가 0행이면 전액 자동 취소한다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue(doneToss);
    mockDb().batch.mockResolvedValueOnce([{ rowsAffected: 1 }, { rowsAffected: 0 }]);
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { cancels: [{ transactionKey: 'tx' }] } });
    mockDb().query.payments.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentKey: 'pk', cancelAmount: 400000 }));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('웹훅 경로는 failed·expired 주문도 확정한다 (이미 승인된 돈)', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'failed' }));
    (confirmPayment as jest.Mock).mockResolvedValue(doneToss);
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 }, { trustedByWebhook: true });
    expect(r).toMatchObject({ ok: true });
  });

  it('브라우저 경로는 failed 주문을 확정하지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'failed' }));
    const r = await confirmDepositPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(confirmPayment).not.toHaveBeenCalled();
  });
});
