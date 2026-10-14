import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shopPayload } from '../../tests/helpers/shopFixtures';
import { shopSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));

/* eslint-disable import/first */
import { createShopOrder, expireStaleShopOrders, findShopOrderByOrderNo, getRemainingStock } from './service';
import { SHOP_FREE_SHIPPING_FROM, SHOP_HOLD_SECONDS, SHOP_SHIPPING_FEE } from '../../data/shop/policy';
/* eslint-enable import/first */

const open = { salesOpen: true };

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(shopSkus).values([
    { id: 'test-cd-std', productSlug: 'test-cd', stock: 3 },
    { id: 'test-tee-m', productSlug: 'test-tee', stock: 10 },
  ]);
});

describe('createShopOrder', () => {
  it('판매가 닫혀 있으면 주문을 만들지 않는다(SHOP_SALES_OPEN)', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), new Date(), { salesOpen: false });
    expect(r).toEqual({ ok: false, code: 'sales_closed' });
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
  });

  it('금액은 카탈로그에서 — 상품 합계 + 배송비, 공급가·VAT 분리, 줄은 주문 시점 값으로 남는다', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 2 }, { skuId: 'test-tee-m', quantity: 1 }]), new Date(), open);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const subtotal = 20000 * 2 + 35000;
    expect(r.totalAmount).toBe(subtotal + SHOP_SHIPPING_FEE);
    expect(r.orderName).toBe('테스트 앨범 외 1개');
    const order = await findShopOrderByOrderNo(r.orderNo);
    expect(order).toMatchObject({ type: 'merch', status: 'pending', totalAmount: subtotal + SHOP_SHIPPING_FEE });
    expect(order!.itemAmount + order!.vatAmount).toBe(order!.totalAmount);
    expect(order!.shopOrder).toMatchObject({ subtotalAmount: subtotal, shippingFee: SHOP_SHIPPING_FEE, fulfillmentStatus: 'preparing', postcode: '03000' });
    expect(order!.shopOrder!.items.map((i) => [i.skuId, i.unitPrice, i.quantity, i.optionLabel])).toEqual(
      expect.arrayContaining([['test-cd-std', 20000, 2, null], ['test-tee-m', 35000, 1, 'M']]),
    );
  });

  it(`상품 합계가 기준 이상이면 배송비 0원`, async () => {
    await testDb.update(shopSkus).set({ stock: 100 });
    const qty = Math.ceil(SHOP_FREE_SHIPPING_FROM / 35000);
    const r = await createShopOrder(shopPayload([{ skuId: 'test-tee-m', quantity: qty }]), new Date(), open);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.totalAmount).toBe(35000 * qty);
  });

  it('재고를 넘으면 sold_out이고 어떤 행도 남지 않는다 — 한 줄이라도 모자라면 주문 전체를 거절', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: 'test-tee-m', quantity: 1 }, { skuId: 'test-cd-std', quantity: 4 }]), new Date(), open);
    expect(r).toEqual({ ok: false, code: 'sold_out' });
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
    expect(await testDb.query.shopOrders.findMany()).toHaveLength(0);
    expect(await testDb.query.shopOrderItems.findMany()).toHaveLength(0);
  });

  it('재고 행이 없는 SKU(아직 재고를 안 넣음)는 품절', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: 'test-tee-l', quantity: 1 }]), new Date(), open);
    expect(r).toEqual({ ok: false, code: 'sold_out' });
  });

  it('비공개 상품·판매 종료 SKU·없는 SKU는 unknown_item', async () => {
    for (const skuId of ['test-hidden-std', 'test-tee-old', 'nope']) {
      expect(await createShopOrder(shopPayload([{ skuId, quantity: 1 }]), new Date(), open)).toEqual({ ok: false, code: 'unknown_item' });
    }
  });

  it('결제 대기 홀드가 재고를 잡고, 홀드가 끝나면 상태와 무관하게 풀린다', async () => {
    const now = new Date();
    expect((await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 3 }]), now, open)).ok).toBe(true);
    expect(await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), now, open)).toEqual({ ok: false, code: 'sold_out' });
    expect((await getRemainingStock(['test-cd-std'], now))['test-cd-std']).toBe(0);
    const later = new Date(now.getTime() + (SHOP_HOLD_SECONDS + 1) * 1000);
    expect((await getRemainingStock(['test-cd-std'], later))['test-cd-std']).toBe(3);
    expect((await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 3 }]), later, open)).ok).toBe(true);
  });

  it('paid는 홀드와 무관하게 계속 점유하고, refunded가 되면 재고로 돌아온다(복원 쓰기 없음)', async () => {
    const now = new Date();
    const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 2 }]), now, open);
    if (!r.ok) throw new Error('setup');
    const { sql } = await import('drizzle-orm');
    await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
    const later = new Date(now.getTime() + 86400 * 1000);
    expect((await getRemainingStock(['test-cd-std'], later))['test-cd-std']).toBe(1);
    await testDb.run(sql`UPDATE orders SET status = 'refunded' WHERE order_no = ${r.orderNo}`);
    expect((await getRemainingStock(['test-cd-std'], later))['test-cd-std']).toBe(3);
  });
});

describe('새 표(0053)가 없는 DB — 마이그레이션 전 배포', () => {
  beforeEach(async () => {
    const { sql } = await import('drizzle-orm');
    for (const t of ['shop_product_skus', 'shop_products', 'shop_serials', 'shop_order_downloads', 'shop_artists']) {
      await testDb.run(sql.raw(`DROP TABLE ${t}`));
    }
  });

  it('파일 SKU 주문은 성공한다(db- 아닌 SKU는 새 표를 조회하지 않는다)', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), new Date(), open);
    expect(r.ok).toBe(true);
  });

  it('db- SKU는 표가 없으면 없는 상품이 아니라 조회 실패(lookup_failed)다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await createShopOrder(shopPayload([{ skuId: 'db-abcdef0123', quantity: 1 }]), new Date(), open);
    expect(r).toEqual({ ok: false, code: 'lookup_failed' });
  });
});

describe('expireStaleShopOrders', () => {
  it('홀드 + 30분 유예가 지난 pending만 expired로 닫는다', async () => {
    const now = new Date();
    const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), now, open);
    if (!r.ok) throw new Error('setup');
    expect(await expireStaleShopOrders(new Date(now.getTime() + (SHOP_HOLD_SECONDS + 60) * 1000))).toBe(0);
    expect(await expireStaleShopOrders(new Date(now.getTime() + (SHOP_HOLD_SECONDS + 1801) * 1000))).toBe(1);
    expect((await findShopOrderByOrderNo(r.orderNo))!.status).toBe('expired');
  });
});
