import type { ShopProduct } from '../../data/shop/catalog';
import { shopArtistTermsAgreements } from '../../db/schema';
import { SHOP_ARTIST_TERMS_VERSION } from '../../lib/shop/artistTerms';
import type { ShowsTestDb } from './showsDb';

/** 상점 테스트용 카탈로그 — data/shop/catalog.ts를 jest.mock으로 이걸로 바꾼다. */
export const SHOP_FIXTURE_PRODUCTS: ShopProduct[] = [
  {
    slug: 'test-cd', category: 'album', title: '테스트 앨범', description: ['테스트 앨범 소개.'],
    images: ['/images/shop/test-cd-20261101.webp'], skus: [{ id: 'test-cd-std', price: 20000 }], published: true,
  },
  {
    slug: 'test-tee', category: 'goods', title: '테스트 티셔츠', description: ['티셔츠 소개.'],
    images: ['/images/shop/test-tee-20261101.webp'],
    skus: [{ id: 'test-tee-m', optionLabel: 'M', price: 35000 }, { id: 'test-tee-l', optionLabel: 'L', price: 35000 }, { id: 'test-tee-old', optionLabel: 'S', price: 30000, retired: true }],
    published: true,
  },
  {
    slug: 'test-hidden', category: 'goods', title: '비공개', description: ['비공개 상품.'],
    images: [], skus: [{ id: 'test-hidden-std', price: 10000 }], published: false,
  },
];

export const shopPayload = (lines: Array<{ skuId: string; quantity: number }>, over: Record<string, unknown> = {}) => ({
  lines,
  customerName: '김구매',
  customerPhone: '010-1234-5678',
  customerEmail: 'buyer@example.com',
  shipping: { recipientName: '김구매', recipientPhone: '010-1234-5678', postcode: '03000', address1: '서울 종로구 어딘가 1', address2: null, shippingMemo: null },
  ...over,
});

/**
 * 상점 아티스트가 현재 판본 위탁 약관에 동의한 상태로 만든다 — 승인·콘솔 쓰기 게이트(`lib/shop/artistTermsAgreement.ts`)를 통과시키는 시드.
 * 게이트 자체를 보는 테스트는 이 헬퍼를 부르지 않는다.
 */
export const agreeShopArtistTermsForTest = async (
  db: { insert: ShowsTestDb['insert'] },
  ...creatorIds: string[]
): Promise<void> => {
  if (creatorIds.length === 0) return;
  await db.insert(shopArtistTermsAgreements).values(creatorIds.map((creatorId) => ({ creatorId, termsVersion: SHOP_ARTIST_TERMS_VERSION, agreedAt: 1_790_000_000 })));
};
