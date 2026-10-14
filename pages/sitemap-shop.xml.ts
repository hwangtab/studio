import type { GetServerSideProps } from 'next';

import { SHOP_SALES_OPEN } from '../data/shop/policy';
import { loadShopPublicIndex } from '../lib/shop/publicIndex';
import { buildShopSitemapPaths } from '../lib/shop/sitemap';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 상점(`/ko/shop`·상품 상세·아티스트 상점) 런타임 사이트맵 — 공연 `sitemap-shows.xml.ts`와 같은 방식이다.
 * 상품이 DB에도 있어 next-sitemap(파일만 읽는다)이 알 수 없다. SHOP_SALES_OPEN이 false면 빈 urlset.
 */
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  let paths: string[] = [];
  if (SHOP_SALES_OPEN) {
    try {
      const { products, artists } = await loadShopPublicIndex();
      paths = buildShopSitemapPaths({
        open: true,
        productSlugs: products.map((p) => p.slug),
        artistSlugs: artists.map((a) => a.slug),
      });
    } catch (error: unknown) {
      console.error('[shop] 사이트맵 조회 실패:', error);
    }
  }
  const urls = paths.map((p) => `  <url>\n    <loc>${escapeXml(`${SITE_URL}${p}`)}</loc>\n  </url>`).join('\n');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  res.end();
  return { props: {} };
};

export default function ShopSitemap() {
  return null;
}
