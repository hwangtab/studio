#!/usr/bin/env node
/**
 * 빌드 결과물 검사 — 디스플레이 서체(제목 서체, lib/fonts/display.woff2)로 그려지는 글자가 전부 그 서체에 있는가.
 *
 * 왜 필요한가: 제목 서체는 LCP 경로(preload)에 있어 글자를 골라 담은 서브셋이다. 생성기
 * (scripts/generate-hero-font.mjs)는 "제목 문자열이 있을 법한 곳"(locales의 title 키·data·공연 정의…)을 읽어
 * 글자를 모으는데, 그 목록 밖에서 온 제목은 서브셋에 없는 글자를 Pretendard로 그린다 — 한 단어 안에서
 * 글자 모양이 갈린다. 2026-10-08 공연 상세 "출연"의 "출"이 그랬다(제목이 코드 lib/shows/i18n.ts에 있었다).
 * 출처를 하나씩 더하는 것만으로는 다음 구멍을 못 막으므로, **실제로 렌더된 HTML**을 본다.
 *
 * 하는 일: `next build`가 만든 .next/server/pages/**\/*.html에서 제목 서체를 쓰는 요소(class에 `font-hero` 또는
 * `typo-display-section`)의 글자를 모아, display.woff2의 **실제 글리프 표(cmap)** 와 대조한다. 사이드카
 * (display.chars.json)가 아니라 폰트 실물을 본다 — 사이드카에는 요청한 글자가 적히고, 서체에 없는 글자
 * (Paperlogy의 베트남어 성조 글자처럼)는 조용히 빠지기 때문이다.
 *
 * 설계상 제외: 태국 문자·한자·전각 구두점(로케일 폰트로 간다), 베트남어·우즈베크어 페이지(서체에 성조 글자·
 * ʻ ʼ가 없어 styles/globals.css가 제목을 Pretendard로 통째로 돌린다), 이모지.
 *
 * 한계: 빌드 때 HTML이 만들어지지 않는 페이지(getServerSideProps — 공연·펀딩 상세 등)는 여기서 못 본다. 그
 * 제목들은 생성기의 출처 목록과 `generate-hero-font.mjs --check`가 맡는다.
 *
 * 사용: npm run build && node scripts/check-display-font-coverage.mjs
 * 실패하면 빠진 글자와 그 글자가 나온 페이지를 보여 준다. 고치는 법은 생성기가 그 제목의 출처를 읽게 하는 것이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = path.join(ROOT, '.next', 'server', 'pages');
const WOFF2 = path.join(ROOT, 'lib', 'fonts', 'display.woff2');
const SIDECAR = path.join(ROOT, 'lib', 'fonts', 'display.chars.json');

const DISPLAY_CLASS = /\b(font-hero|typo-display-section)\b/;
const SKIP_LOCALES = new Set(['vi', 'uz']);
// 로케일 폰트로 가는 문자(설계상 디스플레이 서체 밖): 태국 문자, CJK, 전각·CJK 구두점, 이모지·기호 블록.
const BY_DESIGN = /[฀-๿⺀-鿿豈-﫿＀-￯　-〿\u{1F000}-\u{1FAFF}☀-➿️]/u;

async function fontCodepoints() {
  const hb = await (await import('harfbuzzjs')).default;
  const listed = JSON.parse(fs.readFileSync(SIDECAR, 'utf8')).chars;
  // harfbuzzjs는 woff2를 직접 못 읽는다 — 같은 글자 집합으로 truetype을 다시 뽑아 cmap을 읽는다
  // (서브셋은 원본에 없는 글자를 만들지 않으므로 결과 cmap = display.woff2의 실제 글리프 표).
  const ttf = await subsetFont(fs.readFileSync(WOFF2), listed.join(''), { targetFormat: 'truetype' });
  const face = hb.createFace(hb.createBlob(ttf), 0);
  return new Set(Array.from(face.collectUnicodes()));
}

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** class에 제목 서체 클래스가 붙은 요소의 텍스트들. 같은 태그가 안에 중첩돼도 짝을 세어 닫는다. */
function displayTexts(html) {
  const out = [];
  const open = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m;
  while ((m = open.exec(html))) {
    const [, tag, attrs] = m;
    const cls = /\bclass="([^"]*)"/.exec(attrs);
    if (!cls || !DISPLAY_CLASS.test(cls[1])) continue;
    let depth = 1;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = open.lastIndex;
    let t;
    let end = html.length;
    while ((t = re.exec(html))) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) {
        end = t.index;
        break;
      }
    }
    out.push(decode(html.slice(open.lastIndex, end).replace(/<[^>]+>/g, '')));
  }
  return out;
}

function* htmlFiles(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* htmlFiles(p);
    else if (ent.name.endsWith('.html')) yield p;
  }
}

async function main() {
  if (!fs.existsSync(PAGES_DIR)) {
    console.error('check-display-font-coverage: .next/server/pages가 없습니다. 먼저 npm run build를 실행하세요.');
    process.exit(1);
  }
  const cmap = await fontCodepoints();
  /** 글자 → 처음 나온 페이지들(최대 3) */
  const missing = new Map();
  let files = 0;
  let headings = 0;
  for (const file of htmlFiles(PAGES_DIR)) {
    const rel = path.relative(PAGES_DIR, file);
    const locale = rel.split(path.sep)[0].replace(/\.html$/, '');
    if (SKIP_LOCALES.has(locale)) continue;
    files++;
    for (const text of displayTexts(fs.readFileSync(file, 'utf8'))) {
      headings++;
      for (const ch of text) {
        if (/\s/.test(ch) || BY_DESIGN.test(ch) || cmap.has(ch.codePointAt(0))) continue;
        const where = missing.get(ch) ?? [];
        if (where.length < 3 && !where.some((w) => w.page === rel)) where.push({ page: rel, text: text.trim().slice(0, 60) });
        missing.set(ch, where);
      }
    }
  }
  if (missing.size === 0) {
    console.log(`display font coverage OK: ${headings} headings in ${files} pages, all glyphs in display.woff2`);
    return;
  }
  console.error(`check-display-font-coverage: 제목 서체에 없는 글자 ${missing.size}자 — 이 글자들은 Pretendard로 그려져 제목 안에서 서체가 섞인다.`);
  for (const [ch, where] of missing) {
    console.error(`  "${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
    for (const w of where) console.error(`      ${w.page} — ${w.text}`);
  }
  console.error('고치는 법: scripts/generate-hero-font.mjs가 그 제목의 출처를 읽게 하고 서브셋을 다시 만든다(서체에 아예 없는 문자면 globals.css에서 그 로케일 제목을 Pretendard로 돌린다).');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
