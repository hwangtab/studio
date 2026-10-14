/** @jest-environment node */
/**
 * 공개 아티스트 상점 페이지(SSR)의 노출 조건 — 아티스트가 없거나 공개 상품이 0개면 404, ko 아니면 ko 주소로,
 * props에 creatorId·이메일이 실리지 않는다.
 */
import type { GetServerSidePropsContext } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus } from '../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../data/shop/catalog', () => ({
  ...jest.requireActual('../../../data/shop/catalog'),
  SHOP_PRODUCTS: [],
}));

/* eslint-disable import/first */
import { getServerSideProps } from '../../../pages/[locale]/shop/artist/[slug]';
/* eslint-enable import/first */

const run = async (locale: string, slug: string) => {
  const setHeader = jest.fn();
  const result = await getServerSideProps({ params: { locale, slug }, query: {}, res: { setHeader } } as unknown as GetServerSidePropsContext);
  return { result, setHeader };
};

const seedArtist = async (productStatus: 'approved' | 'draft' | null) => {
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'secret@example.com', name: '아티스트', phone: '010-0000-0000' });
  await testDb.insert(shopArtists).values({ creatorId: 'c1', slug: 'someone' });
  if (!productStatus) return;
  await testDb.insert(shopProducts).values({
    id: 'p1', creatorId: 'c1', slug: 'thing', category: 'goods', title: '굿즈', description: '소개', images: '[]',
    reviewStatus: productStatus, published: true,
  });
  await testDb.insert(shopProductSkus).values({ id: 'db-aaaaaaaaaa', productId: 'p1', price: 10000, lockedAt: 1 });
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('없는 아티스트는 404다', async () => {
  expect((await run('ko', 'nobody')).result).toEqual({ notFound: true });
});

it('공개 상품이 하나도 없으면 404다', async () => {
  await seedArtist(null);
  expect((await run('ko', 'someone')).result).toEqual({ notFound: true });
  await testDb.delete(shopProductSkus);
  await testDb.delete(shopProducts);
  await seedProductDraft();
  expect((await run('ko', 'someone')).result).toEqual({ notFound: true });
});

async function seedProductDraft() {
  await testDb.insert(shopProducts).values({
    id: 'p2', creatorId: 'c1', slug: 'draft', category: 'goods', title: '초안', description: '소개', images: '[]', reviewStatus: 'draft', published: false,
  });
}

it('공개 상품이 있으면 열리고, 공개할 수 없는 값은 props에 없다', async () => {
  await seedArtist('approved');
  const { result, setHeader } = await run('ko', 'someone');
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  const props = (result as { props: { artist: Record<string, unknown>; products: Array<{ slug: string }> } }).props;
  expect(props.products.map((p) => p.slug)).toEqual(['thing']);
  expect(Object.keys(props.artist).sort()).toEqual(['bio', 'curatedSlug', 'links', 'name', 'profileImage', 'slug']);
  const json = JSON.stringify(props);
  expect(json).not.toContain('secret@example.com');
  expect(json).not.toContain('010-0000-0000');
  expect(json).not.toContain('"c1"');
});

it('ko가 아니면 ko 주소로 보낸다', async () => {
  expect((await run('en', 'someone')).result).toEqual({ redirect: { destination: '/ko/shop/artist/someone', permanent: false } });
  expect((await run('en', 'Bad Slug')).result).toEqual({ redirect: { destination: '/ko/shop', permanent: false } });
});
