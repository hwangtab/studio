import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shopPayload } from '../../tests/helpers/shopFixtures';
import { creatorBusinessProfiles, fundingCreators, shopArtists, shopProducts, shopProductSkus, shopSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));

/* eslint-disable import/first */
import { listShopArtistSales, setSkuStock } from './adminQueries';
import { loadCreatorSales } from './creatorStats';
import { createShopOrder } from './service';
/* eslint-enable import/first */

const SKU_A = 'db-aaaaaaaaaa';
const SKU_B = 'db-bbbbbbbbbb';

const seed = async (editionSize: number | null = 10) => {
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: 'DB 아티스트', taxType: 'withholding' });
  await testDb.insert(shopArtists).values({ creatorId: 'c1', slug: 'db-artist' });
  await testDb.insert(shopProducts).values({
    id: 'p1', creatorId: 'c1', slug: 'db-product', category: 'goods', title: 'DB 상품', description: '소개', images: '[]',
    reviewStatus: 'approved', published: true, editionSize,
  });
  await testDb.insert(shopProductSkus).values([
    { id: SKU_A, productId: 'p1', optionLabel: 'A', price: 20000, lockedAt: 1 },
    { id: SKU_B, productId: 'p1', optionLabel: 'B', price: 20000, lockedAt: 1 },
  ]);
};

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('setSkuStock — 한정판 상한', () => {
  it('그 상품 SKU 재고 합이 edition_size를 넘으면 거절한다', async () => {
    await seed(10);
    expect(await setSkuStock(SKU_A, 6)).toEqual({ ok: true });
    const over = await setSkuStock(SKU_B, 5);
    expect(over.ok).toBe(false);
    expect(over.ok === false && over.message).toContain('4장');
    expect(await setSkuStock(SKU_B, 4)).toEqual({ ok: true });
    // 자기 자신의 값을 바꿀 때는 자기 이전 값을 합에서 뺀다.
    expect(await setSkuStock(SKU_A, 6)).toEqual({ ok: true });
    expect((await setSkuStock(SKU_A, 7)).ok).toBe(false);
    expect((await testDb.select().from(shopSkus).where(eq(shopSkus.id, SKU_A)))[0].stock).toBe(6);
  });

  it('한정판이 아니면 상한이 없다', async () => {
    await seed(null);
    expect(await setSkuStock(SKU_A, 500)).toEqual({ ok: true });
  });
});

describe('listShopArtistSales — DB 갈래', () => {
  const placeShipped = async () => {
    await seed(null);
    await setSkuStock(SKU_A, 5);
    const r = await createShopOrder(shopPayload([{ skuId: SKU_A, quantity: 2 }]), new Date(), { salesOpen: true });
    if (!r.ok) throw new Error(`setup: ${r.code}`);
    await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'shipped', shipped_at = ${Date.UTC(2026, 9, 15) / 1000} WHERE order_no = ${r.orderNo}`);
    return r;
  };

  it('db- SKU 줄을 creator:<id> 키로 모으고 세금 유형은 funding_creators에서 읽는다', async () => {
    await placeShipped();
    const rows = await listShopArtistSales('2026-10');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ artistSlug: 'creator:c1', artistName: 'DB 아티스트', taxType: 'withholding', quantity: 2, salesAmount: 40000 });
    expect(rows[0].payout?.netAmount).toBeGreaterThan(0);
    expect(await listShopArtistSales('2026-09')).toEqual([]);
  });

  it('세금 유형이 비어 있으면 정산액을 계산하지 않는다', async () => {
    await placeShipped();
    await testDb.update(fundingCreators).set({ taxType: null }).where(eq(fundingCreators.id, 'c1'));
    const rows = await listShopArtistSales('2026-10');
    expect(rows[0]).toMatchObject({ taxType: null, payout: null, quantity: 2 });
  });

  it('사업자인데 사업자 정보가 없으면 businessNumberMissing, 있으면 아니다, 개인은 아니다', async () => {
    await placeShipped();
    expect((await listShopArtistSales('2026-10'))[0].businessNumberMissing).toBe(false);
    await testDb.update(fundingCreators).set({ taxType: 'invoice' }).where(eq(fundingCreators.id, 'c1'));
    expect((await listShopArtistSales('2026-10'))[0].businessNumberMissing).toBe(true);
    await testDb.insert(creatorBusinessProfiles).values({ creatorId: 'c1', businessNumber: '7537400653', businessName: 'a', representativeName: 'b' });
    expect((await listShopArtistSales('2026-10'))[0].businessNumberMissing).toBe(false);
  });

  it('사업자 표를 읽지 못하면 표시만 생략하고 정산 행은 그대로다', async () => {
    await placeShipped();
    await testDb.update(fundingCreators).set({ taxType: 'invoice' }).where(eq(fundingCreators.id, 'c1'));
    await testDb.run(sql`DROP TABLE creator_business_profiles`);
    const rows = await listShopArtistSales('2026-10');
    expect(rows[0]).toMatchObject({ quantity: 2, businessNumberMissing: false });
  });

  it('DB 갈래가 실패해도 던지지 않는다(파일 갈래는 그대로)', async () => {
    await placeShipped();
    await testDb.run(sql`DROP TABLE shop_product_skus`);
    expect(await listShopArtistSales('2026-10')).toEqual([]);
  });
});

describe('loadCreatorSales — 아티스트 판매 현황', () => {
  it('맡긴·결제·발송·남은 수량을 SKU별로 센다(구매자 정보 없음)', async () => {
    await seed(null);
    await setSkuStock(SKU_A, 5);
    const r = await createShopOrder(shopPayload([{ skuId: SKU_A, quantity: 2 }]), new Date(), { salesOpen: true });
    if (!r.ok) throw new Error('setup');
    await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
    const before = await loadCreatorSales('c1');
    const a = before.find((x) => x.skuId === SKU_A)!;
    expect(a).toMatchObject({ deposited: 5, paid: 2, shipped: 0, remaining: 3 });
    expect(before.find((x) => x.skuId === SKU_B)).toMatchObject({ deposited: 0, paid: 0, remaining: 0 });
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'shipped' WHERE order_no = ${r.orderNo}`);
    expect((await loadCreatorSales('c1')).find((x) => x.skuId === SKU_A)).toMatchObject({ paid: 2, shipped: 2 });
    expect(JSON.stringify(before)).not.toMatch(/김구매|010-1234|buyer@/);
    expect(await loadCreatorSales('c2')).toEqual([]);
  });

  it('잠기지 않은 SKU는 현황에 나오지 않는다', async () => {
    await seed(null);
    await testDb.update(shopProductSkus).set({ lockedAt: null }).where(eq(shopProductSkus.id, SKU_B));
    expect((await loadCreatorSales('c1')).map((x) => x.skuId)).toEqual([SKU_A]);
  });
});
