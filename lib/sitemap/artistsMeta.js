// 정본은 data/artists/index.ts의 SUPPORTED_ARTISTS다. next-sitemap.config.js는 next
// 빌드 파이프라인 밖에서 도는 순수 CJS 스크립트(postbuild)라, data/artists → data/portfolio로
// 이어지는 배럴 임포트 체인을 가진 TS 모듈을 직접 require할 수 없다
// (`ERR_UNSUPPORTED_DIR_IMPORT` — data/portfolio가 디렉터리 임포트라 Node ESM/CJS
// 로더가 거부한다. 확인: `node -e "require('./data/artists/index.ts')"`).
//
// 이 파일은 그 값의 CJS측 거울이다. artistsMeta.test.js가 매 테스트런마다 이 값과
// data/artists/index.ts의 실제 SUPPORTED_ARTISTS.length를 대조해, 아티스트가 새로
// 들어오거나 빠지는데 이 숫자만 안 바뀌면(사이트맵이 noindex 페이지를 계속 신거나,
// 반대로 있는 페이지를 계속 빼는 방향 모두) CI가 선다.
const SUPPORTED_ARTIST_COUNT = 0;

module.exports = { SUPPORTED_ARTIST_COUNT };
