import type { GetServerSideProps } from 'next';

import { listDbFundingProjects } from '../lib/funding/dbProjects';
import { buildFundingSitemapXml } from '../lib/funding/sitemapXml';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  let entries: { slug: string; lastmod: string }[] = [];
  try {
    const projects = await listDbFundingProjects();
    entries = projects
      .filter((p) => !p.hidden && p.status !== 'draft')
      .map((p) => ({ slug: p.slug, lastmod: p.lastmod }));
  } catch (error: unknown) {
    // 사이트맵이 500을 내면 검색엔진은 "가져올 수 없음"으로 기록한다. 빈 사이트맵이 낫다.
    console.error('[funding] 사이트맵 DB 조회 실패:', error);
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.write(buildFundingSitemapXml(entries, SITE_URL));
  res.end();
  return { props: {} };
};

export default function FundingSitemap() {
  return null;
}
