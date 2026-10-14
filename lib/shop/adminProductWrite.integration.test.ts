import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shopPayload } from '../../tests/helpers/shopFixtures';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../funding/r2', () => ({
  fundingDownloadObjectExists: jest.fn(async () => true),
  presignFundingDownload: jest.fn(),
}));

/* eslint-disable import/first */
import { countPendingShopProducts } from './adminProducts';
import { approveShopProductNow, createDraftProductAsAdmin, saveProductAsAdmin } from './adminProductWrite';
import { countShopAwaitingShipment, listShopArtistSales, setSkuStock } from './adminQueries';
import {
  createShopArtist, ensureStudioShopArtist, findShopArtistOfDbProduct, listShopArtistSlugsWithDbProducts, resolveShopArtist,
} from './artists';
import { createDraftProduct, loadProductForCreator, saveProduct } from './creatorProductWrite';
import { isApprovedShopMedia } from './mediaAccess';
import { findShopProductAsync, listPublishedShopProducts } from './repository';
import { createShopOrder } from './service';
import { STUDIO_SHOP_ARTIST_SLUG } from './studioArtist';
/* eslint-enable import/first */

const IMG = (creatorId: string, n = '1') => `/api/funding/media/${creatorId}-1111111${n}-1111-1111-1111-111111111111.webp?w=800&h=600`;

const value = (creatorId: string, over: Record<string, unknown> = {}) => ({
  title: '관리자 상품', subtitle: '', description: '첫 문단입니다.', images: [IMG(creatorId)], category: 'goods', kind: 'physical',
  slug: 'admin-made', shipsOn: null, editionSize: null, skus: [{ optionLabel: '', price: 20000, retired: false }], ...over,
});

const seedArtist = async () => {
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: '아티스트' });
  await testDb.insert(shopArtists).values({ creatorId: 'c1', slug: 'artist-c1' });
};

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); });

const draftSaved = async (creatorId: string, over: Record<string, unknown> = {}) => {
  const created = await createDraftProductAsAdmin({ creatorId });
  if (!created.ok) throw new Error(`setup: ${created.code}`);
  const saved = await saveProductAsAdmin(created.id, value(creatorId, over));
  if (!saved.ok) throw new Error(`setup save: ${saved.message}`);
  return created.id;
};

