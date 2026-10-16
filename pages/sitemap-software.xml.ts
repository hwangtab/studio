import type { GetServerSideProps } from 'next';

import { SOFTWARE_SALES_OPEN } from '../data/software/policy';
import { listPublishedSoftware } from '../lib/software/catalog';
import { buildSoftwareSitemapPaths } from '../lib/software/sitemap';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 소프트웨어(`/ko·en/software`·상품 상세) 런타임 사이트맵 — 상점 `sitemap-shop.xml.ts`와 같은 방식이다(상세가 SSR이라
 * next-sitemap이 열거하지 않는다). SOFTWARE_SALES_OPEN이 false면 빈 urlset.
 */
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const paths = buildSoftwareSitemapPaths({ open: SOFTWARE_SALES_OPEN, productSlugs: listPublishedSoftware().map((p) => p.slug) });
  const urls = paths.map((p) => `  <url>\n    <loc>${escapeXml(`${SITE_URL}${p}`)}</loc>\n  </url>`).join('\n');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  res.end();
  return { props: {} };
};

export default function SoftwareSitemap() {
  return null;
}
