import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shopPayload } from '../../tests/helpers/shopFixtures';
import { shopSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../booking/toss', () => ({
  ...jest.requireActual('../booking/toss'),
  confirmPayment: jest.fn(),
  fetchPayment: jest.fn(),
  cancelPayment: jest.fn(),
}));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import { confirmShopOrder } from './confirm';
import { cancelShopOrder } from './cancel';
import { markShopOrderShipped } from './fulfillment';
import { createShopOrder, findShopOrderByOrderNo, getRemainingStock } from './service';
import { cancelPayment, confirmPayment } from '../booking/toss';
import { sendEmail } from '../email/resend';
import { SHOP_HOLD_SECONDS } from '../../data/shop/policy';
/* eslint-enable import/first */

const done = (orderNo: string, totalAmount: number, paymentKey = `pk-${orderNo}`) => ({
  ok: true as const,
  payment: { paymentKey, orderId: orderNo, status: 'DONE', totalAmount, method: '계좌이체', approvedAt: new Date().toISOString(), receipt: { url: 'https://r/1' } },
});
const cancelled = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'CANCELED', totalAmount, cancels: [{ cancelAmount: totalAmount, transactionKey: `tx-${orderNo}` }] },
});

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(shopSkus).values([{ id: 'test-cd-std', productSlug: 'test-cd', stock: 2 }]);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

const placeOrder = async (quantity = 1, now = new Date()) => {
  const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity }]), now, { salesOpen: true });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  return r;
};

describe('confirmShopOrder', () => {
  it('승인 → paid + 결제 행, 고객·운영자 메일, 관리 토큰을 돌려준다', async () => {
    const o = await placeOrder();
    (confirmPayment as jest.Mock).mockResolvedValue(done(o.orderNo, o.totalAmount));
    const r = await confirmShopOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount });
    expect(r).toMatchObject({ ok: true, orderNo: o.orderNo, receiptUrl: 'https://r/1' });
    const order = await findShopOrderByOrderNo(o.orderNo);
    expect(order!.status).toBe('paid');
    expect(order!.payments).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('금액이 다르면 토스를 부르지 않는다', async () => {
    const o = await placeOrder();
    const r = await confirmShopOrder({ orderNo: o.orderNo, paymentKey: 'pk', amount: o.totalAmount - 1 });
    expect(r).toMatchObject({ ok: false, code: 'amount_mismatch' });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('새로고침 재생 — paymentKey·금액이 맞으면 성공, 다르면 관리 토큰을 주지 않는다. 메일은 다시 안 간다', async () => {
    const o = await placeOrder();
    (confirmPayment as jest.Mock).mockResolvedValue(done(o.orderNo, o.totalAmount));
    await confirmShopOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount });
    (sendEmail as jest.Mock).mockClear();
    expect(await confirmShopOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount })).toMatchObject({ ok: true });
    expect(await confirmShopOrder({ orderNo: o.orderNo, paymentKey: 'other', amount: o.totalAmount })).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(confirmPayment).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('홀드가 끝난 사이 재고가 다른 주문에 팔렸으면 — 승인된 돈을 전액 자동 취소하고 sold_out', async () => {
    const t0 = new Date(Date.now() - (SHOP_HOLD_SECONDS + 60) * 1000);
    const late = await placeOrder(2, t0); // 홀드가 이미 끝난 주문
    const other = await placeOrder(2); // 그 사이 같은 재고를 잡은 주문
    (confirmPayment as jest.Mock).mockResolvedValueOnce(done(other.orderNo, other.totalAmount));
    expect(await confirmShopOrder({ orderNo: other.orderNo, paymentKey: `pk-${other.orderNo}`, amount: other.totalAmount })).toMatchObject({ ok: true });

    (confirmPayment as jest.Mock).mockResolvedValueOnce(done(late.orderNo, late.totalAmount));
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(late.orderNo, late.totalAmount));
    const r = await confirmShopOrder({ orderNo: late.orderNo, paymentKey: `pk-${late.orderNo}`, amount: late.totalAmount });
    expect(r).toMatchObject({ ok: false, code: 'sold_out' });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: late.totalAmount, idempotencyKey: `autocancel:${late.orderNo}:${late.totalAmount}` }));
    const order = await findShopOrderByOrderNo(late.orderNo);
    expect(order!.status).toBe('refunded');
    expect(order!.shopOrder!.fulfillmentStatus).toBe('cancelled');
    expect(order!.payments[0].refunds).toEqual([expect.objectContaining({ amount: late.totalAmount, status: 'done' })]);
    // 팔린 쪽 2개만 점유 — 이중 판매 없음.
    expect((await getRemainingStock(['test-cd-std'], new Date()))['test-cd-std']).toBe(0);
  });

  it('카드사 거절은 failed로 닫고, 네트워크 오류는 상태를 건드리지 않는다(재시도 대상)', async () => {
    const a = await placeOrder();
    (confirmPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'REJECT_CARD_COMPANY', message: '거절' });
    expect(await confirmShopOrder({ orderNo: a.orderNo, paymentKey: 'pk', amount: a.totalAmount })).toMatchObject({ ok: false, code: 'toss_rejected' });
    expect((await findShopOrderByOrderNo(a.orderNo))!.status).toBe('failed');

    const b = await placeOrder();
    (confirmPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'NETWORK_ERROR', message: 'x' });
    expect(await confirmShopOrder({ orderNo: b.orderNo, paymentKey: 'pk', amount: b.totalAmount })).toMatchObject({ ok: false, code: 'toss_rejected' });
    expect((await findShopOrderByOrderNo(b.orderNo))!.status).toBe('pending');
  });
});

