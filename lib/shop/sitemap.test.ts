import { buildShopSitemapPaths } from './sitemap';

describe('buildShopSitemapPaths', () => {
  const input = { productSlugs: ['a', 'b'], artistSlugs: ['x'] };

  it('판매가 닫혀 있으면 URL이 하나도 없다', () => {
    expect(buildShopSitemapPaths({ ...input, open: false })).toEqual([]);
  });

  it('열려 있으면 목록·상품·아티스트 상점을 싣는다', () => {
    expect(buildShopSitemapPaths({ ...input, open: true })).toEqual([
      '/ko/shop', '/ko/shop/a', '/ko/shop/b', '/ko/shop/artist/x',
    ]);
  });

  it('공개 상품이 없으면 빈 목록을 내밀지 않는다', () => {
    expect(buildShopSitemapPaths({ open: true, productSlugs: [], artistSlugs: [] })).toEqual([]);
  });
});
