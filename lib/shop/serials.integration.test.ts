import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shopPayload } from '../../tests/helpers/shopFixtures';
import { fundingCreators, shopProducts, shopProductSkus, shopSkus } from '../../db/schema';

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
import { createShopOrder } from './service';
import { alertIfSerialsMissing, loadOrderSerials } from './serials';
import { closeShopFulfillmentOnFullCancel } from './webhookSync';
import { cancelPayment, confirmPayment } from '../booking/toss';
import { sendEmail } from '../email/resend';
/* eslint-enable import/first */

const LTD = 'db-aaaaaaaaaa';
const LTD2 = 'db-cccccccccc';
const PLAIN = 'db-bbbbbbbbbb';

const done = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'DONE', totalAmount, method: '카드', approvedAt: new Date().toISOString() },
});
const cancelled = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'CANCELED', totalAmount, cancels: [{ cancelAmount: totalAmount, transactionKey: `tx-${orderNo}` }] },
});

const seed = async (editionSize = 10) => {
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: '아티스트' });
  await testDb.insert(shopProducts).values([
    { id: 'p-ltd', creatorId: 'c1', slug: 'ltd', category: 'album', title: '한정판', description: '소개', images: '[]', reviewStatus: 'approved', published: true, editionSize },
    { id: 'p-plain', creatorId: 'c1', slug: 'plain', category: 'goods', title: '일반', description: '소개', images: '[]', reviewStatus: 'approved', published: true },
  ]);
  await testDb.insert(shopProductSkus).values([
    { id: LTD, productId: 'p-ltd', optionLabel: 'A', price: 20000, lockedAt: 1 },
    { id: LTD2, productId: 'p-ltd', optionLabel: 'B', price: 20000, lockedAt: 1, sortOrder: 1 },
    { id: PLAIN, productId: 'p-plain', price: 10000, lockedAt: 1 },
  ]);
  await testDb.insert(shopSkus).values([
    { id: LTD, productSlug: 'ltd', stock: 20 }, { id: LTD2, productSlug: 'ltd', stock: 20 }, { id: PLAIN, productSlug: 'plain', stock: 20 },
    { id: 'test-cd-std', productSlug: 'test-cd', stock: 5 },
  ]);
};

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await seed();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

const paid = async (lines: Array<{ skuId: string; quantity: number }>) => {
  const r = await createShopOrder(shopPayload(lines), new Date(), { salesOpen: true });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  (confirmPayment as jest.Mock).mockResolvedValueOnce(done(r.orderNo, r.totalAmount));
  const c = await confirmShopOrder({ orderNo: r.orderNo, paymentKey: `pk-${r.orderNo}`, amount: r.totalAmount });
  expect(c).toMatchObject({ ok: true });
  return r;
};

const serialsOf = async (orderNo: string): Promise<number[]> =>
  (await testDb.all<{ serial: number }>(sql`SELECT serial FROM shop_serials WHERE order_no = ${orderNo} ORDER BY serial`)).map((r) => Number(r.serial));

const itemsOf = (orderNo: string) => [{ skuId: LTD, orderNo }];

