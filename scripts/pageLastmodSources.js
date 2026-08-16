const path = require('node:path');

// lastmod을 필요로 하는 라우트 소스 파일 목록 — lib/sitemap/routes.js getRouteLastmod의
// 소비처와 1:1로 대응한다.
//
// CJS로 따로 둔 이유: 생성기(scripts/generate-page-lastmod.mjs, ESM)와 커버리지 테스트
// (lib/sitemap/routes.test.js, jest CJS)가 같은 목록을 봐야 하는데, jest가 ESM 스크립트를
// require할 수 없다. 목록이 두 벌로 갈리면 "라우트를 추가했는데 테스트는 통과"하는
// 조용한 구멍이 생긴다.

/** @returns {string[]} 저장소 상대 경로(POSIX 구분자), 정렬됨 */
const collectSourceFiles = () => {
  // 지연 require — routes.js가 이 모듈을 참조하지는 않지만, 순환을 만들지 않도록 호출 시점에 읽는다.
  const { pageRouteMap } = require('../lib/sitemap/routes.js');

  const files = new Set();
  for (const pageFile of Object.values(pageRouteMap)) {
    files.add(path.posix.join('pages/[locale]', pageFile.split(path.sep).join('/')));
  }
  // 동적 라우트 2종은 페이지 파일이 아니라 콘텐츠 단일 소스의 날짜를 쓴다.
  files.add('data/portfolio.ts'); // /portfolio/{id}
  files.add('data/buyerIntentHubs.ts'); // /guides/{slug}
  return [...files].sort();
};

module.exports = { collectSourceFiles };
