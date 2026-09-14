const { SUPPORTED_ARTIST_COUNT } = require('./artistsMeta');
const { SUPPORTED_ARTISTS } = require('../../data/artists');

/**
 * artistsMeta.js의 CJS 거울 값이 data/artists/index.ts의 실제 개수와 갈리지 않게
 * 고정한다. next-sitemap.config.js는 이 값이 0일 때 /:locale/artists를 사이트맵에서
 * 뺀다(pages/[locale]/artists/index.tsx가 같은 조건으로 noindex를 굽는 것과 대칭) —
 * 값이 갈리면 noindex 페이지가 사이트맵에 실리거나(2026-09-14 적발 사고) 반대로
 * index 가능한 페이지가 계속 빠지는 두 방향 회귀가 모두 조용히 일어난다.
 */
it('artistsMeta의 SUPPORTED_ARTIST_COUNT가 실제 아티스트 수와 같다', () => {
  expect(SUPPORTED_ARTIST_COUNT).toBe(SUPPORTED_ARTISTS.length);
});
