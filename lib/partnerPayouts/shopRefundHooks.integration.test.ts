/** @jest-environment node */

/**
 * 환불 경로가 정산 뒤 환불 조정을 쌓는가 — `cancelShopOrder`(고객·관리자 환불)와 웹훅 전액 취소 대사(`closeShopFulfillmentOnFullCancel`)를
 * 실제 주문·확정·발송·환불 흐름으로 돌려 확인한다. 조정 계산 자체는 shopPayouts.integration.test.ts가 데이터로 고정한다.
 * 가장 중요한 것: 조정 생성이 실패해도 **환불은 성공**이다.
 */
import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { agreeShopArtistTermsForTest, shopPayload } from '../../tests/helpers/shopFixtures';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus, shopSkus } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { computeShopArtistPayout } from '../shop/artistPayout';

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
import { confirmShopOrder } from '../shop/confirm';
import { cancelShopOrder } from '../shop/cancel';
import { markShopOrderShipped } from '../shop/fulfillment';
import { createShopOrder } from '../shop/service';
import { closeShopFulfillmentOnFullCancel } from '../shop/webhookSync';
import { cancelPayment, confirmPayment } from '../booking/toss';
import { buildShopPayoutPreview, recordShopPayout } from './shop';
import { listUnappliedAdjustments } from './adjustments';
/* eslint-enable import/first */

const SKU = 'db-aaaaaaaaaa';
const PERIOD = kstDateString(new Date()).slice(0, 7);

const done = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'DONE', totalAmount, method: '카드', approvedAt: new Date().toISOString() },
});
const cancelled = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'CANCELED', totalAmount, cancels: [{ cancelAmount: totalAmount, transactionKey: `tx-${orderNo}` }] },
});

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: '아티스트', taxType: 'withholding', payoutAccountEnc: 'enc' });
  await testDb.insert(shopArtists).values({ creatorId: 'c1', slug: 'artist-c1' });
  await agreeShopArtistTermsForTest(testDb, 'c1');
  await testDb.insert(shopProducts).values({ id: 'p1', creatorId: 'c1', slug: 'p1', category: 'goods', title: '상품', description: '소개', images: '[]', reviewStatus: 'approved', published: true });
  await testDb.insert(shopProductSkus).values({ id: SKU, productId: 'p1', optionLabel: 'A', price: 20000, lockedAt: 1 });
  await testDb.insert(shopSkus).values({ id: SKU, productSlug: 'p1', stock: 20 });
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

/** 결제 확정 → 발송 → 이번 달 정산 기록까지. 반환은 주문번호와 총액. */
const shippedAndRecorded = async () => {
  const r = await createShopOrder(shopPayload([{ skuId: SKU, quantity: 2 }]), new Date(), { salesOpen: true });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  (confirmPayment as jest.Mock).mockResolvedValueOnce(done(r.orderNo, r.totalAmount));
  expect(await confirmShopOrder({ orderNo: r.orderNo, paymentKey: `pk-${r.orderNo}`, amount: r.totalAmount })).toMatchObject({ ok: true });
  expect(await markShopOrderShipped({ orderNo: r.orderNo, courier: 'CJ대한통운', trackingNumber: '1234' })).toEqual({ ok: true });
  const preview = (await buildShopPayoutPreview('creator:c1', PERIOD))!;
  expect(preview.salesAmount).toBe(40000);
  const rec = await recordShopPayout('creator:c1', PERIOD, new Date(), { netAmount: preview.netAmount, adjustmentAmount: 0 });
  expect(rec.ok).toBe(true);
  return r;
};

it('정산 기록 뒤 관리자 환불(발송 뒤 반품) → late_refund 조정이 쌓이고 다음 정산 미리보기에서 빠진다', async () => {
  const r = await shippedAndRecorded();
  (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(r.orderNo, r.totalAmount));
  expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'admin', reason: '반품', now: new Date() })).toMatchObject({ ok: true });

  const adj = await listUnappliedAdjustments('shop', 'creator:c1');
  expect(adj).toHaveLength(1);
  expect(adj[0]).toMatchObject({ amount: -22000, reason: 'late_refund', sourceRef: r.orderNo });

  // 웹훅 대사가 뒤따라 와도(같은 환불) 조정은 늘지 않는다.
  await closeShopFulfillmentOnFullCancel(r.orderNo);
  expect(await listUnappliedAdjustments('shop', 'creator:c1')).toHaveLength(1);

  // 환불된 주문은 판매에서 빠지고, 조정은 다음 정산에 실린다.
  const preview = (await buildShopPayoutPreview('creator:c1', PERIOD))!;
  expect(preview).toMatchObject({ salesAmount: 0, adjustmentAmount: -22000 });
  expect(preview.recorded?.grossAmount).toBe(40000);
  expect(computeShopArtistPayout({ salesAmount: 0, refundAmount: 0, taxType: 'withholding', adjustmentAmount: -22000 }).netAmount).toBe(0);
});

it('정산 기록이 없는 달의 환불은 조정을 만들지 않는다', async () => {
  const r = await createShopOrder(shopPayload([{ skuId: SKU, quantity: 1 }]), new Date(), { salesOpen: true });
  if (!r.ok) throw new Error('setup');
  (confirmPayment as jest.Mock).mockResolvedValueOnce(done(r.orderNo, r.totalAmount));
  await confirmShopOrder({ orderNo: r.orderNo, paymentKey: `pk-${r.orderNo}`, amount: r.totalAmount });
  await markShopOrderShipped({ orderNo: r.orderNo, courier: 'CJ대한통운', trackingNumber: '1234' });
  (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(r.orderNo, r.totalAmount));
  expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'admin', reason: '반품', now: new Date() })).toMatchObject({ ok: true });
  expect(await listUnappliedAdjustments('shop', 'creator:c1')).toEqual([]);
});

it('웹훅 전액 취소 대사(콘솔 환불)도 조정을 쌓는다', async () => {
  const r = await shippedAndRecorded();
  // 토스 콘솔에서 환불 → reconcileRefunds가 주문을 refunded로 옮기고 환불 행을 남긴 뒤 이 함수가 불린다.
  const payment = (await testDb.all<{ id: string }>(sql`SELECT p.id AS id FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.order_no = ${r.orderNo}`))[0];
  await testDb.run(sql`UPDATE orders SET status = 'refunded' WHERE order_no = ${r.orderNo}`);
  await testDb.run(sql`INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status) VALUES ('rf-console', ${payment.id}, ${r.totalAmount}, '콘솔', 'admin', 'done')`);
  await closeShopFulfillmentOnFullCancel(r.orderNo);
  expect((await listUnappliedAdjustments('shop', 'creator:c1')).map((a) => a.amount)).toEqual([-22000]);
});

it('fail-soft: 조정 표가 없어도(마이그레이션 전) 환불은 성공한다', async () => {
  const r = await shippedAndRecorded();
  await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
  (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(r.orderNo, r.totalAmount));
  expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'admin', reason: '반품', now: new Date() })).toMatchObject({ ok: true });
  const [order] = await testDb.all<{ status: string }>(sql`SELECT status FROM orders WHERE order_no = ${r.orderNo}`);
  expect(order.status).toBe('refunded');
});
