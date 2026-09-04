#!/usr/bin/env node
/**
 * IndexNow "변경된 URL만" 제출 — 전량 반복 제출(scripts/indexnow-submit.mjs --from-sitemap)은
 * 스팸성이라 금지다. 이 스크립트는 두 커밋 사이 git diff로 실제로 바뀐 파일만 URL로 매핑해
 * 그만큼만 IndexNow(Bing·네이버)에 제출한다.
 *
 * 사용:
 *   node scripts/indexnow-changed.mjs [--base <sha>] [--head <sha>] [--dry-run]
 *   기본값: --base HEAD~1 --head HEAD
 *
 * 매핑 규칙 (mapChangedFilesToUrls):
 *   - content/stories/<slug>.md            → https://studionol.co.kr/ko/stories/<slug>
 *     (삭제된 파일 제외. <slug>.en.md 같은 비-ko 로케일 원본은 ko URL이 아니므로 제외)
 *   - pages/[locale]/<route>.tsx           → https://studionol.co.kr/ko/<route>
 *     (index.tsx → /ko. booking/·contracts/·portfolio/·stories/·guides/·release-project/
 *     하위의 동적 라우트는 제외 — 정적 최상위 라우트만)
 *     lib/enIndexablePaths.json에 등재된 라우트는 /en/<route>도 함께 제출
 *   - public/locales/ko/common.json        → 매핑하지 않음(전 페이지 공유 파일이라 매핑하면
 *     전량 제출로 번진다)
 *
 * 매핑 결과가 0건이면 조용히 종료(exit 0) — CI 실패 사유가 아니다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitUrls, SITE, MAX_PER_RUN } from './indexnow-submit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 다른 .mjs 스크립트와 동일하게 fs.readFileSync + JSON.parse로 읽는다(import assertion 미사용 관행).
const enIndexablePaths = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'lib/enIndexablePaths.json'), 'utf8')
);
const EN_INDEXABLE_PATHS = new Set(enIndexablePaths);

const STORY_FILE_RE = /^content\/stories\/([^/]+)\.md$/;
const STATIC_ROUTE_RE = /^pages\/\[locale\]\/([^/]+)\.tsx$/;
const LOCALE_SUFFIX_RE = /\.(en|zh|es|vi|th|uz)$/;
const SHARED_LOCALE_FILE = 'public/locales/ko/common.json';

/**
 * `git diff --name-status <base> <head>` 원문 한 줄을 { status, path } 로 파싱한다.
 * rename('R100\told\tnew')·copy('C100\told\tnew')은 새 경로를 path로 쓴다.
 */
export const parseNameStatus = (raw) =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });

/**
 * 변경 파일 목록({status, path}[]) → 제출할 절대 URL 목록(중복 제거, MAX_PER_RUN 상한).
 * 순수 함수 — git을 직접 호출하지 않아 단위 테스트 가능.
 */
export const mapChangedFilesToUrls = (entries) => {
  const urls = new Set();

  for (const { status, path: filePath } of entries) {
    if (status === 'D') continue; // 삭제된 파일 제외
    if (filePath === SHARED_LOCALE_FILE) continue; // 전 페이지 공유 — 매핑하지 않음

    const storyMatch = filePath.match(STORY_FILE_RE);
    if (storyMatch) {
      const slug = storyMatch[1];
      if (LOCALE_SUFFIX_RE.test(slug)) continue; // 비-ko 로케일 원본(<slug>.en.md 등) 제외
      urls.add(`${SITE}/ko/stories/${slug}`);
      continue;
    }

    const routeMatch = filePath.match(STATIC_ROUTE_RE);
    if (routeMatch) {
      const file = routeMatch[1];
      const routeSuffix = file === 'index' ? '' : `/${file}`;
      urls.add(`${SITE}/ko${routeSuffix}`);
      if (EN_INDEXABLE_PATHS.has(`/${file}`)) {
        urls.add(`${SITE}/en${routeSuffix}`);
      }
    }
  }

  return [...urls].slice(0, MAX_PER_RUN);
};

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = argOf('base', 'HEAD~1');
const HEAD = argOf('head', 'HEAD');
const DRY_RUN = argv.includes('--dry-run');

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function main() {
  let raw;
  try {
    raw = git(['diff', '--name-status', BASE, HEAD]);
  } catch (e) {
    // base가 존재하지 않는 커밋(예: 첫 push, shallow clone 등)일 수 있다 — CI를
    // 빨갛게 만들 사안이 아니므로 조용히 종료한다.
    console.error(`IndexNow: git diff 실패 (${BASE}..${HEAD}) — 건너뜀: ${e.message.split('\n')[0]}`);
    process.exit(0);
  }

  const entries = parseNameStatus(raw);
  const urls = mapChangedFilesToUrls(entries);

  if (urls.length === 0) {
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log(`IndexNow dry-run: ${urls.length}개 URL (제출 안 함)`);
    urls.forEach((u) => console.log(u));
    process.exit(0);
  }

  await submitUrls(urls);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
