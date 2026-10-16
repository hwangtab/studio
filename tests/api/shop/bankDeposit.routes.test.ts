/** @jest-environment node */
/**
 * 상점 계좌 입금 라우트 — POST /api/shop/orders(paymentMethod) · /api/shop/cancel(입금 전 신청 취소) · /api/admin/shop/orders/[orderNo](입금 확인).
 * 상태 전이·재고 자체는 lib/shop/bankDeposit.integration.test.ts가 검증한다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { shopPayload } from '../../helpers/shopFixtures';
import { shopSkus } from '../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../data/shop/catalog', () => ({
  ...jest.requireActual('../../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../../../data/shop/policy', () => ({ ...jest.requireActual('../../../data/shop/policy'), SHOP_SALES_OPEN: true }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/booking/toss', () => ({ ...jest.requireActual('../../../lib/booking/toss'), cancelPayment: jest.fn() }));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import ordersHandler from '../../../pages/api/shop/orders';
import cancelHandler from '../../../pages/api/shop/cancel';
import adminHandler from '../../../pages/api/admin/shop/orders/[orderNo]';
import { findShopOrderByOrderNo } from '../../../lib/shop/service';
import { sendEmail } from '../../../lib/email/resend';
import { cancelPayment } from '../../../lib/booking/toss';
import { loadRefundAccountSummary } from '../../../lib/payments/refundAccount';
import { FIELD_CRYPTO_KEY_ENV } from '../../../lib/crypto/fieldCrypto';
/* eslint-enable import/first */

function call(handler: (req: NextApiRequest, res: NextApiResponse) => unknown, req: Partial<NextApiRequest>) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      status(code: number) { this.statusCode = code; return this; },
      json(body: Record<string, unknown>) { resolve({ status: this.statusCode, body }); return this; },
    };
    Promise.resolve(handler({ method: 'POST', headers: {}, socket: {}, ...req } as NextApiRequest, res as unknown as NextApiResponse));
  });
}

beforeEach(async () => {
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 7).toString('base64');
  testDb = (await createTestDb()).db;
  await testDb.insert(shopSkus).values([{ id: 'test-cd-std', productSlug: 'test-cd', stock: 3 }]);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

const bankOrder = async () => {
  const r = await call(ordersHandler, { body: { ...shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), paymentMethod: 'bank_transfer' } });
  expect(r.status).toBe(201);
  return r.body as { orderNo: string; manageUrl: string; paymentMethod: string };
};

describe('POST /api/shop/orders — 계좌로 직접 입금', () => {
  it('입금 대기로 만들고 입금 안내 메일(고객+운영자)을 보낸 뒤 주문 확인 주소를 돌려준다', async () => {
    const body = await bankOrder();
    expect(body.paymentMethod).toBe('bank_transfer');
    expect(body.manageUrl).toMatch(new RegExp(`^/ko/shop/manage/${body.orderNo}\\?token=`));
    expect((await findShopOrderByOrderNo(body.orderNo))!.status).toBe('awaiting_deposit');
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('결제수단 값이 이상하면 400이고 주문이 생기지 않는다', async () => {
    const r = await call(ordersHandler, { body: { ...shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), paymentMethod: 'virtual' } });
    expect(r.status).toBe(400);
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
  });

  it('결제수단이 없으면 토스(pending)로 만든다 — 기존 흐름 그대로', async () => {
    const r = await call(ordersHandler, { body: shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]) });
    expect(r.status).toBe(201);
    expect(r.body.manageUrl).toBeUndefined();
    expect((await findShopOrderByOrderNo(r.body.orderNo as string))!.status).toBe('pending');
  });
});

describe('POST /api/shop/cancel — 입금 전 신청 취소', () => {
  it('입금 대기 주문은 환불 없이 닫히고 운영자에게만 알린다', async () => {
    const o = await bankOrder();
    (sendEmail as jest.Mock).mockClear();
    const token = new URL(o.manageUrl, 'http://x').searchParams.get('token');
    const r = await call(cancelHandler, { body: { orderNo: o.orderNo, token } });
    expect(r).toEqual({ status: 200, body: { ok: true, refundAmount: 0 } });
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('deposit_cancelled');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it('입금으로 확정된 주문은 환불 계좌 없이는 취소할 수 없다 — 409와 안내, 주문은 그대로', async () => {
    const o = await bankOrder();
    const token = new URL(o.manageUrl, 'http://x').searchParams.get('token');
    await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'confirm_deposit' } });
    const r = await call(cancelHandler, { body: { orderNo: o.orderNo, token } });
    expect(r.status).toBe(409);
    expect(String(r.body.message)).toContain('환불받을 은행');
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('paid');
  });

  it('입금으로 확정된 주문도 환불 계좌를 적으면 취소된다 — 송금 완료는 운영자가 따로 표시', async () => {
    const o = await bankOrder();
    const token = new URL(o.manageUrl, 'http://x').searchParams.get('token');
    await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'confirm_deposit' } });
    const r = await call(cancelHandler, { body: { orderNo: o.orderNo, token, refundAccount: { bankName: '국민은행', accountNumber: '123-456-789012', accountHolder: '김구매' } } });
    expect(r.status).toBe(200);
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('refunded');
    expect(cancelPayment).not.toHaveBeenCalled();
    expect(await loadRefundAccountSummary({ kind: 'merch', orderNo: o.orderNo })).toMatchObject({ status: 'present', refundedAt: null });
    expect((await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'mark_refund_sent' } })).status).toBe(200);
    expect(await loadRefundAccountSummary({ kind: 'merch', orderNo: o.orderNo })).toMatchObject({ status: 'present', refundedAt: expect.any(Date) });
  });

  it('송금 완료 표시는 계좌 입금 주문에서만 — 토스 주문은 409', async () => {
    const r0 = await call(ordersHandler, { body: shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]) });
    const r = await call(adminHandler, { query: { orderNo: r0.body.orderNo as string }, body: { action: 'mark_refund_sent' } });
    expect(r.status).toBe(409);
  });
});

describe('POST /api/admin/shop/orders/[orderNo] — 입금 확인·미입금 취소·재발송', () => {
  it('입금 확인 → paid, 두 번째는 409', async () => {
    const o = await bankOrder();
    const first = await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'confirm_deposit' } });
    expect(first).toEqual({ status: 200, body: { ok: true } });
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('paid');
    const second = await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'confirm_deposit' } });
    expect(second.status).toBe(409);
  });

  it('미입금 취소 → deposit_cancelled, 그 뒤 입금 확인은 409', async () => {
    const o = await bankOrder();
    expect((await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'cancel_deposit' } })).status).toBe(200);
    expect((await findShopOrderByOrderNo(o.orderNo))!.status).toBe('deposit_cancelled');
    expect((await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'confirm_deposit' } })).status).toBe(409);
  });

  it('입금 안내 재발송 — 입금 대기가 아니면 409', async () => {
    const o = await bankOrder();
    (sendEmail as jest.Mock).mockClear();
    expect((await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'resend_deposit_guide' } })).status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'confirm_deposit' } });
    expect((await call(adminHandler, { query: { orderNo: o.orderNo }, body: { action: 'resend_deposit_guide' } })).status).toBe(409);
  });
});
