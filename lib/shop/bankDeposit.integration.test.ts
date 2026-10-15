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
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

/* eslint-disable import/first */
import { cancelAwaitingShopDeposit, confirmShopBankDeposit, deliverShopDepositGuide, notifyShopDepositWithdrawn } from './bankDeposit';
import { BANK_PAID_CUSTOMER_CANCEL_MESSAGE, cancelShopOrder } from './cancel';
import { createShopOrder, expireStaleShopOrders, findShopOrderByOrderNo, getRemainingStock } from './service';
import { cancelPayment } from '../booking/toss';
import { sendEmail } from '../email/resend';
import { SHOP_HOLD_SECONDS } from '../../data/shop/policy';
import { isBankDepositPayment } from '../payments/bankDeposit';
/* eslint-enable import/first */

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(shopSkus).values([{ id: 'test-cd-std', productSlug: 'test-cd', stock: 2 }]);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

const placeBankOrder = async (quantity = 1, now = new Date()) => {
  const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity }]), now, { salesOpen: true, paymentMethod: 'bank_transfer' });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  return r;
};

describe('계좌로 직접 입금 — 상점', () => {
  it('주문이 awaiting_deposit으로 바로 만들어지고 재고를 홀드 만료와 무관하게(기한 없이) 잡는다', async () => {
    const now = new Date();
    const o = await placeBankOrder(2, now);
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('awaiting_deposit');
    expect(o.manageToken).toBeTruthy();
    const later = new Date(now.getTime() + (SHOP_HOLD_SECONDS + 3600) * 1000);
    expect((await getRemainingStock(['test-cd-std'], later))['test-cd-std']).toBe(0);
    expect(await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), later, { salesOpen: true })).toEqual({ ok: false, code: 'sold_out' });
  });

  it('토스 홀드 만료 정리(expireStaleShopOrders)는 입금 대기를 건드리지 않는다 — 자동 취소 없음', async () => {
    const now = new Date();
    const o = await placeBankOrder(1, now);
    const cleaned = await expireStaleShopOrders(new Date(now.getTime() + 10 * 24 * 3600 * 1000));
    expect(cleaned).toBe(0);
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('awaiting_deposit');
  });

  it('입금 안내 메일 — 고객 한 통 + 운영자 한 통, 입금 대기가 아니면 보내지 않는다', async () => {
    const o = await placeBankOrder();
    expect(await deliverShopDepositGuide(o.orderNo)).toBeNull();
    const recipients = (sendEmail as jest.Mock).mock.calls.map((c) => c[0].to);
    expect(recipients).toHaveLength(2);
    await confirmShopBankDeposit({ orderNo: o.orderNo, now: new Date() });
    (sendEmail as jest.Mock).mockClear();
    expect(await deliverShopDepositGuide(o.orderNo)).toBe('invalid_state');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('입금 확인 → paid + bank-deposit 결제 행 + 확정 메일, 두 번째 확인은 거절', async () => {
    const o = await placeBankOrder();
    const r = await confirmShopBankDeposit({ orderNo: o.orderNo, now: new Date() });
    expect(r).toEqual({ ok: true });
    const order = await findShopOrderByOrderNo(o.orderNo);
    expect(order!.status).toBe('paid');
    expect(order!.payments).toHaveLength(1);
    expect(isBankDepositPayment(order!.payments[0])).toBe(true);
    expect(order!.payments[0].method).toBe('계좌 입금');
    expect((sendEmail as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(await confirmShopBankDeposit({ orderNo: o.orderNo, now: new Date() })).toMatchObject({ ok: false, code: 'invalid_state' });
    expect((await getRemainingStock(['test-cd-std'], new Date()))['test-cd-std']).toBe(1);
  });

  it('미입금 취소 → deposit_cancelled, 재고가 풀리고, 닫힌 신청은 입금 확인할 수 없다(메일 없음)', async () => {
    const o = await placeBankOrder(2);
    expect(await cancelAwaitingShopDeposit({ orderNo: o.orderNo })).toEqual({ ok: true });
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('deposit_cancelled');
    expect((await getRemainingStock(['test-cd-std'], new Date()))['test-cd-std']).toBe(2);
    expect(await confirmShopBankDeposit({ orderNo: o.orderNo, now: new Date() })).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(await cancelAwaitingShopDeposit({ orderNo: o.orderNo })).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('고객이 입금 전에 취소하면 운영자에게만 알린다', async () => {
    const o = await placeBankOrder();
    await cancelAwaitingShopDeposit({ orderNo: o.orderNo });
    await notifyShopDepositWithdrawn(o.orderNo);
    const mails = (sendEmail as jest.Mock).mock.calls.map((c) => c[0]);
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toContain('계좌 입금 신청 취소');
  });

  it('계좌 입금으로 확정된 주문은 고객이 셀프 취소할 수 없다 — 안내만, 상태·재고는 그대로', async () => {
    const o = await placeBankOrder();
    await confirmShopBankDeposit({ orderNo: o.orderNo, now: new Date() });
    const r = await cancelShopOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: '고객', now: new Date() });
    expect(r).toEqual({ ok: false, code: 'invalid_state', message: BANK_PAID_CUSTOMER_CANCEL_MESSAGE });
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('paid');
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it('운영자 환불은 토스를 부르지 않고 기록만 남긴다 — 주문 refunded, 재고가 돌아온다', async () => {
    const o = await placeBankOrder(2);
    await confirmShopBankDeposit({ orderNo: o.orderNo, now: new Date() });
    const r = await cancelShopOrder({ orderNo: o.orderNo, requestedBy: 'admin', reason: '반품', now: new Date() });
    expect(r).toMatchObject({ ok: true, refundAmount: o.totalAmount });
    expect(cancelPayment).not.toHaveBeenCalled();
    const order = await findShopOrderByOrderNo(o.orderNo);
    expect(order!.status).toBe('refunded');
    expect(order!.payments[0].refunds.map((x) => [x.status, x.amount])).toEqual([['done', o.totalAmount]]);
    expect((await getRemainingStock(['test-cd-std'], new Date()))['test-cd-std']).toBe(2);
  });
});
