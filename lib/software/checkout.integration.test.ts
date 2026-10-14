import { generateKeyPairSync } from 'crypto';
import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/software/catalog', () => ({
  ...jest.requireActual('../../data/software/catalog'),
  SOFTWARE_PRODUCTS: jest.requireActual('../../tests/helpers/softwareFixtures').SOFTWARE_FIXTURE_PRODUCTS,
}));
jest.mock('../booking/toss', () => ({
  ...jest.requireActual('../booking/toss'),
  confirmPayment: jest.fn(),
  fetchPayment: jest.fn(),
  cancelPayment: jest.fn(),
}));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import { cancelSoftwareOrder, refundLicensesOnFullCancel } from './cancel';
import { confirmSoftwareOrder } from './confirm';
import { createSoftwareOrder, expireStaleSoftwareOrders, findSoftwareOrder } from './order';
import { activateLicense } from './service';
import { cancelPayment, confirmPayment } from '../booking/toss';
import { sendEmail } from '../email/resend';
/* eslint-enable import/first */

const signer = { kid: 'k-test', key: generateKeyPairSync('ed25519').privateKey };
const contact = { customerName: '김구매', customerPhone: '010-1234-5678', customerEmail: 'Buyer@Example.com' };
const body = { productSlug: 'test-plugin', priceId: 'test-plugin-v2', withdrawalAck: true, ...contact };

const done = (orderNo: string, totalAmount: number, paymentKey = `pk-${orderNo}`) => ({
  ok: true as const,
  payment: { paymentKey, orderId: orderNo, status: 'DONE', totalAmount, method: '카드', approvedAt: new Date().toISOString(), receipt: { url: 'https://r/1' } },
});
const cancelled = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'CANCELED', totalAmount, cancels: [{ cancelAmount: totalAmount, transactionKey: `tx-${orderNo}` }] },
});

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

const place = async (now = new Date()) => {
  const r = await createSoftwareOrder({ ...body }, now, { salesOpen: true });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  return r;
};
const placeAndPay = async () => {
  const o = await place();
  (confirmPayment as jest.Mock).mockResolvedValue(done(o.orderNo, o.totalAmount));
  const r = await confirmSoftwareOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount });
  if (!r.ok) throw new Error(`setup confirm: ${r.code}`);
  return o;
};

describe('createSoftwareOrder', () => {
  it('판매가 닫혀 있으면 만들지 않는다', async () => {
    expect(await createSoftwareOrder({ ...body }, new Date(), { salesOpen: false })).toEqual({ ok: false, code: 'sales_closed' });
  });

  it('금액·상품명은 카탈로그의 지금 가격(맨 앞)에서 — 옛 가격 id·동의 없는 주문은 거절', async () => {
    const r = await place();
    expect(r).toMatchObject({ ok: true, totalAmount: 69000, orderName: '테스트 플러그인 라이선스' });
    expect(r.orderNo).toMatch(/^SWR-\d{8}-[0-9A-F]{8}$/);
    const order = await findSoftwareOrder(r.orderNo);
    expect(order).toMatchObject({ type: 'software', status: 'pending', totalAmount: 69000 });
    expect(order!.itemAmount + order!.vatAmount).toBe(69000);
    expect(order!.item).toMatchObject({ productSlug: 'test-plugin', priceId: 'test-plugin-v2', unitPrice: 69000 });
    expect(order!.item!.withdrawalAckAt).toBeInstanceOf(Date);

    expect(await createSoftwareOrder({ ...body, priceId: 'test-plugin-v1' }, new Date(), { salesOpen: true })).toEqual({ ok: false, code: 'unknown_item' });
    expect(await createSoftwareOrder({ ...body, productSlug: 'test-app' }, new Date(), { salesOpen: true })).toEqual({ ok: false, code: 'unknown_item' });
    expect(await createSoftwareOrder({ ...body, withdrawalAck: false }, new Date(), { salesOpen: true })).toEqual({ ok: false, code: 'withdrawal_ack_required' });
    expect(await createSoftwareOrder({ ...body, customerPhone: '123' }, new Date(), { salesOpen: true })).toMatchObject({ ok: false, code: 'invalid_contact' });
  });

  it('한 시간 넘게 결제 대기인 주문은 크론이 expired로 닫는다', async () => {
    const r = await place(new Date(Date.now() - 2 * 3600 * 1000));
    await testDb.run(sql`UPDATE orders SET created_at = unixepoch() - 7200 WHERE order_no = ${r.orderNo}`);
    expect(await expireStaleSoftwareOrders(new Date())).toBe(1);
    expect((await findSoftwareOrder(r.orderNo))!.status).toBe('expired');
  });
});

