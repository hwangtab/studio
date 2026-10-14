import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, shopProducts, shopProductSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));

/* eslint-disable import/first */
import {
  findSellableSkuAsync, findShopProductAsync, listAllSkusForAdmin, listPublishedShopProducts,
} from './repository';
/* eslint-enable import/first */

const CREATOR = 'creator-1';

type ProductOver = Partial<typeof shopProducts.$inferInsert>;
const seedProduct = async (over: ProductOver, skus: Array<Partial<typeof shopProductSkus.$inferInsert> & { id: string }>) => {
  const id = over.id ?? `p-${over.slug}`;
  await testDb.insert(shopProducts).values({
    id, creatorId: CREATOR, slug: 'db-demo', category: 'goods', title: 'DB 상품',
    description: '첫 문단.\n\n둘째 문단.', images: JSON.stringify(['/images/shop/db-demo-20261101.webp']),
    reviewStatus: 'approved', published: true, ...over,
  });
  for (const s of skus) await testDb.insert(shopProductSkus).values({ productId: id, price: 12000, lockedAt: 1, ...s });
  return id;
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(fundingCreators).values({ id: CREATOR, email: 'a@example.com', name: '아티스트' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const breakNewTables = async () => {
  for (const t of ['shop_product_skus', 'shop_products']) await testDb.run(sql.raw(`DROP TABLE ${t}`));
};

describe('findSellableSkuAsync', () => {
  it('파일 SKU는 파일에서 찾는다', async () => {
    const r = await findSellableSkuAsync('test-cd-std');
    expect('found' in r && r.found?.product.slug).toBe('test-cd');
  });

  it('db-가 아닌 SKU는 DB를 조회하지 않는다 — 새 표가 없어도 {found:null}이다', async () => {
    await breakNewTables();
    expect(await findSellableSkuAsync('nope')).toEqual({ found: null });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('db- SKU: 승인·공개·잠김·retired 아님이면 찾는다', async () => {
    await seedProduct({ slug: 'db-demo' }, [{ id: 'db-aaaaaaaaaa', optionLabel: 'M' }]);
    const r = await findSellableSkuAsync('db-aaaaaaaaaa');
    expect('found' in r && r.found?.sku).toMatchObject({ id: 'db-aaaaaaaaaa', price: 12000, optionLabel: 'M' });
    expect('found' in r && r.found?.product).toMatchObject({ source: 'db', slug: 'db-demo' });
  });

  it.each([
    ['잠기지 않은 SKU', { reviewStatus: 'approved' as const, published: true }, { lockedAt: null }],
    ['retired SKU', {}, { retired: true }],
    ['승인 전 상품', { reviewStatus: 'submitted' as const }, {}],
    ['비공개 상품', { published: false }, {}],
  ])('%s는 팔 수 없다', async (_l, productOver, skuOver) => {
    await seedProduct({ slug: 'db-x', ...productOver }, [{ id: 'db-bbbbbbbbbb', ...skuOver }]);
    expect(await findSellableSkuAsync('db-bbbbbbbbbb')).toEqual({ found: null });
  });

  it('db- SKU 조회가 실패하면 부재가 아니라 lookupFailed다', async () => {
    await breakNewTables();
    expect(await findSellableSkuAsync('db-cccccccccc')).toEqual({ lookupFailed: true });
  });
});

describe('공개 목록·상세', () => {
  it('파일 상품이 먼저, 그다음 DB 상품. 공개 객체에 digital_files 키가 없다', async () => {
    await seedProduct({ slug: 'db-demo', kind: 'digital', digitalFiles: JSON.stringify([{ label: 'WAV', key: 'shop/a.wav' }]) }, [{ id: 'db-dddddddddd' }]);
    const list = await listPublishedShopProducts();
    expect(list.map((p) => p.slug)).toEqual(['test-cd', 'test-tee', 'db-demo']);
    const db = list[2];
    expect(db).toMatchObject({ source: 'db', kind: 'digital', hasDownloads: true, description: ['첫 문단.', '둘째 문단.'] });
    expect(JSON.stringify(db)).not.toMatch(/digital_files|digitalFiles|shop\/a\.wav/);
    expect(JSON.stringify(db)).not.toContain('undefined');
  });

  it('미리듣기는 라벨만 싣고(키 미노출), hasDownloads는 판매 파일만 센다', async () => {
    await seedProduct({ slug: 'db-prev', kind: 'digital', digitalFiles: JSON.stringify([{ label: '미리듣기 1분', key: 'shop/p/prev.mp3', preview: true }]) }, [{ id: 'db-pppppppppp' }]);
    const only = (await listPublishedShopProducts()).find((p) => p.slug === 'db-prev')!;
    expect(only).toMatchObject({ previews: ['미리듣기 1분'], hasDownloads: false });
    expect(JSON.stringify(only)).not.toContain('shop/p/prev.mp3');
    await testDb.update(shopProducts).set({ digitalFiles: JSON.stringify([{ label: '앨범', key: 'shop/p/a.zip' }, { label: '미리듣기 1분', key: 'shop/p/prev.mp3', preview: true }]) });
    const both = (await listPublishedShopProducts()).find((p) => p.slug === 'db-prev')!;
    expect(both).toMatchObject({ previews: ['미리듣기 1분'], hasDownloads: true });
    expect(JSON.stringify(both)).not.toMatch(/shop\/p\//);
  });

  it('같은 slug면 파일이 이긴다(목록·상세 모두)', async () => {
    await seedProduct({ slug: 'test-cd', title: 'DB가 가로채려는 제목' }, [{ id: 'db-eeeeeeeeee' }]);
    const list = await listPublishedShopProducts();
    expect(list.filter((p) => p.slug === 'test-cd')).toHaveLength(1);
    expect((await findShopProductAsync('test-cd'))!.title).toBe('테스트 앨범');
    // 비공개 파일 상품의 slug도 가로채지 못한다.
    await seedProduct({ id: 'p-hidden', slug: 'test-hidden' }, [{ id: 'db-ffffffffff' }]);
    expect(await findShopProductAsync('test-hidden')).toBeNull();
  });

  it('DB 상품 상세는 잠긴 SKU만 싣고, 팔 SKU가 없으면 공개하지 않는다', async () => {
    await seedProduct({ slug: 'db-demo' }, [{ id: 'db-1111111111' }, { id: 'db-2222222222', lockedAt: null }]);
    expect((await findShopProductAsync('db-demo'))!.skus.map((s) => s.id)).toEqual(['db-1111111111']);
    await seedProduct({ id: 'p-empty', slug: 'db-empty' }, [{ id: 'db-3333333333', lockedAt: null }]);
    expect(await findShopProductAsync('db-empty')).toBeNull();
    expect((await listPublishedShopProducts()).map((p) => p.slug)).not.toContain('db-empty');
  });

  it('DB 오류는 삼키고 파일 상품만 돌려준다', async () => {
    await breakNewTables();
    expect((await listPublishedShopProducts()).map((p) => p.slug)).toEqual(['test-cd', 'test-tee']);
    expect(await findShopProductAsync('db-demo')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('listAllSkusForAdmin', () => {
  it('파일 SKU 전부 + DB의 잠긴 SKU', async () => {
    await seedProduct({ slug: 'db-demo' }, [{ id: 'db-4444444444' }, { id: 'db-5555555555', lockedAt: null }]);
    const ids = (await listAllSkusForAdmin()).map((x) => x.sku.id);
    expect(ids).toEqual(expect.arrayContaining(['test-cd-std', 'test-tee-old', 'db-4444444444']));
    expect(ids).not.toContain('db-5555555555');
  });
});