describe('아티스트 대신 등록 → 승인 → 공개', () => {
  it('관리자가 만든 상품은 바로 승인되어 공개되고, 그 아티스트 콘솔에도 보인다', async () => {
    await seedArtist();
    const id = await draftSaved('c1');

    // 승인 전에는 비공개, 아티스트 콘솔에는 작성 중으로 보인다.
    expect(await findShopProductAsync('admin-made')).toBeNull();
    expect((await loadProductForCreator('c1', id))?.reviewStatus).toBe('draft');

    const result = await approveShopProductNow(id, {});
    expect(result).toMatchObject({ ok: true, slug: 'admin-made' });
    expect(await findShopProductAsync('admin-made')).toMatchObject({ title: '관리자 상품', source: 'db' });
    const mine = await loadProductForCreator('c1', id);
    expect(mine).toMatchObject({ reviewStatus: 'approved', published: true });
    expect(mine?.skus.every((s) => s.locked)).toBe(true);
    // 관리자 저장은 "아티스트가 승인 뒤 고쳤다" 표시를 남기지 않는다.
    expect(mine?.creatorEditedAt).toBeNull();
  });

  it('주소를 승인 때 넘길 수 있고, 거부되면 심사 대기로 올려 둔 상태를 되돌린다', async () => {
    await seedArtist();
    const id = await draftSaved('c1', { slug: '', images: [] });
    const result = await approveShopProductNow(id, { slug: 'late-slug' });
    expect(result).toMatchObject({ ok: false, code: 'incomplete' });
    const [row] = await testDb.select().from(shopProducts).where(eq(shopProducts.id, id));
    expect(row.reviewStatus).toBe('draft');
    expect(row.submittedAt).toBeNull();
    expect(await countPendingShopProducts()).toBe(0);
  });

  it('파일 상품이 쓰는 주소로는 승인되지 않는다', async () => {
    await seedArtist();
    const id = await draftSaved('c1');
    const { SHOP_FIXTURE_PRODUCTS } = jest.requireActual('../../tests/helpers/shopFixtures');
    const taken = SHOP_FIXTURE_PRODUCTS[0].slug as string;
    expect(await approveShopProductNow(id, { slug: taken })).toMatchObject({ ok: false, code: 'duplicate_slug' });
  });

  it('이미 심사 대기인 상품도 그대로 승인한다', async () => {
    await seedArtist();
    const id = await draftSaved('c1');
    await testDb.update(shopProducts).set({ reviewStatus: 'submitted', submittedAt: 100 }).where(eq(shopProducts.id, id));
    expect(await countPendingShopProducts()).toBe(1);
    expect((await approveShopProductNow(id, {})).ok).toBe(true);
    expect(await countPendingShopProducts()).toBe(0);
  });

  it('상점 아티스트가 아닌 계정으로는 초안을 만들 수 없다', async () => {
    await testDb.insert(fundingCreators).values({ id: 'c9', email: 'c9@example.com', name: 'x' });
    expect(await createDraftProductAsAdmin({ creatorId: 'c9' })).toMatchObject({ ok: false, code: 'no_shop' });
  });

  it('관리자는 아티스트의 미심사 상한(10개)에 걸리지 않는다', async () => {
    await seedArtist();
    for (let i = 0; i < 11; i += 1) expect((await createDraftProductAsAdmin({ creatorId: 'c1' })).ok).toBe(true);
    // 아티스트 본인은 여전히 걸린다.
    expect(await createDraftProduct('c1')).toMatchObject({ ok: false, code: 'too_many' });
  });
});

describe('잠금 규칙은 관리자도 같다', () => {
  const approved = async () => {
    await seedArtist();
    const id = await draftSaved('c1', { skus: [{ optionLabel: 'A', price: 20000, retired: false }, { optionLabel: 'B', price: 30000, retired: false }] });
    expect((await approveShopProductNow(id, {})).ok).toBe(true);
    return id;
  };

  it('승인된 SKU의 가격·옵션명·삭제는 거부한다', async () => {
    const id = await approved();
    const current = (await loadProductForCreator('c1', id))!;
    const skus = current.skus.map((s) => ({ id: s.id, optionLabel: s.optionLabel, price: s.price, retired: s.retired }));
    const base = value('c1', { slug: current.slug, images: current.images });

    expect(await saveProductAsAdmin(id, { ...base, skus: [{ ...skus[0], price: 21000 }, skus[1]] })).toMatchObject({ ok: false, code: 'locked' });
    expect(await saveProductAsAdmin(id, { ...base, skus: [{ ...skus[0], optionLabel: '바꿈' }, skus[1]] })).toMatchObject({ ok: false, code: 'locked' });
    expect(await saveProductAsAdmin(id, { ...base, skus: [skus[0]] })).toMatchObject({ ok: false, code: 'locked' });
    const rows = await testDb.select().from(shopProductSkus).where(eq(shopProductSkus.productId, id));
    expect(rows.map((r) => r.price).sort()).toEqual([20000, 30000]);
  });

  it('승인된 상품의 제목·주소는 못 바꾸고 소개·부제는 바꿀 수 있다', async () => {
    const id = await approved();
    const current = (await loadProductForCreator('c1', id))!;
    const skus = current.skus.map((s) => ({ id: s.id, optionLabel: s.optionLabel, price: s.price, retired: s.retired }));
    const base = value('c1', { slug: current.slug, images: current.images, skus });
    expect(await saveProductAsAdmin(id, { ...base, title: '새 제목' })).toMatchObject({ ok: false, code: 'locked' });
    const ok = await saveProductAsAdmin(id, { ...base, subtitle: '부제', description: '고친 소개' });
    expect(ok).toMatchObject({ ok: true, product: { subtitle: '부제', description: '고친 소개' } });
  });

  it('승인 뒤에도 관리자는 예약 발송일을 바꾼다(아티스트는 못 바꾼다)', async () => {
    const id = await approved();
    const current = (await loadProductForCreator('c1', id))!;
    const skus = current.skus.map((s) => ({ id: s.id, optionLabel: s.optionLabel, price: s.price, retired: s.retired }));
    const base = value('c1', { slug: current.slug, images: current.images, skus, shipsOn: '2099-01-01' });
    expect(await saveProductAsAdmin(id, base)).toMatchObject({ ok: true, product: { shipsOn: '2099-01-01' } });
    const parsed = (await import('./creatorValidation')).validateShopProductInput({ ...base, shipsOn: '2099-02-02' }, { creatorId: 'c1', existing: current.images });
    if (!parsed.ok) throw new Error('setup');
    expect(await saveProduct('c1', id, parsed.value)).toMatchObject({ ok: false, code: 'locked' });
  });

  it('반려된 상품은 관리자도 고치지 못한다', async () => {
    await seedArtist();
    const id = await draftSaved('c1');
    await testDb.update(shopProducts).set({ reviewStatus: 'rejected' }).where(eq(shopProducts.id, id));
    expect(await saveProductAsAdmin(id, value('c1', { title: '다시' }))).toMatchObject({ ok: false, code: 'not_editable' });
  });

  it('심사 대기 상품은 관리자가 손볼 수 있다', async () => {
    await seedArtist();
    const id = await draftSaved('c1');
    await testDb.update(shopProducts).set({ reviewStatus: 'submitted', submittedAt: 1 }).where(eq(shopProducts.id, id));
    expect(await saveProductAsAdmin(id, value('c1', { title: '손봄' }))).toMatchObject({ ok: true, product: { title: '손봄' } });
  });
});

