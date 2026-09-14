/** @jest-environment node */

const sitemapConfig = require('../../next-sitemap.config.js');
const { SUPPORTED_ARTIST_COUNT } = require('./artistsMeta');

/**
 * 회귀 방지: /ko/artists가 noindex로 렌더되는데(아티스트 0명) 사이트맵에는 실려 있던
 * 사고(2026-09-14 라이브 확인, https://studionol.co.kr/sitemap-0.xml). 페이지의
 * noindex 조건(pages/[locale]/artists/index.tsx: artists.length === 0)과 사이트맵
 * transform이 lib/sitemap/artistsMeta.js의 같은 값을 보게 했다.
 */
describe('next-sitemap transform — /artists noindex 정합', () => {
  it('아티스트 0명이면 /ko/artists를 사이트맵에서 뺀다', async () => {
    expect(SUPPORTED_ARTIST_COUNT).toBe(0); // 현재 상태 전제 — 아티스트가 생기면 이 줄과 함께 대조 테스트도 갱신
    const config = { changefreq: 'weekly', priority: 0.7 };
    const result = await sitemapConfig.transform(config, '/ko/artists');
    expect(result).toBeNull();
  });
});
