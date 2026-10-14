import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/artists', () => ({
  getSupportedArtist: (slug: string) => (slug === 'curated-one'
    ? { slug: 'curated-one', name: '큐레이션 아티스트', bio: '파일 소개', image: '/images/x.webp', links: { site: 'https://curated.example', instagram: 'javascript:alert(1)' } }
    : null),
}));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));

/* eslint-disable import/first */
import {
  createShopArtist, findShopArtistOfDbProduct, listShopArtistsForAdmin, resolveShopArtist, setShopArtistProfileImage, updateShopArtistSlug,
} from './artists';
import { listShopProductsByArtist } from './repository';
/* eslint-enable import/first */

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const base = { email: 'Artist@Example.com', name: '이름', slug: 'my-artist', linkCurated: false };

const seedProduct = async (creatorId: string, slug: string, over: Partial<typeof shopProducts.$inferInsert> = {}) => {
  const id = `p-${slug}`;
  await testDb.insert(shopProducts).values({
    id, creatorId, slug, category: 'goods', title: `상품 ${slug}`, description: '소개', images: '[]',
    reviewStatus: 'approved', published: true, ...over,
  });
  await testDb.insert(shopProductSkus).values({ id: `db-${slug.replace(/-/g, '').slice(0, 10).padEnd(10, 'a')}`, productId: id, price: 10000, lockedAt: 1 });
  return id;
};

