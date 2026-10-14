import { SHOP_PRODUCTS, type ShopProduct } from './catalog';
import { SHOP_FREE_SHIPPING_FROM, SHOP_SHIPPING_FEE, shopShippingFeeFor } from './policy';
import { validateShopCatalog } from '../../lib/shop/catalog';
import { computeShopTotals } from '../../lib/shop/amounts';
import { SHOP_FIXTURE_PRODUCTS } from '../../tests/helpers/shopFixtures';
import { getSupportedArtist } from '../artists';

describe('상점 카탈로그(data/shop/catalog.ts)', () => {
  it('모양 검사를 통과한다', () => {
    expect(validateShopCatalog(SHOP_PRODUCTS)).toEqual([]);
  });

  it('아티스트 상품의 artist는 data/artists에 등재된 아티스트다(아티스트 페이지·정산 세금 유형이 거기서 온다)', () => {
    const unknown = SHOP_PRODUCTS.filter((p) => p.artist !== undefined && !getSupportedArtist(p.artist)).map((p) => `${p.slug} → ${p.artist}`);
    expect(unknown).toEqual([]);
  });

  it('테스트 고정 카탈로그도 통과한다(검사기가 정상 정의를 막지 않는다)', () => {
    expect(validateShopCatalog(SHOP_FIXTURE_PRODUCTS)).toEqual([]);
  });

  const base: ShopProduct = {
    slug: 'a', category: 'album', title: 'A', description: ['소개'], images: ['/images/shop/a-20261101.webp'],
    skus: [{ id: 'a-1', price: 10000 }], published: true,
  };

  it.each([
    ['예약 slug', { ...base, slug: 'manage' }, /예약된 slug/],
    ['날짜 없는 이미지', { ...base, images: ['/images/shop/a.webp'] }, /YYYYMMDD/],
    ['0원', { ...base, skus: [{ id: 'a-1', price: 0 }] }, /가격/],
    ['옵션 이름 없는 복수 SKU', { ...base, skus: [{ id: 'a-1', price: 1 }, { id: 'a-2', price: 1 }] }, /optionLabel/],
    ['첫 문단 소제목', { ...base, description: ['## 소제목'] }, /평문/],
    ['artist 형식', { ...base, artist: 'Jai' }, /artist/],
    ['예약 slug artist(상점 아티스트 페이지)', { ...base, slug: 'artist' }, /예약된 slug/],
    ['db- 접두사 SKU', { ...base, skus: [{ id: 'db-abc123', price: 1000 }] }, /db-/],
    ['파일 상품의 디지털 종류', { ...base, kind: 'digital' }, /DB 상품 전용/],
    ['파일 상품의 한정판 수량', { ...base, editionSize: 100 }, /editionSize/],
  ])('%s를 잡는다', (_label, product, pattern) => {
    expect(validateShopCatalog([product as ShopProduct]).join('\n')).toMatch(pattern);
  });

  it('SKU id는 상품을 넘어 전역에서 겹치면 안 된다', () => {
    expect(validateShopCatalog([base, { ...base, slug: 'b' }]).join('\n')).toMatch(/중복/);
  });
});

describe('배송비', () => {
  it(`상품 합계 ${SHOP_FREE_SHIPPING_FROM}원부터 무료, 그 아래는 ${SHOP_SHIPPING_FEE}원`, () => {
    expect(shopShippingFeeFor(SHOP_FREE_SHIPPING_FROM - 1)).toBe(SHOP_SHIPPING_FEE);
    expect(shopShippingFeeFor(SHOP_FREE_SHIPPING_FROM)).toBe(0);
  });

  it('운영자 결정값(2026-10-12): 배송비 4,000원 · 20만원 이상 무료', () => {
    expect(SHOP_SHIPPING_FEE).toBe(4000);
    expect(SHOP_FREE_SHIPPING_FROM).toBe(200000);
  });

  it('합계 = 상품 + 배송비(주문당 한 번)', () => {
    expect(computeShopTotals([{ unitPrice: 20000, quantity: 2 }, { unitPrice: 15000, quantity: 1 }])).toEqual({ subtotal: 55000, physicalSubtotal: 55000, shippingFee: SHOP_SHIPPING_FEE, total: 55000 + SHOP_SHIPPING_FEE });
    expect(computeShopTotals([])).toEqual({ subtotal: 0, physicalSubtotal: 0, shippingFee: 0, total: 0 });
  });
});