describe('관리자 업로드 사진', () => {
  it('키 앞부분이 상품 소유자면 저장 검증을 통과하고, 승인되면 공개 판정을 통과한다', async () => {
    await seedArtist();
    const id = await draftSaved('c1');
    expect(await isApprovedShopMedia('c1-11111111-1111-1111-1111-111111111111.webp')).toBe(false);
    await approveShopProductNow(id, {});
    expect(await isApprovedShopMedia('c1-11111111-1111-1111-1111-111111111111.webp')).toBe(true);
  });

  it('다른 소유자 접두사의 사진은 저장이 거부된다', async () => {
    await seedArtist();
    const created = await createDraftProductAsAdmin({ creatorId: 'c1' });
    if (!created.ok) throw new Error('setup');
    expect(await saveProductAsAdmin(created.id, value('c1', { images: [IMG('other')] }))).toMatchObject({ ok: false, code: 'invalid' });
  });
});

describe('스튜디오 자체 상품', () => {
  it('처음 등록하면 스튜디오 계정을 한 번만 만든다', async () => {
    const first = await createDraftProductAsAdmin({ studio: true });
    const second = await createDraftProductAsAdmin({ studio: true });
    expect(first.ok && second.ok).toBe(true);
    const artists = await testDb.select().from(shopArtists).where(eq(shopArtists.slug, STUDIO_SHOP_ARTIST_SLUG));
    expect(artists).toHaveLength(1);
    const [creator] = await testDb.select().from(fundingCreators).where(eq(fundingCreators.id, artists[0].creatorId));
    expect(creator.name).toBe('스튜디오 놀');
    expect((await ensureStudioShopArtist()).created).toBe(false);
  });

  it('/ko/shop 목록에는 나오지만 아티스트 페이지·링크·사이트맵 후보에는 나오지 않는다', async () => {
    const created = await createDraftProductAsAdmin({ studio: true });
    if (!created.ok) throw new Error('setup');
    const saved = await saveProductAsAdmin(created.id, value(created.creatorId, { slug: 'studio-made' }));
    if (!saved.ok) throw new Error(saved.message);
    expect((await approveShopProductNow(created.id, {})).ok).toBe(true);

    expect((await listPublishedShopProducts()).some((p) => p.slug === 'studio-made')).toBe(true);
    expect(await findShopArtistOfDbProduct('studio-made')).toBeNull();
    expect(await resolveShopArtist(STUDIO_SHOP_ARTIST_SLUG)).toBeNull();
    expect(await listShopArtistSlugsWithDbProducts()).not.toContain(STUDIO_SHOP_ARTIST_SLUG);
  });

  it('일반 아티스트 등재는 이 주소를 쓰지 못한다', async () => {
    expect(await createShopArtist({ email: 'x@example.com', name: '엑스', slug: STUDIO_SHOP_ARTIST_SLUG, linkCurated: false }))
      .toMatchObject({ ok: false, code: 'invalid' });
  });

  it('판매가 있어도 아티스트 정산 예정 표에서 빠진다(아티스트 상품은 들어간다)', async () => {
    await seedArtist();
    const studio = await createDraftProductAsAdmin({ studio: true });
    if (!studio.ok) throw new Error('setup');
    await saveProductAsAdmin(studio.id, value(studio.creatorId, { slug: 'studio-made' }));
    const mine = await draftSaved('c1', { slug: 'artist-made', images: [IMG('c1', '2')] });
    await approveShopProductNow(studio.id, {});
    await approveShopProductNow(mine, {});

    const sold = async (productId: string) => {
      const [sku] = await testDb.select().from(shopProductSkus).where(eq(shopProductSkus.productId, productId));
      expect(await setSkuStock(sku.id, 5)).toEqual({ ok: true });
      const r = await createShopOrder(shopPayload([{ skuId: sku.id, quantity: 1 }]), new Date(), { salesOpen: true });
      if (!r.ok) throw new Error(`order: ${r.code}`);
      await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
      await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'shipped', shipped_at = ${Date.UTC(2026, 9, 15) / 1000} WHERE order_no = ${r.orderNo}`);
    };
    await sold(studio.id);
    await sold(mine);
    const rows = await listShopArtistSales('2026-10');
    expect(rows.map((r) => r.artistSlug)).toEqual(['creator:c1']);
  });
});

describe('대시보드 건수', () => {
  it('심사 대기 상품 수와 발송 대기 주문 수를 센다', async () => {
    await seedArtist();
    expect(await countPendingShopProducts()).toBe(0);
    expect(await countShopAwaitingShipment()).toEqual({ studio: 0, preorder: 0, artist: 0 });

    const id = await draftSaved('c1');
    await testDb.update(shopProducts).set({ reviewStatus: 'submitted', submittedAt: 1 }).where(eq(shopProducts.id, id));
    expect(await countPendingShopProducts()).toBe(1);

    await approveShopProductNow(id, {});
    const [sku] = await testDb.select().from(shopProductSkus).where(eq(shopProductSkus.productId, id));
    await setSkuStock(sku.id, 3);
    const r = await createShopOrder(shopPayload([{ skuId: sku.id, quantity: 1 }]), new Date(), { salesOpen: true });
    if (!r.ok) throw new Error('setup');
    // 결제 전(pending)은 세지 않는다.
    expect(await countShopAwaitingShipment()).toEqual({ studio: 0, preorder: 0, artist: 0 });
    await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
    expect(await countShopAwaitingShipment()).toEqual({ studio: 1, preorder: 0, artist: 0 });
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'shipped' WHERE order_no = ${r.orderNo}`);
    expect(await countShopAwaitingShipment()).toEqual({ studio: 0, preorder: 0, artist: 0 });
  });

  it('표가 없으면 null이다(대시보드는 그 카드만 숨긴다)', async () => {
    await testDb.run(sql.raw('DROP TABLE shop_products'));
    expect(await countPendingShopProducts()).toBeNull();
    await testDb.run(sql.raw('DROP TABLE shop_orders'));
    expect(await countShopAwaitingShipment()).toBeNull();
  });
});