describe('confirmSoftwareOrder', () => {
  it('승인 → paid + 결제 행 + 라이선스 한 개(구매자 이메일, 상품 기기 수), 메일 두 통', async () => {
    const o = await placeAndPay();
    const order = await findSoftwareOrder(o.orderNo);
    expect(order!.status).toBe('paid');
    expect(order!.payments).toHaveLength(1);
    expect(order!.licenses).toHaveLength(1);
    expect(order!.licenses[0]).toMatchObject({ source: 'toss', email: 'buyer@example.com', maxActivations: 2, status: 'active', productSlug: 'test-plugin' });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const customerMail = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].to === 'Buyer@Example.com')[0];
    expect(customerMail.text).toContain(order!.licenses[0].licenseKey);
  });

  it('새로고침·웹훅 재생은 라이선스를 더 만들지 않고 메일도 다시 안 간다', async () => {
    const o = await placeAndPay();
    (sendEmail as jest.Mock).mockClear();
    expect(await confirmSoftwareOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount })).toMatchObject({ ok: true });
    expect(await confirmSoftwareOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount }, { trustedByWebhook: true })).toMatchObject({ ok: true });
    expect(await confirmSoftwareOrder({ orderNo: o.orderNo, paymentKey: 'other', amount: o.totalAmount })).toMatchObject({ ok: false, code: 'invalid_state' });
    expect((await findSoftwareOrder(o.orderNo))!.licenses).toHaveLength(1);
    expect(confirmPayment).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('금액이 다르면 토스를 부르지 않는다', async () => {
    const o = await place();
    expect(await confirmSoftwareOrder({ orderNo: o.orderNo, paymentKey: 'pk', amount: o.totalAmount - 1 })).toMatchObject({ ok: false, code: 'amount_mismatch' });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('웹훅은 만료된 주문도 확정한다(재조회로 검증된 돈)', async () => {
    const o = await place();
    await testDb.run(sql`UPDATE orders SET status = 'expired' WHERE order_no = ${o.orderNo}`);
    (confirmPayment as jest.Mock).mockResolvedValue(done(o.orderNo, o.totalAmount));
    expect(await confirmSoftwareOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount })).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(await confirmSoftwareOrder({ orderNo: o.orderNo, paymentKey: `pk-${o.orderNo}`, amount: o.totalAmount }, { trustedByWebhook: true })).toMatchObject({ ok: true });
    expect((await findSoftwareOrder(o.orderNo))!.licenses).toHaveLength(1);
  });
});

describe('cancelSoftwareOrder', () => {
  it('고객: 활성화 전이면 전액 환불, 라이선스는 refunded가 되어 활성화를 거절한다', async () => {
    const o = await placeAndPay();
    (cancelPayment as jest.Mock).mockResolvedValue(cancelled(o.orderNo, o.totalAmount));
    expect(await cancelSoftwareOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: 't', now: new Date() })).toEqual({ ok: true, refundAmount: 69000 });
    const order = await findSoftwareOrder(o.orderNo);
    expect(order!.status).toBe('refunded');
    expect(order!.licenses[0].status).toBe('refunded');
    expect(await activateLicense({ key: order!.licenses[0].licenseKey, product: 'test-plugin', machineId: 'machine-0001' }, signer)).toEqual({ ok: false, code: 'revoked' });
  });

  it('고객: 한 번이라도 활성화했으면 거절(기기를 해제해도), 운영자는 된다', async () => {
    const o = await placeAndPay();
    const key = (await findSoftwareOrder(o.orderNo))!.licenses[0].licenseKey;
    expect((await activateLicense({ key, product: 'test-plugin', machineId: 'machine-0001' }, signer)).ok).toBe(true);
    await testDb.run(sql`UPDATE software_activations SET deactivated_at = unixepoch()`);
    expect(await cancelSoftwareOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: 't', now: new Date() })).toMatchObject({ ok: false, code: 'activated' });
    expect(cancelPayment).not.toHaveBeenCalled();

    (cancelPayment as jest.Mock).mockResolvedValue(cancelled(o.orderNo, o.totalAmount));
    expect(await cancelSoftwareOrder({ orderNo: o.orderNo, requestedBy: 'admin', reason: 't', now: new Date() })).toEqual({ ok: true, refundAmount: 69000 });
    expect((await findSoftwareOrder(o.orderNo))!.licenses[0].status).toBe('refunded');
  });

  it('고객: 결제 후 7일이 지나면 거절', async () => {
    const o = await placeAndPay();
    const later = new Date(Date.now() + 8 * 24 * 3600 * 1000);
    expect(await cancelSoftwareOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: 't', now: later })).toMatchObject({ ok: false, code: 'expired_window' });
  });

  it('토스가 거절하면 라이선스를 되돌린다', async () => {
    const o = await placeAndPay();
    (cancelPayment as jest.Mock).mockResolvedValue({ ok: false, code: 'REJECT', message: 'no' });
    const r = await cancelSoftwareOrder({ orderNo: o.orderNo, requestedBy: 'customer', reason: 't', now: new Date() });
    expect(r.ok).toBe(false);
    const order = await findSoftwareOrder(o.orderNo);
    expect(order!.status).toBe('paid');
    expect(order!.licenses[0].status).toBe('active');
  });

  it('웹훅 전액 취소는 라이선스를 닫는다', async () => {
    const o = await placeAndPay();
    await refundLicensesOnFullCancel(o.orderNo);
    expect((await findSoftwareOrder(o.orderNo))!.licenses[0].status).toBe('refunded');
  });
});
