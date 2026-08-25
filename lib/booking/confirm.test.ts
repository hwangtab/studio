jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn() }));
jest.mock('./toss', () => ({ confirmPayment: jest.fn() }));
jest.mock('./gcal', () => ({ createBookingEvent: jest.fn().mockResolvedValue('evt1') }));
jest.mock('./email', () => ({ sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null) }));
jest.mock('../../db/client', () => ({
  getDb: () => ({
    batch: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({}) }),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({}) }) }),
    run: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
  }),
}));

import { confirmBookingPayment } from './confirm';
import { findOrderByOrderNo } from './service';
import { confirmPayment } from './toss';

const order = (over: object = {}) => ({
  id: 'o1', orderNo: 'SNB-1', status: 'pending', totalAmount: 275000,
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
  manageToken: 't', bookings: [{ id: 'b1', status: 'pending', startAt: new Date(), endAt: new Date(), durationHours: 3, serviceType: 'recording', customerNote: null }],
  payments: [], ...over,
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
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 275000 } });
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
  });
});
