#!/usr/bin/env node
/**
 * hero h1 LCP 폰트 subset 생성기.
 *
 * 사이트 hero 텍스트에 등장하는 글자만 추출해 Pretendard Bold weight를 micro-subset
 * → lib/fonts/pretendard-hero.woff2 (수 KB).
 *
 * 배경: Pretendard Variable woff2(2MB)는 한+영 모든 weight를 단일 파일로 묶지만 그
 * 자체를 preload하면 critical path를 점유. hero h1만 별도 micro-subset으로 preload
 * 진입시키고, 본문 Variable은 font-display:swap으로 fallback paint 후 lazy 도착.
 *
 * 산출물(lib/fonts/pretendard-hero.woff2)은 commit. hero 텍스트가 바뀌면 이 스크립트
 * 재실행 후 결과 woff2도 함께 commit.
 *
 * prebuild에 통합돼 있다(package.json). jsdelivr/GitHub에서 source ttf를 받는 외부
 * 네트워크 의존성이 CI를 깨뜨리지 않도록, fetch 실패 시 이미 커밋된 woff2를 그대로
 * 쓰고 빌드를 계속한다(main()의 fallback 참고). 따라서 hero 텍스트 변경분은 반드시
 * 로컬에서 수동 재실행해 갱신된 woff2를 commit해야 빌드에 반영된다.
 *
 * 사용: node scripts/generate-hero-font.mjs
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OTF_URL = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf';
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache');
const CACHE_TTF = path.join(CACHE_DIR, 'Pretendard-Bold.otf');
// next/font/local이 빌드 시 _next/static/media/로 옮기므로 public/ 대신 lib/ 안에 둔다.
// public/에 두면 정적 서빙(/fonts/...)으로 동시에 중복 노출되어 캐시 정책이 분기됨.
const OUT_WOFF2 = path.join(ROOT, 'lib', 'fonts', 'pretendard-hero.woff2');
// woff2에 포함된 글자 집합 + woff2 sha256의 사이드카. hero 텍스트가 바뀌었는데
// woff2 재생성을 빠뜨리면 새 글자가 subset 밖이라 fallback으로 그려진다 —
// --check 모드(네트워크 불필요)가 (1) 현재 hero 텍스트 ⊆ 사이드카 글자 집합,
// (2) woff2 실물 sha == 사이드카 sha 를 대조하고 hero-font-subset.test.js가 CI에서
// 강제한다. sha 대조 덕에 둘 중 한 파일만 commit해도 잡힌다. 항상 함께 commit할 것.
const OUT_CHARS = path.join(ROOT, 'lib', 'fonts', 'pretendard-hero.chars.json');

async function ensureSourceFont() {
  if (fs.existsSync(CACHE_TTF) && fs.statSync(CACHE_TTF).size > 1_000_000) {
    return fs.readFileSync(CACHE_TTF);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`fetching Pretendard Bold OTF…`);
  const res = await fetch(OTF_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`failed to fetch source font: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000) throw new Error(`unexpected source size: ${buf.length}`);
  fs.writeFileSync(CACHE_TTF, buf);
  return buf;
}

// hero 텍스트가 가능한 모든 위치에서 글자 수집.
function collectHeroChars() {
  const chars = new Set();

  function addStr(s) {
    if (typeof s !== 'string') return;
    for (const ch of s) chars.add(ch);
  }

  // hero h1에 실제 들어가는 키 패턴만 잡는다.
  //   - *.hero.title 또는 *.hero.titlePrefix/Highlight/Suffix (대부분 페이지)
  //   - contact.title (contact 페이지가 t('contact.title') 사용)
  //   - portfolio.title (portfolio 페이지 h1이 t('portfolio.title') 사용)
  //   - stories.categories.* (카테고리 허브 페이지 h1이 카테고리명을 제목으로 렌더)
  // 위 페이지 h1들은 hero.* 네임스페이스 밖이라 heroTitleRe에 안 잡혀, 놓치면 해당
  // 제목이 본문 Pretendard(≈460KB subset)를 경유해 그려진다. subtitle/description 등은
  // h1 아니므로 제외 — LCP 영향 없음.
  const heroTitleRe = /(^|\.)hero\.title[a-z]*$/i;
  const pageH1Re = /^(contact\.title|portfolio\.title)$/i;
  const categoryHubRe = /^stories\.categories\.[a-z0-9_]+$/i;

  function walkObject(obj, parentKey = '') {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const v of obj) walkObject(v, parentKey);
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = parentKey ? `${parentKey}.${k}` : k;
      if (typeof v === 'string') {
        if (heroTitleRe.test(fullKey) || pageH1Re.test(fullKey) || categoryHubRe.test(fullKey)) {
          addStr(v);
        }
      } else {
        walkObject(v, fullKey);
      }
    }
  }

  // 1) i18n 자원
  const localesDir = path.join(ROOT, 'public', 'locales');
  for (const locale of fs.readdirSync(localesDir)) {
    const f = path.join(localesDir, locale, 'common.json');
    if (!fs.existsSync(f)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(f, 'utf8'));
      walkObject(json);
    } catch (e) {
      console.warn(`skip ${f}: ${e.message}`);
    }
  }

  // 2) data/home.ts heroContent — titlePrefix/Highlight/Suffix만 (subtitle은 h1 아님)
  const homeTs = fs.readFileSync(path.join(ROOT, 'data', 'home.ts'), 'utf8');
  for (const m of homeTs.matchAll(/(titlePrefix|titleHighlight|titleSuffix)\s*:\s*(["'`])([\s\S]*?)\2/g)) {
    addStr(m[3]);
  }

  // 3) data/buyerIntentHubs.ts — hero 블록 안의 title/titleHighlight만
  const hubsTs = fs.readFileSync(path.join(ROOT, 'data', 'buyerIntentHubs.ts'), 'utf8');
  for (const m of hubsTs.matchAll(/hero\s*:\s*{([\s\S]*?)}/g)) {
    for (const mm of m[1].matchAll(/(title|titleHighlight)\s*:\s*(["'`])([\s\S]*?)\2/g)) {
      addStr(mm[3]);
    }
  }

  // 4) siteConfig.name — about 페이지가 ImageHero title={siteConfig.name} 호출
  try {
    const siteCfg = fs.readFileSync(path.join(ROOT, 'data', 'siteConfig.ts'), 'utf8');
    for (const m of siteCfg.matchAll(/name\s*:\s*(["'`])([\s\S]*?)\1/g)) addStr(m[2]);
  } catch {}

  // 5) 안전판: 영문/숫자/기본 punctuation (h1에 흔히 섞이는 기호)
  const safety = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?·:;()[]\'"&-—–%/';
  addStr(safety);

  return chars;
}

function woff2Sha256() {
  return crypto.createHash('sha256').update(fs.readFileSync(OUT_WOFF2)).digest('hex');
}

function runCheck(chars) {
  const regenerateHint =
    `node scripts/generate-hero-font.mjs 를 로컬에서 실행하고 ` +
    `갱신된 woff2 + chars.json을 함께 commit하세요.`;

  if (!fs.existsSync(OUT_CHARS) || !fs.existsSync(OUT_WOFF2)) {
    console.error(
      `generate-hero-font --check: ${path.relative(ROOT, OUT_CHARS)} 또는 woff2 없음. ${regenerateHint}`,
    );
    process.exit(1);
  }

  const sidecar = JSON.parse(fs.readFileSync(OUT_CHARS, 'utf8'));
  if (sidecar.sha256 !== woff2Sha256()) {
    console.error(
      `generate-hero-font --check: woff2 실물과 chars.json 사이드카의 sha256 불일치 — ` +
        `둘 중 한쪽만 commit되었습니다. ${regenerateHint}`,
    );
    process.exit(1);
  }

  const committed = new Set(sidecar.chars);
  const missing = [...chars].filter((ch) => !committed.has(ch));
  if (missing.length > 0) {
    console.error(
      `generate-hero-font --check: hero 텍스트에 subset 밖 글자 ${missing.length}자 발견: ` +
        `${JSON.stringify(missing.join(''))}\nhero 문구가 바뀌었습니다. ${regenerateHint}`,
    );
    process.exit(1);
  }
  console.log(`hero subset OK: ${chars.size} chars covered, woff2 sha match`);
}

async function main() {
  const chars = collectHeroChars();
  const subsetText = [...chars].join('');
  console.log(`hero char set: ${chars.size} glyphs`);

  if (process.argv.includes('--check')) {
    runCheck(chars);
    return;
  }

  let src;
  try {
    src = await ensureSourceFont();
  } catch (err) {
    // prebuild 체인에서 실행되므로 jsdelivr 장애·rate limit·타임아웃이 빌드 전체를
    // 깨뜨리면 안 된다. 산출물(woff2)은 commit돼 있으므로, source font를 못 받으면
    // 이미 커밋된 woff2를 그대로 사용하고 빌드를 계속한다. (hero 텍스트가 바뀐 경우엔
    // 로컬에서 이 스크립트를 수동 재실행해 갱신된 woff2를 commit해야 한다.)
    if (fs.existsSync(OUT_WOFF2)) {
      console.warn(`generate-hero-font: source font unavailable (${err.message}); ` +
        `keeping committed ${path.relative(ROOT, OUT_WOFF2)} and continuing build.`);
      return;
    }
    throw err;
  }

  const out = await subsetFont(src, subsetText, { targetFormat: 'woff2' });

  fs.mkdirSync(path.dirname(OUT_WOFF2), { recursive: true });
  fs.writeFileSync(OUT_WOFF2, out);
  fs.writeFileSync(
    OUT_CHARS,
    `${JSON.stringify({ sha256: woff2Sha256(), chars: [...chars].sort() })}\n`,
  );

  console.log(`written: ${path.relative(ROOT, OUT_WOFF2)}  (${(out.length / 1024).toFixed(1)} KB)`);
  console.log(`written: ${path.relative(ROOT, OUT_CHARS)}  (${chars.size} chars + woff2 sha)`);
}

main().catch((err) => {
  console.error('generate-hero-font failed:', err);
  process.exit(1);
});
