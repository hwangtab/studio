import type { ShopProduct } from '../../data/shop/catalog';
import { renderShopLlmsSection } from './llms';

const product: ShopProduct = {
  slug: 'lp-one', category: 'album', title: '첫 음반', description: ['설명'], images: [], published: true,
  skus: [{ id: 'lp-one-a', price: 20000 }, { id: 'lp-one-b', optionLabel: 'B', price: 25000 }],
};

describe('renderShopLlmsSection', () => {
  const base = { siteUrl: 'https://x.test', products: [product], artists: [{ slug: 'artist-a', name: '아티스트A' }] };

  it('판매가 닫혀 있으면 아무것도 내지 않는다', () => {
    expect(renderShopLlmsSection({ ...base, open: false })).toBe('');
  });

  it('공개 상품이 없으면 아무것도 내지 않는다', () => {
    expect(renderShopLlmsSection({ ...base, open: true, products: [] })).toBe('');
  });

  it('열려 있으면 상품(이름·가격·주소)과 아티스트 상점을 낸다', () => {
    const out = renderShopLlmsSection({ ...base, open: true });
    expect(out).toContain('첫 음반');
    expect(out).toContain('from 20,000 KRW');
    expect(out).toContain('https://x.test/ko/shop/lp-one');
    expect(out).toContain('https://x.test/ko/shop/artist/artist-a');
  });

  it('판매자는 스튜디오, 발송은 상품에 따라 아티스트일 수 있다고 말한다(스튜디오가 다 보낸다고 하지 않는다)', () => {
    const out = renderShopLlmsSection({ ...base, open: true });
    expect(out).toContain('Sold by Studio NOL');
    expect(out).toContain('some artist items ship directly from the artist');
    expect(out).not.toContain('Sold and shipped by Studio NOL');
  });
});
