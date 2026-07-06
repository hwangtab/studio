#!/usr/bin/env node
/**
 * 본문 Pretendard Variable 폰트 subset 생성기 (사이트 최대 PSI 병목 해소).
 *
 * 배경: lib/fonts/pretendard-variable.woff2 원본은 한글 완성형 11,172자 전부 +
 * 라틴확장을 담아 2,057,688 bytes(≈2MB). body 폰트라 브라우저가 VeryHigh 우선순위로
 * fetch → slow 4G에서 이 2MB가 대역폭을 ~10초 독점해 portfolio/story PSI 54/55(FCP
 * Lantern 11–14s)의 주범. 반면 실사용 유니크 한글은 1,390자뿐 → 폰트 무게의 88%가
 * 죽은 글자.
 *
 * 이 스크립트는 원본(lib/fonts/pretendard-variable-full.woff2)에서 "실제로 필요한
 * 글자"만 남긴 subset(lib/fonts/pretendard-variable.woff2, ≈460KB)을 만든다. 글자별
 * lazy chunk(unicode-range)가 아니라 단일 작은 파일 하나 — 원본의 "2MB→단일파일"
 * 결정(element render delay 회피)은 유지하고 크기만 77% 감축한다.
 *
 * ── 글자 집합 ─────────────────────────────────────────────────────────────
 *   ① KS X 1001 완성형 2,350 한글  ── "세이프 마진". 현재 콘텐츠에 없어도 자주 쓰는
 *      현대 한글은 항상 커버해, 신규 스토리가 새 음절을 써도 fallback 없이 렌더.
 *   ② 실사용 글자  ── content/stories/*.md + data/**\/*.ts + public/locales/**\/*.json
 *      전수 스캔. 스토리 한글·베트남어 프리컴포즈(vi)·UI 라틴 등 모두 포함.
 *   ③ 라틴/숫자/기호 세이프셋  ── 향후 UI 텍스트 대비.
 *   ①∪②∪③ 를 subset-font에 넘기면 harfbuzz가 원본 cmap과 교집합만 남긴다. 즉
 *   Pretendard에 없는 글자(zh 한자·th 태국문자 등)는 자동 제외 → 스캔 범위를 넓게
 *   잡아도 안전. (zh/th는 styles/globals.css가 PingFang SC/Leelawadee로 라우팅하므로
 *   애초에 Pretendard를 쓰지 않는다.)
 *
 * ── 가변 axis / 레이아웃 보존 ─────────────────────────────────────────────
 *   subset-font(harfbuzz)는 variationAxes 옵션을 주지 않는 한 fvar(wght 45–930) 전체와
 *   gvar(가변 글리프 델타)·GSUB/GPOS/GDEF/STAT 를 그대로 보존한다. 따라서 굵기 보간과
 *   커닝·마크 포지셔닝이 subset 후에도 유지된다(빌드 로그의 검증 라인 참고).
 *
 * ── 자동화 / 회귀 방지 ────────────────────────────────────────────────────
 *   package.json prebuild 훅에서 매 빌드 결정적으로 재생성한다(옵션 b). subset은
 *   로컬 원본에서 생성되므로 hero 폰트(jsdelivr 네트워크 의존)와 달리 CI에서 100%
 *   재현 가능하고, "사람이 재생성 기억"에 의존하지 않는다 — 스토리(1,756개·증가)가
 *   새 글자를 도입해도 다음 빌드가 자동 반영. subset-font 출력은 동일 입력에 대해
 *   byte-identical(검증됨)이라, 콘텐츠 변화가 없으면 산출물도 불변 → git churn 없음.
 *   commit된 subset은 prebuild를 돌리지 않는 `next dev`와, 원본 유실 시 폴백으로 쓰인다.
 *
 * 사용: node scripts/generate-body-font.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { applyFactTokens } from '../lib/factTokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 원본(subset 소스, commit) / 산출물(lib/fonts.ts가 로드, commit).
// next/font/local이 산출물을 빌드 시 _next/static/media/로 옮긴다.
const SOURCE_WOFF2 = path.join(ROOT, 'lib', 'fonts', 'pretendard-variable-full.woff2');
const OUT_WOFF2 = path.join(ROOT, 'lib', 'fonts', 'pretendard-variable.woff2');

// ── ① KS X 1001 완성형 2,350 한글 ───────────────────────────────────────────
// EUC-KR(KS X 1001) 한글 영역은 lead 0xB0–0xC8 × trail 0xA1–0xFE = 25×94 = 2,350자.
// Node full-ICU의 TextDecoder('euc-kr')로 디코딩(공식 Node·Vercel 빌드 모두 full-ICU).
function ksx1001Hangul() {
  const bytes = [];
  for (let hi = 0xb0; hi <= 0xc8; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) bytes.push(hi, lo);
  }
  const decoded = new TextDecoder('euc-kr', { fatal: true }).decode(Buffer.from(bytes));
  const set = new Set(decoded);
  // 방어: 정확히 2,350 완성형 한글(U+AC00–U+D7A3)이어야 함.
  const ok = set.size === 2350 && [...set].every((c) => {
    const cp = c.codePointAt(0);
    return cp >= 0xac00 && cp <= 0xd7a3;
  });
  if (!ok) {
    throw new Error(
      `KS X 1001 한글 세트 생성 실패(size=${set.size}). ` +
        `이 Node가 full-ICU('euc-kr')를 지원하지 않을 수 있음.`
    );
  }
  return set;
}

// ── ③ 라틴/숫자/기호 세이프셋 ────────────────────────────────────────────────
// 스캔이 실사용 글자를 모두 잡지만, 향후 UI 텍스트 대비 기본 라틴·문장부호를 상시 포함.
// (Pretendard에 없는 기호는 harfbuzz가 자동 제외하므로 넉넉히 넣어도 무해.)
function latinSafetySet() {
  const chars = new Set();
  for (let cp = 0x20; cp <= 0x7e; cp++) chars.add(String.fromCodePoint(cp)); // ASCII 인쇄가능
  const punct =
    ' ©®–—‘’“”…•·‹›' +
    '«»→←↑↓★☆●○▶◆✔–' +
    '₩$€¥£℃°№™×÷±½¼¾';
  for (const ch of punct) chars.add(ch);
  return chars;
}

// ── ② 실사용 글자 스캔 ───────────────────────────────────────────────────────
function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

function collectUsedChars() {
  const used = new Set();
  const add = (s) => { for (const ch of s) used.add(ch); };

  const sources = [
    ...walk(path.join(ROOT, 'content', 'stories'), (p) => p.endsWith('.md')),
    ...walk(path.join(ROOT, 'data'), (p) => p.endsWith('.ts')),
    ...walk(path.join(ROOT, 'public', 'locales'), (p) => p.endsWith('.json')),
  ];
  for (const f of sources) {
    // 렌더 시점에는 %%phone%% 류가 치환된 텍스트가 보이므로, 글리프 수집도
    // 치환 후 텍스트 기준이어야 한다 (lib/factTokens.js 배선 규약).
    try { add(applyFactTokens(fs.readFileSync(f, 'utf8'))); }
    catch (e) { console.warn(`  skip ${path.relative(ROOT, f)}: ${e.message}`); }
  }
  return { used, fileCount: sources.length };
}

async function main() {
  const ks = ksx1001Hangul();
  const { used, fileCount } = collectUsedChars();
  const latin = latinSafetySet();

  const union = new Set([...ks, ...used, ...latin]);
  const subsetText = [...union].join('');

  // 관측용 통계.
  const usedHangul = [...used].filter((c) => {
    const cp = c.codePointAt(0);
    return cp >= 0xac00 && cp <= 0xd7a3;
  });
  const usedHangulOutsideKs = usedHangul.filter((c) => !ks.has(c));
  console.log(`generate-body-font: scanned ${fileCount} files`);
  console.log(`  used unique codepoints: ${used.size} (Hangul syllables ${usedHangul.length})`);
  console.log(`  used Hangul outside KS X 1001: ${usedHangulOutsideKs.length}` +
    (usedHangulOutsideKs.length ? ` → ${usedHangulOutsideKs.join('')}` : ''));
  console.log(`  glyph request set: ${union.size} (KS2350 ∪ used ∪ latin-safety)`);

  // 원본(subset 소스) 확보. 없으면 이미 commit된 subset을 유지하고 계속(회귀 방지).
  if (!fs.existsSync(SOURCE_WOFF2)) {
    if (fs.existsSync(OUT_WOFF2)) {
      console.warn(
        `generate-body-font: source ${path.relative(ROOT, SOURCE_WOFF2)} 없음 — ` +
          `commit된 ${path.relative(ROOT, OUT_WOFF2)} 유지하고 계속.`
      );
      return;
    }
    throw new Error(
      `source font ${path.relative(ROOT, SOURCE_WOFF2)} 및 산출물 모두 없음. ` +
        `원본 Pretendard Variable woff2를 ${path.relative(ROOT, SOURCE_WOFF2)}에 두세요.`
    );
  }

  const src = fs.readFileSync(SOURCE_WOFF2);
  // variationAxes 미지정 → fvar(wght 45–930)·gvar·GSUB/GPOS 그대로 보존.
  const out = await subsetFont(src, subsetText, { targetFormat: 'woff2' });

  // 결정적 산출물: 기존과 동일하면 재기록 생략(git churn·mtime 변화 방지).
  const newHash = crypto.createHash('sha256').update(out).digest('hex');
  const oldHash = fs.existsSync(OUT_WOFF2)
    ? crypto.createHash('sha256').update(fs.readFileSync(OUT_WOFF2)).digest('hex')
    : null;

  const srcKB = (src.length / 1024).toFixed(1);
  const outKB = (out.length / 1024).toFixed(1);
  if (newHash === oldHash) {
    console.log(`  up to date: ${path.relative(ROOT, OUT_WOFF2)} (${outKB} KB, unchanged)`);
    return;
  }
  fs.mkdirSync(path.dirname(OUT_WOFF2), { recursive: true });
  fs.writeFileSync(OUT_WOFF2, out);
  console.log(`  written: ${path.relative(ROOT, OUT_WOFF2)}  (${outKB} KB  ⟵  ${srcKB} KB source)`);
}

main().catch((err) => {
  console.error('generate-body-font failed:', err);
  process.exit(1);
});
