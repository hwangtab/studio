/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server';

import ShopProductDetail from '../../../components/shop/ShopProductDetail';
import type { ShopProduct } from '../../../data/shop/catalog';

const base: ShopProduct = {
  slug: 'dig-album', category: 'album', title: '디지털 음반', description: ['소개'], images: [],
  skus: [{ id: 'db-aaaaaaaaaa', price: 5000 }], published: true, kind: 'digital', hasDownloads: true, source: 'db',
};

describe('ShopProductDetail 미리듣기', () => {
  it('디지털 상품은 라벨별 audio를 preload="none"으로 그리고 키를 싣지 않는다', () => {
    const html = renderToStaticMarkup(<ShopProductDetail product={{ ...base, previews: ['A면 1분', 'B면 1분'] }} />);
    expect(html).toContain('미리듣기');
    expect(html.match(/<audio/g)).toHaveLength(2);
    expect(html.match(/preload="none"/g)).toHaveLength(2);
    expect(html).toContain('src="/api/shop/preview?product=dig-album&amp;i=0"');
    expect(html).toContain('src="/api/shop/preview?product=dig-album&amp;i=1"');
    expect(html).not.toMatch(/\.mp3|\.zip|digital_files/);
  });

  it('미리듣기가 없거나 실물이면 블록이 없다', () => {
    expect(renderToStaticMarkup(<ShopProductDetail product={base} />)).not.toContain('<audio');
    expect(renderToStaticMarkup(<ShopProductDetail product={{ ...base, kind: 'physical', previews: ['x'] }} />)).not.toContain('<audio');
  });
});
