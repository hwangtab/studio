import type { GetServerSideProps } from 'next';

import { getDb } from '../db/client';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 공연 상세(`/ko/shows/<slug>`) 런타임 사이트맵. 공개 여부(published)가 DB에 있어
 * next-sitemap(파일만 읽는다)이 알 수 없다 — 펀딩 DB 프로젝트와 같은 이유·같은 방식이다.
 * 취소된 공연은 싣지 않는다.
 */
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  let entries: { slug: string; lastmod: string }[] = [];
  try {
    const rows = await getDb().query.shows.findMany({ where: (s, { eq }) => eq(s.status, 'published') });
    entries = rows.map((s) => ({ slug: s.slug, lastmod: new Date(s.updatedAt * 1000).toISOString() }));
  } catch (error: unknown) {
    // 500을 내면 검색엔진이 "가져올 수 없음"으로 기록한다. 빈 사이트맵이 낫다.
    console.error('[shows] 사이트맵 DB 조회 실패:', error);
  }
  // 목록 페이지(/ko/shows)는 공개된 공연이 하나라도 있을 때만 싣는다 — 빈 목록을 색인에 내밀지 않는다.
  const listLastmod = entries.map((e) => e.lastmod).sort().at(-1);
  const urls = [
    ...(listLastmod ? [`  <url>\n    <loc>${escapeXml(`${SITE_URL}/ko/shows`)}</loc>\n    <lastmod>${escapeXml(listLastmod)}</lastmod>\n  </url>`] : []),
    ...entries.map(
      (e) => `  <url>\n    <loc>${escapeXml(`${SITE_URL}/ko/shows/${e.slug}`)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n  </url>`,
    ),
  ].join('\n');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  res.end();
  return { props: {} };
};

export default function ShowsSitemap() {
  return null;
}
