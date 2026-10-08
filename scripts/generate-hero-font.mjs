#!/usr/bin/env node
/**
 * 디스플레이 서체 subset 생성기 — hero h1 + v2 섹션 제목(.typo-display-section)이 쓰는 글자만 담는다.
 *
 * 2026-10-06 라이너 노트(docs/design-liner-notes-plan-2026-10.md §3-2)부터 이 파일은 Pretendard Bold가 아니라
 * **디스플레이 세리프**(기본 Hahmlet, OFL)를 서브셋한다. 산출물은 하나다 — lib/fonts/display.woff2 + 사이드카
 * display.chars.json. preload=true라 LCP 경로에 들어가므로 글자 집합을 필요 이상으로 키우지 않는다
 * (실측 2026-10-06: ko 제목 글자 568자 → 정적 700 약 65KB).
 *
 * 서체 고르기: DISPLAY_FONT=hahmlet(기본) | maruburi | pretendard | suit | paperlogy. 운영자가 실제 화면으로 고르는 동안
 * 비교 브랜치가 쓰는 스위치다. 산출물 파일명은 서체와 무관하게 같아서 lib/fonts.ts는 바뀌지 않는다.
 * 사이드카에 source를 적어 두므로 어느 서체로 만든 파일인지 --check 출력에서 보인다.
 *
 * 글자 수집 범위: ① locales *.hero.title* 등 h1 키(예전과 같음) ② locales의 *title*·*heading* 키 전부
 * (SectionHeading v2 제목의 대부분) ③ data/home.ts heroContent ④ buyerIntentHubs hero ⑤ siteConfig name
 * ⑥ content/funding 제목 ⑦ data/*.ts 최상위 파일의 title*·heading* 문자열 ⑧ data/shows 제목 ⑨ 코드에 박힌 제목
 * (components·pages의 JSX title="…" 전부, lib/shows/i18n.ts) ⑩ 스토리 글 제목(content/stories frontmatter)
 * ⑪ 영문·숫자·기호 안전판. 서브셋 밖 글자는 Pretendard(본문 폰트)로 떨어진다 — --check가 ①~⑪ ⊆ 사이드카를,
 * scripts/check-display-font-coverage.mjs가 빌드된 HTML의 실제 제목 글자 ⊆ 서체 글리프를 CI에서 강제한다
 * (hero-font-subset.test.js). th·zh 문자는 서체에 없고 지금도 --font-locale로 가므로 집합에서 뺀다.
 *
 * prebuild에 묶여 있다(package.json). 소스 폰트는 네트워크에서 받아 node_modules/.cache에 두고, 못 받으면
 * 커밋된 woff2를 그대로 쓰고 빌드를 계속한다 — 제목 문구를 바꿨다면 로컬에서 수동 재실행해 산출물을 commit.
 *
 * 사용: node scripts/generate-hero-font.mjs            # 생성
 *      node scripts/generate-hero-font.mjs --check    # 네트워크 없이 커버리지·sha 검증
 *      DISPLAY_FONT=maruburi node scripts/generate-hero-font.mjs
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SOURCES = {
  hahmlet: {
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/hahmlet/Hahmlet%5Bwght%5D.ttf',
    cache: 'Hahmlet[wght].ttf',
    // 가변 폰트를 700 하나로 고정(instance)한다 — 가변 600~800은 119KB, 정적 700은 65KB.
    subsetOptions: { targetFormat: 'woff2', variationAxes: { wght: 700 } },
    weight: '700',
    minBytes: 2_000_000,
  },
  maruburi: {
    url: 'https://hangeul.pstatic.net/hangeul_static/webfont/MaruBuri/MaruBuri-Bold.ttf',
    cache: 'MaruBuri-Bold.ttf',
    subsetOptions: { targetFormat: 'woff2' },
    weight: '700',
    minBytes: 2_000_000,
  },
  pretendard: {
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf',
    cache: 'Pretendard-Bold.otf',
    subsetOptions: { targetFormat: 'woff2' },
    weight: '700',
    minBytes: 1_000_000,
  },
  // SUIT — sun-typeface, OFL 1.1 (라이선스 확인: raw.githubusercontent.com/sun-typeface/SUIT/main/LICENSE).
  // jsdelivr npm 패키지의 static TTF Bold(가변 아님, 700 그 자체). 2026-10-07 운영자가 Hahmlet 대안으로
  // Paperlogy와 함께 비교 지정.
  suit: {
    url: 'https://cdn.jsdelivr.net/npm/@sun-typeface/suit@2.0.5/fonts/static/ttf/SUIT-Bold.ttf',
    cache: 'SUIT-Bold.ttf',
    subsetOptions: { targetFormat: 'woff2' },
    weight: '700',
    minBytes: 400_000,
  },
  // Paperlogy — Freesentation, OFL 1.1 (라이선스 확인: raw.githubusercontent.com/Freesentation/paperlogy/main/OFL%20license.txt).
  // 저장소에 ttf/otf 원본은 zip 안에만 있고 루트에는 완성된 웹용 woff2만 있다 — subset-font는 harfbuzzjs라
  // woff2 입력도 그대로 받는다(README 확인), 재압축 경로라 품질 손실 없음.
  paperlogy: {
    url: 'https://raw.githubusercontent.com/Freesentation/paperlogy/main/woff2/Paperlogy-7Bold.woff2',
    cache: 'Paperlogy-7Bold.woff2',
    subsetOptions: { targetFormat: 'woff2' },
    weight: '700',
    minBytes: 300_000,
  },
};
// 2026-10-07 비교 브랜치(feat/liner-font-paperlogy): 기본값을 paperlogy로 — Vercel prebuild가
// DISPLAY_FONT 환경변수 없이 돌기 때문에, 기본값을 바꿔 두지 않으면 매 빌드마다 Hahmlet을
// 다시 받아 커밋된 산출물을 덮어쓴다.
const SOURCE_NAME = process.env.DISPLAY_FONT || 'paperlogy';
const SOURCE = SOURCES[SOURCE_NAME];
if (!SOURCE) {
  console.error(`generate-hero-font: unknown DISPLAY_FONT "${SOURCE_NAME}" (${Object.keys(SOURCES).join(' | ')})`);
  process.exit(1);
}

const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache');
// next/font/local이 빌드 시 _next/static/media/로 옮기므로 public/ 대신 lib/ 안에 둔다.
// public/에 두면 정적 서빙(/fonts/...)으로 동시에 중복 노출되어 캐시 정책이 분기됨.
const OUT_WOFF2 = path.join(ROOT, 'lib', 'fonts', 'display.woff2');
// woff2에 포함된 글자 집합 + woff2 sha256 + source의 사이드카. 제목 문구가 바뀌었는데 woff2 재생성을
// 빠뜨리면 새 글자가 subset 밖이라 fallback으로 그려진다 — --check 모드(네트워크 불필요)가
// (1) 현재 글자 집합 ⊆ 사이드카 글자 집합, (2) woff2 실물 sha == 사이드카 sha 를 대조하고
// hero-font-subset.test.js가 CI에서 강제한다. sha 대조 덕에 둘 중 한 파일만 commit해도 잡힌다.
const OUT_CHARS = path.join(ROOT, 'lib', 'fonts', 'display.chars.json');

async function ensureSourceFont() {
  const cached = path.join(CACHE_DIR, SOURCE.cache);
  if (fs.existsSync(cached) && fs.statSync(cached).size > SOURCE.minBytes) {
    return fs.readFileSync(cached);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`fetching ${SOURCE_NAME} source font…`);
  const res = await fetch(SOURCE.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`failed to fetch source font: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < SOURCE.minBytes) throw new Error(`unexpected source size: ${buf.length}`);
  fs.writeFileSync(cached, buf);
  return buf;
}

// th·zh 문자는 디스플레이 서체에 없고 지금도 --font-locale(PingFang·Leelawadee)로 간다.
const isLocaleOnlyChar = (ch) => {
  const cp = ch.codePointAt(0);
  return (
    (cp >= 0x0e00 && cp <= 0x0e7f) || // Thai
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x3000 && cp <= 0x303f) // CJK punctuation (，。 등)
  );
};

// 디스플레이 서체가 들어가는 모든 자리에서 글자 수집.
function collectDisplayChars() {
  const chars = new Set();

  function addStr(s) {
    if (typeof s !== 'string') return;
    for (const ch of s) if (!isLocaleOnlyChar(ch)) chars.add(ch);
  }

  // hero h1 키(예전 범위 그대로) + v2 섹션 제목이 쓰는 *title*·*heading* 키 전부.
  //   - *.hero.title 또는 *.hero.titlePrefix/Highlight/Suffix (대부분 페이지)
  //   - contact.title / portfolio.title (해당 페이지 h1)
  //   - stories.categories.* (카테고리 허브 h1)
  //   - 키 이름에 title·heading이 든 모든 문자열 — SectionHeading v2 제목의 대부분이 여기서 온다.
  //     subtitle·description은 본문 폰트라 제외… 하되 'subtitle'은 title을 포함하므로 명시적으로 뺀다.
  const heroTitleRe = /(^|\.)hero\.title[a-z]*$/i;
  const pageH1Re = /^(contact\.title|portfolio\.title)$/i;
  const categoryHubRe = /^stories\.categories\.[a-z0-9_]+$/i;
  const titleKeyRe = /(title|heading)/i;
  const notTitleKeyRe = /(subtitle|description|lead|body|meta|og|seo|alt)/i;

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
        } else if (titleKeyRe.test(k) && !notTitleKeyRe.test(k)) {
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

  // 2) data/home.ts heroContent — titlePrefix/Highlight/Suffix (subtitle은 h1 아님)
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

  // 4) siteConfig — about 페이지가 ImageHero title={siteConfig.name},
  //    /author 페이지가 ImageHero title={studioOperator.name}을 h1으로 렌더한다.
  //
  //    studioOperator 블록은 통째로 긁으면 안 된다: awards[].name 같은 하위 name이
  //    h1에 절대 안 나오는 글자를 LCP 크리티컬 서브셋에 밀어넣는다(실제로 '레드어워드'·
  //    '한국대중음악상'이 유입돼 --check가 잡았다). 블록을 잘라낸 뒤 최상위 name만 따로 넣는다.
  try {
    const siteCfg = fs.readFileSync(path.join(ROOT, 'data', 'siteConfig.ts'), 'utf8');
    const operatorName = siteCfg.match(/export const studioOperator\s*=\s*{\s*\n\s*name\s*:\s*(["'`])([\s\S]*?)\1/);
    if (operatorName) addStr(operatorName[2]);
    const withoutOperator = siteCfg.replace(/export const studioOperator[\s\S]*?\n};/, '');
    for (const m of withoutOperator.matchAll(/name\s*:\s*(["'`])([\s\S]*?)\1/g)) addStr(m[2]);
  } catch {}

  // 5) 펀딩 프로젝트 제목 — `content/funding/<slug>.md`의 frontmatter title이
  //    `/ko/funding/<slug>`의 ImageHero h1으로 그대로 나간다.
  //
  //    이 소스가 없던 동안은 프로젝트를 추가할 때마다 그 제목의 낯선 글자가 서브셋에서
  //    빠졌고, --check는 "커밋된 woff2가 현재 글자집합을 덮는가"만 보므로 아무도 못 잡았다.
  //    실제로 'Keep Singing for Palestine — 9·19 거리집회 후원'에서 `거`·`회` 두 글자가
  //    빠져, 한 단어 안에서 두 글자만 폴백 서체로 그려질 뻔했다.
  try {
    const fundingDir = path.join(ROOT, 'content', 'funding');
    for (const f of fs.readdirSync(fundingDir).filter((n) => n.endsWith('.md'))) {
      const raw = fs.readFileSync(path.join(fundingDir, f), 'utf8');
      // frontmatter의 최상위 title 한 줄만 본다 — 리워드 title은 h1이 아니다(들여쓰기로 구분).
      const m = raw.match(/^title:\s*(.+)$/m);
      if (m) addStr(m[1].trim().replace(/^["']|["']$/g, ''));
    }
  } catch (e) {
    console.warn(`skip funding titles: ${e.message}`);
  }

  // 6) data/*.ts 최상위 파일의 title: 문자열 — ko 전용 LP(crowdfundingDesign.ts 등)의 hero.title과
  //    섹션 제목이 common.json 밖에 있는 경우. 하위 디렉터리(portfolio/items.ts 등)는 카드 제목이라 제외.
  try {
    const dataDir = path.join(ROOT, 'data');
    for (const f of fs.readdirSync(dataDir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
      const src = fs.readFileSync(path.join(dataDir, f), 'utf8');
      // title·heading으로 시작하는 키 전부(titleLine1·titleHighlight·sectionTitle…) — 2026-10-08 titleLine1이 빠져
      // crowdfunding-design 제목의 "멈춘"이 Pretendard로 그려졌다. 단 subtitle은 본문 서체라 제외.
      for (const m of src.matchAll(/\b((?:title|heading|sectionTitle)\w*)\s*:\s*(["'`])([^"'`]*?)\2/g)) addStr(m[3]);
    }
  } catch (e) {
    console.warn(`skip data titles: ${e.message}`);
  }

  // 7) 공연 제목 — `data/shows/<slug>.ts`의 최상위 title이 `/ko/shows/<slug>`의 ImageHero h1으로
  //    나간다(2026-10-03 공연 상세를 ImageHero로 바꾸면서). 공연 정의가 정본이고 DB는 그 사본이라
  //    여기서 읽으면 된다. 2칸 들여쓰기의 title만 — 티켓타입·출연자는 name이라 섞이지 않는다.
  try {
    const showsDir = path.join(ROOT, 'data', 'shows');
    for (const f of fs.readdirSync(showsDir).filter((n) => n.endsWith('.ts') && n !== 'index.ts')) {
      const src = fs.readFileSync(path.join(showsDir, f), 'utf8');
      for (const m of src.matchAll(/^ {2}title:\s*(["'`])([\s\S]*?)\1/gm)) addStr(m[2]);
    }
  } catch (e) {
    console.warn(`skip show titles: ${e.message}`);
  }

  // 8) 코드에 박힌 제목 — locales·data를 거치지 않는 제목이 있다. 2026-10-08 공연 상세의 "출연"이 "출"만
  //    Pretendard로 그려졌다(공연 섹션 제목은 lib/shows/i18n.ts에, 허브 페이지 일부 제목은 컴포넌트 안에 있다).
  //    ⓐ components·pages의 **모든** JSX `title="…"` 리터럴 — 제목을 받아 제목 서체로 그리는 포장 컴포넌트
  //       (ContactCTA 등)가 여럿이라 컴포넌트 이름으로 거르지 않는다(조금 더 담는 쪽이 안전하다).
  //    ⓑ lib/shows/i18n.ts의 제목 키(title·heroTitle·upcoming·past·faqTitle) 문자열
  try {
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.tsx$/.test(ent.name) && !/\.test\./.test(ent.name)) {
          const src = fs.readFileSync(p, 'utf8');
          for (const m of src.matchAll(/\btitle=(?:"([^"]+)"|\{'([^']+)'\})/g)) addStr(m[1] ?? m[2]);
        }
      }
    };
    walk(path.join(ROOT, 'components'));
    walk(path.join(ROOT, 'pages'));
    const showsCopy = fs.readFileSync(path.join(ROOT, 'lib', 'shows', 'i18n.ts'), 'utf8');
    for (const m of showsCopy.matchAll(/\b(?:title|heroTitle|upcoming|past|faqTitle)\s*:\s*(["'`])([^"'`]*?)\1/g)) addStr(m[2]);
  } catch (e) {
    console.warn(`skip inline titles: ${e.message}`);
  }

  // 9) 스토리 글 제목 — /<locale>/stories/<slug>의 ImageHero h1이 frontmatter title이다(전 로케일 파일).
  //    2026-10-08 전수 검사에서 빠진 글자 130자 중 대부분이 여기서 나왔다. 새 글이 매일 늘지만 prebuild가
  //    배포 때마다 다시 만들므로 자동으로 따라간다.
  try {
    const storiesDir = path.join(ROOT, 'content', 'stories');
    for (const f of fs.readdirSync(storiesDir).filter((n) => n.endsWith('.md'))) {
      const head = fs.readFileSync(path.join(storiesDir, f), 'utf8').slice(0, 2000);
      const m = head.match(/^title:\s*(.+)$/m);
      if (m) addStr(m[1].trim().replace(/^(["'])(.*)\1$/, '$2'));
    }
  } catch (e) {
    console.warn(`skip story titles: ${e.message}`);
  }

  // 10) 안전판: 영문/숫자/기본 punctuation (제목에 흔히 섞이는 기호)
  const safety = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?·:;()[]\'"&-—–%/《》〈〉“”‘’+~';
  addStr(safety);

  return chars;
}

function woff2Sha256() {
  return crypto.createHash('sha256').update(fs.readFileSync(OUT_WOFF2)).digest('hex');
}

function runCheck(chars) {
  const regenerateHint =
    `node scripts/generate-hero-font.mjs 를 로컬에서 실행하고 ` +
    `갱신된 display.woff2 + display.chars.json을 함께 commit하세요.`;

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
      `generate-hero-font --check: 제목 텍스트에 subset 밖 글자 ${missing.length}자 발견: ` +
        `${JSON.stringify(missing.join(''))}\n제목 문구가 바뀌었습니다. ${regenerateHint}`,
    );
    process.exit(1);
  }
  console.log(`hero subset OK: ${chars.size} chars covered, woff2 sha match (source: ${sidecar.source ?? 'unknown'})`);
}

async function main() {
  const chars = collectDisplayChars();
  const subsetText = [...chars].join('');
  console.log(`display char set: ${chars.size} glyphs (source: ${SOURCE_NAME})`);

  if (process.argv.includes('--check')) {
    runCheck(chars);
    return;
  }

  let src;
  try {
    src = await ensureSourceFont();
  } catch (err) {
    // prebuild 체인에서 실행되므로 CDN 장애·rate limit·타임아웃이 빌드 전체를
    // 깨뜨리면 안 된다. 산출물(woff2)은 commit돼 있으므로, source font를 못 받으면
    // 이미 커밋된 woff2를 그대로 사용하고 빌드를 계속한다. (제목 텍스트가 바뀐 경우엔
    // 로컬에서 이 스크립트를 수동 재실행해 갱신된 woff2를 commit해야 한다.)
    if (fs.existsSync(OUT_WOFF2)) {
      console.warn(`generate-hero-font: source font unavailable (${err.message}); ` +
        `keeping committed ${path.relative(ROOT, OUT_WOFF2)} and continuing build.`);
      return;
    }
    throw err;
  }

  const out = await subsetFont(src, subsetText, SOURCE.subsetOptions);

  fs.mkdirSync(path.dirname(OUT_WOFF2), { recursive: true });
  fs.writeFileSync(OUT_WOFF2, out);
  fs.writeFileSync(
    OUT_CHARS,
    `${JSON.stringify({ source: SOURCE_NAME, weight: SOURCE.weight, sha256: woff2Sha256(), chars: [...chars].sort() })}\n`,
  );

  console.log(`written: ${path.relative(ROOT, OUT_WOFF2)}  (${(out.length / 1024).toFixed(1)} KB)`);
  console.log(`written: ${path.relative(ROOT, OUT_CHARS)}  (${chars.size} chars + woff2 sha)`);
}

main().catch((err) => {
  console.error('generate-hero-font failed:', err);
  process.exit(1);
});