describe('createShopArtist', () => {
  it('이메일을 소문자로 정규화해 계정을 만들고 등재한다', async () => {
    const r = await createShopArtist(base);
    expect(r.ok).toBe(true);
    const [creator] = await testDb.select().from(fundingCreators);
    expect(creator.email).toBe('artist@example.com');
    expect(creator.name).toBe('이름');
    const [row] = await testDb.select().from(shopArtists);
    expect(row).toMatchObject({ slug: 'my-artist', curatedSlugLinked: false });
  });

  it('이미 있는 계정은 재사용하고 이름을 덮지 않는다', async () => {
    await testDb.insert(fundingCreators).values({ id: 'c1', email: 'artist@example.com', name: '기존 이름' });
    const r = await createShopArtist(base);
    expect(r).toEqual({ ok: true, creatorId: 'c1' });
    expect(await testDb.select().from(fundingCreators)).toHaveLength(1);
    const [creator] = await testDb.select().from(fundingCreators).where(eq(fundingCreators.id, 'c1'));
    expect(creator.name).toBe('기존 이름');
  });

  it('기본 이름(이메일 앞부분)인 계정은 입력한 이름으로 채운다', async () => {
    await testDb.insert(fundingCreators).values({ id: 'c1', email: 'artist@example.com', name: 'artist' });
    await createShopArtist(base);
    const [creator] = await testDb.select().from(fundingCreators);
    expect(creator.name).toBe('이름');
  });

  it('data/artists와 같은 slug는 확인 없이는 거부하고, 확인하면 연결 표시로 저장한다', async () => {
    const denied = await createShopArtist({ ...base, slug: 'curated-one' });
    expect(denied).toMatchObject({ ok: false, code: 'curated_not_linked' });
    expect(await testDb.select().from(shopArtists)).toHaveLength(0);
    const ok = await createShopArtist({ ...base, slug: 'curated-one', linkCurated: true });
    expect(ok.ok).toBe(true);
    const [row] = await testDb.select().from(shopArtists);
    expect(row.curatedSlugLinked).toBe(true);
  });

  it.each(['Bad Slug', 'artist', '', 'a'.repeat(41), '-x'])('slug %p는 거부한다', async (slug) => {
    expect(await createShopArtist({ ...base, slug })).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('이메일이 틀렸거나 이름이 없으면 거부한다', async () => {
    expect(await createShopArtist({ ...base, email: 'nope' })).toMatchObject({ ok: false, code: 'invalid' });
    expect(await createShopArtist({ ...base, name: '  ' })).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('쓰는 slug·이미 등재된 아티스트는 거부한다', async () => {
    await createShopArtist(base);
    expect(await createShopArtist({ ...base, email: 'other@example.com' })).toMatchObject({ ok: false, code: 'slug_taken' });
    expect(await createShopArtist({ ...base, slug: 'second' })).toMatchObject({ ok: false, code: 'already_registered' });
  });
});

describe('updateShopArtistSlug', () => {
  it('승인된 상품이 없으면 바꿀 수 있다', async () => {
    const r = await createShopArtist(base);
    if (!r.ok) throw new Error('setup');
    expect((await updateShopArtistSlug({ creatorId: r.creatorId, slug: 'renamed', linkCurated: false })).ok).toBe(true);
    const [row] = await testDb.select().from(shopArtists);
    expect(row.slug).toBe('renamed');
  });

  it('승인된 상품이 있으면 거부한다 — 초안만 있으면 바꿀 수 있다', async () => {
    const r = await createShopArtist(base);
    if (!r.ok) throw new Error('setup');
    await seedProduct(r.creatorId, 'draft-one', { reviewStatus: 'draft', published: false });
    expect((await updateShopArtistSlug({ creatorId: r.creatorId, slug: 'renamed', linkCurated: false })).ok).toBe(true);
    await seedProduct(r.creatorId, 'approved-one');
    expect(await updateShopArtistSlug({ creatorId: r.creatorId, slug: 'again', linkCurated: false })).toMatchObject({ ok: false, code: 'locked' });
  });

  it('큐레이션 slug로 바꾸려면 확인이 필요하다', async () => {
    const r = await createShopArtist(base);
    if (!r.ok) throw new Error('setup');
    expect(await updateShopArtistSlug({ creatorId: r.creatorId, slug: 'curated-one', linkCurated: false })).toMatchObject({ ok: false, code: 'curated_not_linked' });
  });
});

describe('resolveShopArtist·listShopProductsByArtist', () => {
  it('data/artists가 먼저 이긴다 — http(s) 링크만, creatorId는 없다', async () => {
    expect(await resolveShopArtist('curated-one')).toMatchObject({
      name: '큐레이션 아티스트', links: ['https://curated.example'], curatedSlug: 'curated-one', creatorId: null,
    });
  });

  it('shop_artists만 있는 아티스트를 풀어 준다', async () => {
    const r = await createShopArtist(base);
    if (!r.ok) throw new Error('setup');
    await testDb.update(fundingCreators).set({ links: JSON.stringify(['https://a.example', 'javascript:x', 'http://b.example']), bio: '소개' });
    await setShopArtistProfileImage(r.creatorId, '/api/funding/media/c-1.webp?w=640&h=640');
    expect(await resolveShopArtist('my-artist')).toEqual({
      slug: 'my-artist', name: '이름', bio: '소개', links: ['https://a.example', 'http://b.example'],
      profileImage: '/api/funding/media/c-1.webp?w=640&h=640', curatedSlug: null, creatorId: r.creatorId,
    });
    expect(await resolveShopArtist('nobody')).toBeNull();
  });

  it('공개 DB 상품만 모은다 — 초안·비공개·남의 상품은 뺀다', async () => {
    const a = await createShopArtist(base);
    const b = await createShopArtist({ ...base, email: 'b@example.com', slug: 'other-artist' });
    if (!a.ok || !b.ok) throw new Error('setup');
    await seedProduct(a.creatorId, 'open-one');
    await seedProduct(a.creatorId, 'draft-one', { reviewStatus: 'draft', published: false });
    await seedProduct(a.creatorId, 'hidden-one', { published: false });
    await seedProduct(b.creatorId, 'theirs');
    expect((await listShopProductsByArtist('my-artist')).map((p) => p.slug)).toEqual(['open-one']);
    expect(await listShopProductsByArtist('nobody')).toEqual([]);
  });

  it('파일 slug에 가려지는 DB 상품은 뺀다', async () => {
    const a = await createShopArtist(base);
    if (!a.ok) throw new Error('setup');
    await seedProduct(a.creatorId, 'test-cd');
    expect(await listShopProductsByArtist('my-artist')).toEqual([]);
  });

  it('DB 오류는 삼키고 빈 목록을 돌려준다', async () => {
    await testDb.run(sql.raw('DROP TABLE shop_artists'));
    expect(await listShopProductsByArtist('my-artist')).toEqual([]);
  });

  it('DB 상품의 아티스트를 slug로 찾는다', async () => {
    const a = await createShopArtist(base);
    if (!a.ok) throw new Error('setup');
    await seedProduct(a.creatorId, 'open-one');
    expect(await findShopArtistOfDbProduct('open-one')).toEqual({ slug: 'my-artist', name: '이름' });
    expect(await findShopArtistOfDbProduct('nope')).toBeNull();
  });
});

describe('listShopArtistsForAdmin', () => {
  it('승인 상품 수를 센다', async () => {
    const a = await createShopArtist(base);
    if (!a.ok) throw new Error('setup');
    await seedProduct(a.creatorId, 'open-one');
    await seedProduct(a.creatorId, 'draft-one', { reviewStatus: 'draft' });
    expect(await listShopArtistsForAdmin()).toEqual([expect.objectContaining({ email: 'artist@example.com', slug: 'my-artist', approvedProducts: 1 })]);
  });
});
