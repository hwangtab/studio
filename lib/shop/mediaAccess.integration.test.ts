import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, shopArtists, shopProducts } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));

// eslint-disable-next-line import/first
import { isApprovedShopMedia } from './mediaAccess';

const IMG = (n: string) => `/api/funding/media/c1-${n}.webp?w=1600&h=900`;

const seed = async (over: Partial<typeof shopProducts.$inferInsert> = {}, artist = true) => {
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'a@example.com', name: '아티스트' });
  if (artist) await testDb.insert(shopArtists).values({ creatorId: 'c1', slug: 'a', profileImageUrl: IMG('avatar') });
  await testDb.insert(shopProducts).values({
    id: 'p1', creatorId: 'c1', slug: 'thing', category: 'goods', title: '굿즈', description: '소개',
    images: JSON.stringify([IMG('one'), IMG('two')]), reviewStatus: 'approved', published: true, ...over,
  });
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('승인·공개 상품의 모든 사진과 프로필 사진이 공개다', async () => {
  await seed();
  expect(await isApprovedShopMedia('c1-one.webp')).toBe(true);
  expect(await isApprovedShopMedia('c1-two.webp')).toBe(true);
  expect(await isApprovedShopMedia('c1-avatar.webp')).toBe(true);
  expect(await isApprovedShopMedia('c1-other.webp')).toBe(false);
});

it.each([['초안', { reviewStatus: 'draft' as const }], ['심사 중', { reviewStatus: 'submitted' as const }]])(
  '%s 상품의 사진은 비공개이고, 승인 상품이 없으면 프로필 사진도 비공개다',
  async (_l, over) => {
    await seed(over);
    expect(await isApprovedShopMedia('c1-one.webp')).toBe(false);
    expect(await isApprovedShopMedia('c1-avatar.webp')).toBe(false);
  },
);

it('승인됐지만 비공개로 돌린 상품이 있으면 프로필 사진은 공개 상태를 유지한다(승인 상품 기준)', async () => {
  await seed({ published: false });
  expect(await isApprovedShopMedia('c1-avatar.webp')).toBe(true);
  expect(await isApprovedShopMedia('c1-one.webp')).toBe(false);
});

it('오류면 false다', async () => {
  await seed();
  await testDb.run(sql.raw('DROP TABLE shop_products'));
  expect(await isApprovedShopMedia('c1-one.webp')).toBe(false);
});
