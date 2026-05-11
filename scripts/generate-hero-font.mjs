#!/usr/bin/env node
/**
 * hero h1 LCP 폰트 subset 생성기.
 *
 * 사이트 hero 텍스트에 등장하는 글자만 추출해 Noto Sans KR Bold weight를 micro-subset
 * → public/fonts/noto-sans-kr-hero.woff2 (수 KB).
 *
 * 배경: next/font/google이 Noto Sans KR을 unicode-range로 13~30개 chunk 분할하지만
 * 'korean' subset이 직접 지원되지 않아 한글 chunk가 lazy fetch. PSI mobile LCP가
 * element render delay 1.8s로 측정되는 주범. hero에 한정해 micro-subset을 명시
 * preload하면 swap이 거의 즉시 발생 → LCP 단축.
 *
 * 산출물(lib/fonts/noto-sans-kr-hero.woff2)은 commit. hero 텍스트가 바뀌면 이
 * 스크립트만 재실행. prebuild에 자동 통합하지 않은 이유: GitHub raw URL에서 ttf
 * source를 받는 외부 네트워크 의존성이 매 CI 빌드를 깨뜨릴 위험.
 *
 * 사용: node scripts/generate-hero-font.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OTF_URL = 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf';
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache');
const CACHE_TTF = path.join(CACHE_DIR, 'NotoSansKR-Bold.otf');
// next/font/local이 빌드 시 _next/static/media/로 옮기므로 public/ 대신 lib/ 안에 둔다.
// public/에 두면 정적 서빙(/fonts/...)으로 동시에 중복 노출되어 캐시 정책이 분기됨.
const OUT_WOFF2 = path.join(ROOT, 'lib', 'fonts', 'noto-sans-kr-hero.woff2');

async function ensureSourceFont() {
  if (fs.existsSync(CACHE_TTF) && fs.statSync(CACHE_TTF).size > 1_000_000) {
    return fs.readFileSync(CACHE_TTF);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`fetching Noto Sans KR Bold OTF…`);
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
  // subtitle/description 등은 h1 아니므로 제외 — LCP 영향 없음.
  const heroTitleRe = /(^|\.)hero\.title[a-z]*$/i;
  const pageH1Re = /^(contact\.title)$/i;

  function walkObject(obj, parentKey = '') {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const v of obj) walkObject(v, parentKey);
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = parentKey ? `${parentKey}.${k}` : k;
      if (typeof v === 'string') {
        if (heroTitleRe.test(fullKey) || pageH1Re.test(fullKey)) {
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

async function main() {
  const chars = collectHeroChars();
  const subsetText = [...chars].join('');
  console.log(`hero char set: ${chars.size} glyphs`);

  const src = await ensureSourceFont();
  const out = await subsetFont(src, subsetText, { targetFormat: 'woff2' });

  fs.mkdirSync(path.dirname(OUT_WOFF2), { recursive: true });
  fs.writeFileSync(OUT_WOFF2, out);

  console.log(`written: ${path.relative(ROOT, OUT_WOFF2)}  (${(out.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('generate-hero-font failed:', err);
  process.exit(1);
});
