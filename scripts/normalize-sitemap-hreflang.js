#!/usr/bin/env node
// next-sitemap 4.2.3 bug: 3-subtag BCP 47 tags like `uz-Latn-UZ` get written
// with underscores (`uz_Latn_UZ`). Google rejects these. Post-process the
// generated sitemap files to restore hyphens.
//
// 이 스크립트는 postbuild 파이프라인의 **마지막 단계이자 유일한 관문**이기도 하다.
// postbuild는 `rm -f public/sitemap*.xml public/robots.txt && next-sitemap && node <이 파일>`인데,
// next-sitemap은 내부 실패를 `.catch(Logger.error)`로 삼키고 exit 0으로 끝난다. 예전엔 이
// 스크립트도 파일이 없으면 조용히 no-op이라, **사이트맵과 robots.txt가 지워진 채 초록 빌드로
// 배포**될 수 있었다(rm은 이미 실행됐으므로 이전 산출물도 남지 않는다). 결과는 색인 신호의
// 전면 소실 — 조용히 넘어가면 안 되는 종류의 실패다. 그래서 여기서 시끄럽게 죽는다.
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(process.cwd(), 'public');
const pattern = /\buz_Latn_UZ\b/g;
const replacement = 'uz-Latn-UZ';

const entries = fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : [];
const sitemaps = entries.filter((file) => /^sitemap.*\.xml$/.test(file));

if (sitemaps.length === 0) {
  console.error(
    [
      '[sitemap] 치명적: public/ 에 sitemap*.xml이 하나도 없다 — 사이트맵 생성이 실패했다.',
      '',
      '  postbuild는 `rm -f public/sitemap*.xml public/robots.txt` 로 시작하므로, next-sitemap이',
      '  실패하면 이전 산출물마저 사라진 상태다. next-sitemap은 내부 오류를 삼키고 exit 0으로',
      '  끝나기 때문에(.catch(Logger.error)) 이 검사가 없으면 사이트맵·robots.txt가 없는 채로',
      '  "초록 빌드"가 배포된다 — 색인 신호가 통째로 사라진다.',
      '',
      '  확인할 것:',
      '   1. 위 빌드 로그에서 next-sitemap이 남긴 에러(ENOENT·설정 오류·getServerSideProps 예외)',
      '   2. next-sitemap.config.js 의 siteUrl / additionalPaths 가 던지지 않는지',
      '   3. .next/ 빌드 산출물이 실제로 있는지 (next build 가 먼저 성공해야 한다)',
      '',
      '  수동 재현: npx next-sitemap && node scripts/normalize-sitemap-hreflang.js',
    ].join('\n'),
  );
  process.exit(1);
}

// robots.txt도 같은 rm으로 지워졌다가 next-sitemap이 다시 쓴다. 사이트맵만 보고 통과시키면
// robots.txt만 사라진 배포를 놓친다.
if (!fs.existsSync(path.join(publicDir, 'robots.txt'))) {
  console.error(
    [
      '[sitemap] 치명적: public/robots.txt가 없다 — postbuild의 rm 이후 next-sitemap이 다시 쓰지 못했다.',
      '  robots.txt가 없으면 크롤러에 사이트맵 위치를 알릴 수 없다. 위 next-sitemap 로그를 확인할 것.',
    ].join('\n'),
  );
  process.exit(1);
}

let rewritten = 0;
for (const file of sitemaps) {
  const target = path.join(publicDir, file);
  const original = fs.readFileSync(target, 'utf8');
  pattern.lastIndex = 0;
  if (!pattern.test(original)) continue;
  pattern.lastIndex = 0;
  fs.writeFileSync(target, original.replace(pattern, replacement));
  rewritten += 1;
}

console.log(`[sitemap] ${sitemaps.length} file(s) verified, hreflang normalized in ${rewritten}`);