describe('cancelShopOrder · markShopOrderShipped', () => {
  const paidOrder = async () => {
    const o = await placeOrder(2);
    (confirmPayment as jest.Mock).mockResolvedValueOnce(done(o.orderNo, o.totalAmount));
    await confirmShopOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount });
    return o;
  };

  it('고객이 발송 전에 취소하면 토스로 전액 환불하고 재고가 돌아온다', async () => {
    const o = await paidOrder();
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(o.orderNo, o.totalAmount));
    const r = await cancelShopOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: '고객 취소', now: new Date() });
    expect(r).toEqual({ ok: true, refundAmount: o.totalAmount });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentKey: `pk-${o.orderNo}`, cancelAmount: o.totalAmount, idempotencyKey: `refund:${o.orderNo}:${o.totalAmount}` }));
    const order = await findShopOrderByOrderNo(o.orderNo);
    expect(order!.status).toBe('refunded');
    expect(order!.shopOrder!.fulfillmentStatus).toBe('cancelled');
    expect((await getRemainingStock(['test-cd-std'], new Date()))['test-cd-std']).toBe(2);
  });

  it('보낸 뒤에는 고객 취소를 막고, 운영자 환불(반품)은 된다', async () => {
    const o = await paidOrder();
    expect(await markShopOrderShipped({ orderNo: o.orderNo, courier: '아무택배', trackingNumber: '1234' })).toMatchObject({ ok: false });
    expect(await markShopOrderShipped({ orderNo: o.orderNo, courier: 'CJ대한통운', trackingNumber: '1234' })).toEqual({ ok: true });
    expect(await cancelShopOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: false, code: 'shipped' });
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(o.orderNo, o.totalAmount));
    expect(await cancelShopOrder({ orderNo: o.orderNo, requestedBy: 'admin', reason: '반품', now: new Date() })).toMatchObject({ ok: true });
  });

  it('토스가 취소를 거절하면 선점을 되돌려 다시 시도할 수 있다', async () => {
    const o = await paidOrder();
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'NOT_CANCELABLE_PAYMENT', message: '취소 불가' });
    expect(await cancelShopOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: false, code: 'toss_failed' });
    const order = await findShopOrderByOrderNo(o.orderNo);
    expect(order!.status).toBe('paid');
    expect(order!.shopOrder!.fulfillmentStatus).toBe('preparing');
  });

  it('결제 전 주문에는 운송장을 붙이지 않는다', async () => {
    const o = await placeOrder();
    expect(await markShopOrderShipped({ orderNo: o.orderNo, courier: 'CJ대한통운', trackingNumber: '1' })).toMatchObject({ ok: false });
  });
});
