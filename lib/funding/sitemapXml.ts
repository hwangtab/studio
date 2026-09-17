const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * DB 프로젝트 전용 사이트맵.
 *
 * next-sitemap은 postbuild에 돌고 파일만 읽으므로 DB 프로젝트를 모른다. 빌드가 DB를 보게
 * 만드는 대신(빌드는 TURSO_* 없이도 성공해야 한다) 런타임 라우트로 내보내고 robots.txt에
 * 주소를 적어 색인 경로를 연다.
 */
export const buildFundingSitemapXml = (
  entries: { slug: string; lastmod: string }[],
  siteUrl: string,
): string => {
  const base = siteUrl.replace(/\/+$/, '');
  const urls = entries
    .map((e) => `  <url>\n    <loc>${escapeXml(`${base}/ko/funding/${e.slug}`)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};
