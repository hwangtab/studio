import type { ShopProduct } from '../../data/shop/catalog';

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