describe('한정판 번호 — 확정 배치', () => {
  it('주문 순서대로 1, 2, … 번호가 붙는다', async () => {
    const a = await paid([{ skuId: LTD, quantity: 1 }]);
    const b = await paid([{ skuId: LTD, quantity: 1 }]);
    expect(await serialsOf(a.orderNo)).toEqual([1]);
    expect(await serialsOf(b.orderNo)).toEqual([2]);
  });

  it('수량 2인 줄에 번호 2개, 같은 상품의 다른 옵션도 한 번호표를 나눠 쓴다', async () => {
    const a = await paid([{ skuId: LTD, quantity: 2 }, { skuId: LTD2, quantity: 1 }]);
    expect(await serialsOf(a.orderNo)).toEqual([1, 2, 3]);
    const map = await loadOrderSerials(a.orderNo, itemsOf(a.orderNo));
    expect([...map.values()].map((l) => l.length).sort()).toEqual([1, 2]);
    expect([...map.values()][0][0].editionSize).toBe(10);
  });

  it('발송 전 전액 취소는 번호를 반납하고, 결번은 다음 주문이 가장 작은 번호로 다시 쓴다', async () => {
    const a = await paid([{ skuId: LTD, quantity: 1 }]);
    const b = await paid([{ skuId: LTD, quantity: 2 }]);
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(a.orderNo, a.totalAmount));
    expect(await cancelShopOrder({ orderNo: a.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: true });
    expect(await serialsOf(a.orderNo)).toEqual([]);
    expect(await serialsOf(b.orderNo)).toEqual([2, 3]);
    const c = await paid([{ skuId: LTD, quantity: 1 }]);
    expect(await serialsOf(c.orderNo)).toEqual([1]);
  });

  it('발송 뒤 반품 환불은 번호를 남긴다', async () => {
    const a = await paid([{ skuId: LTD, quantity: 2 }]);
    expect(await markShopOrderShipped({ orderNo: a.orderNo, courier: 'CJ대한통운', trackingNumber: '1234' })).toEqual({ ok: true });
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(a.orderNo, a.totalAmount));
    expect(await cancelShopOrder({ orderNo: a.orderNo, requestedBy: 'admin', reason: '반품', now: new Date() })).toMatchObject({ ok: true });
    expect(await serialsOf(a.orderNo)).toEqual([1, 2]);
  });

  it('웹훅 전액 취소 — 발송 전이면 반납, 발송 뒤면 남긴다', async () => {
    const a = await paid([{ skuId: LTD, quantity: 1 }]);
    const b = await paid([{ skuId: LTD, quantity: 1 }]);
    await markShopOrderShipped({ orderNo: b.orderNo, courier: 'CJ대한통운', trackingNumber: '1234' });
    await closeShopFulfillmentOnFullCancel(a.orderNo);
    await closeShopFulfillmentOnFullCancel(b.orderNo);
    expect(await serialsOf(a.orderNo)).toEqual([]);
    expect(await serialsOf(b.orderNo)).toEqual([2]);
  });

  it('번호가 다 나가면 재고가 남아 있어도 더 팔지 않는다(화면·생성 게이트)', async () => {
    await testDb.run(sql`UPDATE shop_products SET edition_size = 1 WHERE id = 'p-ltd'`);
    const a = await paid([{ skuId: LTD, quantity: 1 }]);
    expect(await serialsOf(a.orderNo)).toEqual([1]);
    expect(await createShopOrder(shopPayload([{ skuId: LTD2, quantity: 1 }]), new Date(), { salesOpen: true })).toEqual({ ok: false, code: 'sold_out' });
  });

  it('최후 방어 — 확정된 주문에 번호가 모자라면(게이트 밖 이상 상태) 운영자에게 알린다', async () => {
    const a = await paid([{ skuId: LTD, quantity: 1 }]);
    // 게이트가 막는 상태를 손으로 만든다 — 번호 행이 사라진 확정 주문.
    await testDb.run(sql`DELETE FROM shop_serials WHERE order_no = ${a.orderNo}`);
    (sendEmail as jest.Mock).mockClear();
    const order = await testDb.all<{ id: string; sku_id: string; quantity: number }>(sql`SELECT id, sku_id, quantity FROM shop_order_items WHERE order_no = ${a.orderNo}`);
    await alertIfSerialsMissing(a.orderNo, order.map((i) => ({ skuId: i.sku_id })));
    const subjects = (sendEmail as jest.Mock).mock.calls.map((c) => c[0].subject as string);
    expect(subjects.some((s) => s.includes('한정판 번호가 모자라요'))).toBe(true);
  });

  it('넘버링이 아닌 DB 상품에는 번호가 없다', async () => {
    const a = await paid([{ skuId: PLAIN, quantity: 2 }]);
    expect(await serialsOf(a.orderNo)).toEqual([]);
    expect(sendEmail).toHaveBeenCalledTimes(2); // 알림 없이 주문 메일 둘
  });

  it('새 표(shop_serials)가 없는 DB에서도 파일 상품 주문은 확정된다', async () => {
    await testDb.run(sql.raw('DROP TABLE shop_serials'));
    const a = await paid([{ skuId: 'test-cd-std', quantity: 1 }]);
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(a.orderNo, a.totalAmount));
    expect(await cancelShopOrder({ orderNo: a.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: true });
  });

  it('주문 메일에 번호가 실린다', async () => {
    (sendEmail as jest.Mock).mockClear();
    await paid([{ skuId: LTD, quantity: 2 }]);
    const customer = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].to === 'buyer@example.com')![0];
    expect(customer.text).toContain('한정판 번호: 1/10, 2/10');
  });

  it('예약 상품 주문 메일에 발송 예정일이 실린다(상품의 현재 값, 지난 날짜는 안 실린다)', async () => {
    await testDb.run(sql`UPDATE shop_products SET ships_on = '2099-01-05' WHERE id = 'p-plain'`);
    (sendEmail as jest.Mock).mockClear();
    await paid([{ skuId: PLAIN, quantity: 1 }]);
    const customer = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].to === 'buyer@example.com')![0];
    expect(customer.text).toContain('발송 예정: 2099년 1월 5일');

    await testDb.run(sql`UPDATE shop_products SET ships_on = '2000-01-05' WHERE id = 'p-plain'`);
    (sendEmail as jest.Mock).mockClear();
    await paid([{ skuId: PLAIN, quantity: 1 }]);
    const later = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].to === 'buyer@example.com')![0];
    expect(later.text).not.toContain('발송 예정');
  });
});
