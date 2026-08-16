#!/usr/bin/env node
/* eslint-disable no-console */
// 정적 페이지 라우트의 sitemap <lastmod> 소스를 git 이력에서 뽑아 커밋 가능한 JSON으로 굳힌다.
//
// 왜 필요한가: getRouteLastmod는 페이지 소스 파일의 mtime을 써 왔는데, git은 mtime을
// 보존하지 않고 Vercel은 얕은 클론이라 배포할 때마다 모든 파일 mtime이 체크아웃 시각으로
// 균일화된다. 그러면 /pricing·/recording 같은 상업 페이지 ~20개가 "배포할 때마다 방금
// 수정됨"을 주장한다. Google은 lastmod을 사이트 단위로 신뢰할지 판정하므로, 이 20개의
// 거짓 신호가 정직해진 스토리 1,000+개의 신호까지 함께 깎아먹는다.
// (스토리는 scripts/backfill-story-lastmod.mjs가 frontmatter lastmod으로 이미 해결했다.
//  이 스크립트는 frontmatter를 둘 곳이 없는 .tsx 라우트를 위한 같은 처방이다.)
//
// 정확도에 대한 정직한 한계: 페이지 소스 파일의 커밋 시각만 본다. 카피만
// public/locales/*/common.json에서 고친 경우는 날짜가 안 오른다. 이는 의도된 트레이드오프다 —
// common.json은 전 페이지가 공유하는 단일 파일이라 그걸 반영하면 카피 한 줄 수정에
// 모든 페이지가 "수정됨"으로 찍혀 원래 문제로 되돌아간다. 과소보고는 안전한 방향이고
// (Google은 어차피 재크롤한다), 과대보고가 신호를 폐기시키는 방향이다.
// 페이지 카피를 크게 갈아엎었다면 JSON의 해당 날짜를 손으로 올려도 된다.
//
// 사용:
//   node scripts/generate-page-lastmod.mjs            # git에서 생성 (전체 이력 필요)
//   node scripts/generate-page-lastmod.mjs --check    # git 없이 커버리지만 검증 (CI용)
//
// 주의: Vercel·GitHub Actions는 얕은 클론이라 빌드 중 git 이력을 신뢰할 수 없다.
// 반드시 전체 이력이 있는 로컬에서 생성하고 결과 JSON을 함께 commit할 것.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'lib', 'sitemap', 'pageLastmod.json');
const CHECK = process.argv.includes('--check');

// 목록은 CJS 모듈에 두고 여기서도 커버리지 테스트에서도 같은 것을 본다
// (jest가 ESM 스크립트를 require할 수 없어 분리했다 — scripts/pageLastmodSources.js 주석 참고).
const { collectSourceFiles } = require(path.join(ROOT, 'scripts', 'pageLastmodSources.js'));

const gitLastCommitIso = (relPath) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', relPath], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? new Date(out).toISOString() : null;
  } catch {
    return null;
  }
};

const main = () => {
  const required = collectSourceFiles();

  if (CHECK) {
    if (!fs.existsSync(OUT)) {
      throw new Error(
        `generate-page-lastmod --check: ${path.relative(ROOT, OUT)} 없음. ` +
          `node scripts/generate-page-lastmod.mjs 를 로컬에서 실행하고 결과를 commit하세요.`
      );
    }
    const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const missing = required.filter((f) => !existing[f]);
    if (missing.length > 0) {
      throw new Error(
        `generate-page-lastmod --check: lastmod 항목이 없는 라우트 소스 ${missing.length}개: ` +
          `${missing.join(', ')}\n라우트를 추가하셨습니다. ` +
          `node scripts/generate-page-lastmod.mjs 를 로컬에서 실행하고 결과를 commit하세요.`
      );
    }
    // 저장소에서 사라진 파일이 JSON에 남아 있으면 조용히 죽은 항목이 쌓인다.
    const stale = Object.keys(existing).filter((f) => !fs.existsSync(path.join(ROOT, f)));
    if (stale.length > 0) {
      throw new Error(
        `generate-page-lastmod --check: 존재하지 않는 파일의 항목 ${stale.length}개: ${stale.join(', ')}`
      );
    }
    console.log(`page lastmod OK: ${required.length} routes covered`);
    return;
  }

  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const result = {};
  const unresolved = [];
  for (const relPath of required) {
    // git 이력이 없으면(신규 미커밋 파일) 기존 값을 지키고, 그것도 없으면 오늘로 시작한다.
    const iso = gitLastCommitIso(relPath) || previous[relPath] || new Date().toISOString();
    if (!gitLastCommitIso(relPath)) unresolved.push(relPath);
    result[relPath] = iso;
  }

  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`written: ${path.relative(ROOT, OUT)} (${required.length} routes)`);
  if (unresolved.length > 0) {
    console.warn(
      `  ⚠ git 이력이 없어 폴백한 항목 ${unresolved.length}개(아직 commit 안 된 신규 파일일 수 있음): ` +
        unresolved.join(', ')
    );
  }
};

main();
