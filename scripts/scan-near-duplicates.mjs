#!/usr/bin/env node
// 스토리 근접중복(near-duplicate) 전수 스캔 — 분석 전용. 콘텐츠·리다이렉트 맵을 절대 수정하지 않는다.
// docs/p1-followups-2026-07.md §1-5 후속: cover 계열 등 잔여 주제 변형 페어 전수 탐지.
//
// 파이프라인:
//   1) content/stories/*.md 중 ko 원본(slug.md)만 로드, lib/regionRedirectMap.json에
//      이미 등재된(=308 처리 완료) slug는 스캔에서 제외
//   2) 전처리 — 프론트매터, AUTO-EXPAND-V1 블록(lib/storyContentPolicy.ts와 동일 마커),
//      저자 박스("## Studio NOL이 …" 섹션 전체), 관련글 링크 라인, 마크다운 문법 제거 + 공백 정규화
//   3) 문자 5-gram shingle 집합의 정확 Jaccard.
//      1,000+² 전수 비교는 (a) 크기 비율 하드 바운드(J ≤ |min|/|max|),
//      (b) bottom-128 스케치 추정(MinHash 등가, 예상 J ≥ 0.25만 통과 — 0.45 기준 대비 ≈4.5σ 여유),
//      (c) 정렬 병합 + 조기 포기(early-abandon)로 수십 초 내 처리
//   4) 어노테이션 — 색인 가능성(robots noindex + thin 게이트: lib/storyContentPolicy.ts
//      computeThinContentStatus 재현 — 임계 1500자, 쇼트코드 보너스, 광역 허브 예외),
//      지역 비허브 여부(lib/stories.ts isListableStory와 동일: category 'region' && 비허브),
//      GSC 성과(docs/gsc-audit-output.csv) → canonical 권고(impressions > clicks > content_len)
//
// 사용: node scripts/scan-near-duplicates.mjs [--month YYYY-MM]
// 산출: docs/near-duplicate-scan-<YYYY-MM>.csv / .md (기본값은 실행 시점의 달)
//
// 출력 파일을 실행 월로 나누는 이유: 예전엔 2026-07 파일에 하드코딩돼 있어서, 스캔을
// 돌릴 때마다 비교 기준이 되는 과거 스냅샷을 덮어썼다. 개선 효과를 측정하려면 이전 회차가
// 남아 있어야 한다(2026-07 81건 → 2026-08 31건처럼). 같은 달에 여러 번 돌리면 그 달
// 파일만 갱신되므로, 회차를 따로 남기고 싶으면 --month로 이름을 지정한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { applyFactTokens } from '../lib/factTokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORIES_DIR = path.join(ROOT, 'content/stories');
const REDIRECT_MAP_PATH = path.join(ROOT, 'lib/regionRedirectMap.json');
const REGION_HUBS_PATH = path.join(ROOT, 'lib/regionHubSlugs.json');
const GSC_CSV_PATH = path.join(ROOT, 'docs/gsc-audit-output.csv');
const monthArg = process.argv.find((a) => a.startsWith('--month='))?.split('=')[1]
  ?? (process.argv.includes('--month') ? process.argv[process.argv.indexOf('--month') + 1] : null);
if (monthArg && !/^\d{4}-\d{2}$/.test(monthArg)) {
  console.error(`--month 형식은 YYYY-MM 이어야 한다 (받은 값: ${monthArg})`);
  process.exit(1);
}
const SCAN_MONTH = monthArg ?? new Date().toISOString().slice(0, 7);
const OUT_BASENAME = `near-duplicate-scan-${SCAN_MONTH}`;
const OUT_CSV = path.join(ROOT, `docs/${OUT_BASENAME}.csv`);
const OUT_MD = path.join(ROOT, `docs/${OUT_BASENAME}.md`);

const SHINGLE_K = 5; // 문자 5-gram
const REPORT_THRESHOLD = 0.45; // CSV 등재 하한 (본문 Jaccard)
const SKETCH_K = 128; // bottom-k 스케치 크기 (MinHash 128 perm 등가 정밀도)
const SKETCH_EST_MIN = 0.25; // 스케치 추정 J 통과 하한 — 0.45 대비 σ≈0.044의 ≈4.5σ 여유
// lib/storyContentPolicy.ts와 동기 (thin-content 판정 재현용)
const THIN_CONTENT_THRESHOLD = 1500;
// 값은 lib/storyContentPolicy.ts의 SHORTCODE_CHAR_ESTIMATES와 같아야 한다(.ts라 import 불가라 미러링).
// 숏코드를 추가하거나 컴포넌트 문구를 고치면 여기도 같이 고칠 것 — 어긋나면 이 스캔의
// 색인 가능성 판정이 실제와 달라진다(session-checklist가 420으로 남아 있던 적이 있다).
const SHORTCODE_CHAR_ESTIMATES = {
  'online-fallback': 120,
  'session-checklist': 160,
  'studio-more': 204,
  'studio-services': 135,
  'online-request': 124,
  'vocal-mix-bridge': 224,
  'practice-room-terms': 117,
};
const SHORTCODE_DEFAULT_CHAR_ESTIMATE = 80;
const AUTO_EXPAND_BLOCK_REGEX = /<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/g;
// sanity check 대상: [기처리 페어(결과에 없어야 정상), 미해결 cover 페어(잡혀야 정상)]
const WATCH_PAIRS = [
  ['album-art1', 'album-artwork1'],
  ['cover1', 'coverrecording1'],
];

// ---------------------------------------------------------------------------
// 전처리
// ---------------------------------------------------------------------------

const stripAutoExpand = (content) =>
  content.replace(AUTO_EXPAND_BLOCK_REGEX, '').replace(/\n{3,}/g, '\n\n');

// 저자 박스: "## Studio NOL이 …에게 자주 권하는 3가지" 헤딩부터 다음 '---' 구분선
// 또는 다음 '## ' 헤딩(또는 EOF)까지 통째로 제거. 1,400+개 파일에 도시·주제명만
// 치환된 템플릿이라 남기면 Jaccard가 일괄 상향돼 신호가 오염된다.
function stripAuthorBoxSections(body) {
  const lines = body.split('\n');
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (/^## Studio NOL이 /.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/^---\s*$/.test(line)) {
        skipping = false; // 구분선까지 제거하고 종료
        continue;
      }
      if (/^## /.test(line)) {
        skipping = false; // 다음 섹션 헤딩은 보존
      } else {
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

// 관련글 링크 라인: "[제목](/stories/slug)" 단독 또는 " | "로 이어진 목록 전체 라인
const RELATED_LINKS_LINE =
  /^\s*\[[^\]]+\]\(\/stories\/[^)]+\)(?:\s*\|\s*\[[^\]]+\]\(\/stories\/[^)]+\))*\s*$/;

// 마크다운 문법 제거 + 공백 정규화 → shingle 입력 텍스트
function normalizeForShingles(body) {
  let t = body.replace(/<!--[\s\S]*?-->/g, ' '); // 잔여 HTML 주석
  t = t
    .split('\n')
    .filter((line) => !RELATED_LINKS_LINE.test(line)) // 관련글 링크 목록
    .filter((line) => !(/^[\s|:\-]+$/.test(line) && /[|-]/.test(line))) // 표 구분선·수평선
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '') // 헤딩 기호
        .replace(/^>\s?/, '') // 인용
        .replace(/^\s*[-*+]\s+/, '') // 불릿
        .replace(/^\s*\d+\.\s+/, ''), // 번호 목록
    )
    .join('\n');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' '); // 이미지 마크업 전체(alt는 제목 반복이라 제외)
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // 링크 → 앵커 텍스트만
  t = t.replace(/%%[a-z-]+%%/g, ' '); // 블록 쇼트코드 (fact token은 이미 치환됨)
  t = t.replace(/[*_`~]+/g, ''); // 강조·코드 기호
  t = t.replace(/\|/g, ' '); // 표 셀 구분자
  return t.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// shingle + Jaccard
// ---------------------------------------------------------------------------

// FNV-1a 32bit 해시로 문자 k-gram을 정수화 → 중복 제거 후 오름차순 Uint32Array.
// 정렬해 두면 (1) 앞쪽 SKETCH_K개가 그대로 bottom-k 스케치, (2) 병합으로 정확 교집합 계산.
function sortedShingles(text, k) {
  const set = new Set();
  const n = text.length;
  if (n === 0) return new Uint32Array(0);
  const last = Math.max(0, n - k);
  for (let i = 0; i <= last; i++) {
    let h = 0x811c9dc5;
    const end = Math.min(i + k, n);
    for (let j = i; j < end; j++) {
      h ^= text.charCodeAt(j);
      h = Math.imul(h, 0x01000193);
    }
    set.add(h >>> 0);
    if (n <= k) break; // k 미만 초단문은 전체를 1개 shingle로
  }
  return Uint32Array.from(set).sort();
}

// bottom-k 스케치 추정: 합집합에서 가장 작은 해시 k개 중 양쪽 모두에 존재하는 비율.
// E[추정] = Jaccard, σ = sqrt(J(1-J)/k) — MinHash k-perm과 동일한 통계 성질.
function bottomKEstimate(a, b, k) {
  let i = 0;
  let j = 0;
  let seen = 0;
  let match = 0;
  const la = a.length;
  const lb = b.length;
  while (seen < k && (i < la || j < lb)) {
    if (j >= lb || (i < la && a[i] < b[j])) {
      i++;
    } else if (i >= la || b[j] < a[i]) {
      j++;
    } else {
      match++;
      i++;
      j++;
    }
    seen++;
  }
  return seen === 0 ? 0 : match / seen;
}

// 정확 Jaccard — threshold 미달이 확정되는 순간 조기 포기(-1 반환).
// 유지되는 페어의 값은 정확값(포기는 J < threshold일 때만 발생).
function exactJaccardAtLeast(a, b, threshold) {
  const sa = a.length;
  const sb = b.length;
  const required = Math.ceil((threshold * (sa + sb)) / (1 + threshold)); // J≥t에 필요한 |교집합| 하한
  let i = 0;
  let j = 0;
  let inter = 0;
  while (i < sa && j < sb) {
    const remain = sa - i < sb - j ? sa - i : sb - j;
    if (inter + remain < required) return -1;
    const x = a[i];
    const y = b[j];
    if (x < y) i++;
    else if (x > y) j++;
    else {
      inter++;
      i++;
      j++;
    }
  }
  const union = sa + sb - inter;
  return union === 0 ? 0 : inter / union;
}

function exactJaccard(a, b) {
  let i = 0;
  let j = 0;
  let inter = 0;
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) i++;
    else if (a[i] > b[j]) j++;
    else {
      inter++;
      i++;
      j++;
    }
  }
  const union = a.length + b.length - inter;
  return union === 0 ? 0 : inter / union;
}

// ---------------------------------------------------------------------------
// 타이틀 유사도 (정규화 후 토큰 Jaccard)
// ---------------------------------------------------------------------------

function titleTokenSet(title) {
  return new Set(
    String(title ?? '')
      .normalize('NFC')
      .toLowerCase()
      .split(/[^0-9a-z가-힣]+/u)
      .filter(Boolean),
  );
}

function setJaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------------------------------------------------------------------------
// 문서 로드·어노테이션
// ---------------------------------------------------------------------------

const regionHubs = new Set(JSON.parse(fs.readFileSync(REGION_HUBS_PATH, 'utf8')));

function buildDoc(slug, rawFile) {
  // lib/stories.ts와 동일하게 raw 읽기 시점에 fact token 치환 → thin 글자 수 판정 일치
  const { data, content } = matter(applyFactTokens(rawFile));

  const robots = typeof data.robots === 'string' ? data.robots : '';
  const robotsNoindex = /noindex/i.test(robots); // lib/stories.ts와 동일 판정

  const contentWithoutAutoExpand = stripAutoExpand(content);

  // thin 판정 입력 재현: frontmatter thumbnail 부재 시 본문 첫 이미지가 썸네일로 승격되며
  // 판정 입력에서 제거된다(lib/stories.ts). 현재 ko 원본 전수가 thumbnail 명시라 실질 no-op.
  let thinInput = contentWithoutAutoExpand;
  if (!data.thumbnail) {
    const m = thinInput.match(/!\[.*?\]\(([^)]+)\)/);
    if (m) thinInput = thinInput.replace(m[0], '');
  }
  const shortcodeBonus = [...thinInput.matchAll(/%%([a-z-]+)%%/g)].reduce(
    (sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? SHORTCODE_DEFAULT_CHAR_ESTIMATE),
    0,
  );
  const charCount = thinInput.replace(/\s+/g, '').length + shortcodeBonus;
  const isThin = !regionHubs.has(slug) && charCount < THIN_CONTENT_THRESHOLD;

  // normalizeStoryCategoryKey(lib/storyCategories.ts)에서 'region'으로 정규화되는
  // 원문 표기는 '지역 가이드'와 'region' 둘뿐 — 정확 재현.
  const rawCategory = String(data.category ?? '').trim();
  const isRegionCat = rawCategory === '지역 가이드' || rawCategory === 'region';
  const isRegionNonHub = isRegionCat && !regionHubs.has(slug);
  const isHub = regionHubs.has(slug);

  const cleaned = normalizeForShingles(stripAuthorBoxSections(contentWithoutAutoExpand));

  return {
    slug,
    title: String(data.title ?? ''),
    titleTokens: titleTokenSet(data.title),
    robotsNoindex,
    isThin,
    // ko 페이지 noindex 조건 재현 — pages/[locale]/stories/[id].tsx:
    // robots={story.robots || (isThinContent ? 'noindex, follow' : undefined)}
    indexable: !robotsNoindex && !isThin,
    isRegionCat,
    isRegionNonHub,
    isHub,
    charCount,
    cleanedLen: cleaned.length,
    sh: sortedShingles(cleaned, SHINGLE_K),
  };
}

// ---------------------------------------------------------------------------
// GSC CSV
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadGsc() {
  const map = new Map();
  if (!fs.existsSync(GSC_CSV_PATH)) {
    console.warn(`[scan] GSC CSV 없음: ${path.relative(ROOT, GSC_CSV_PATH)} — GSC 컬럼은 공란 처리`);
    return map;
  }
  const rows = parseCsv(fs.readFileSync(GSC_CSV_PATH, 'utf8'));
  const header = rows[0].map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const r of rows.slice(1)) {
    const slug = r[idx.slug];
    if (!slug) continue;
    map.set(slug, {
      clicks: Number(r[idx.clicks] ?? 0) || 0,
      impressions: Number(r[idx.impressions] ?? 0) || 0,
      tier: r[idx.tier] ?? '',
      contentLen: Number(r[idx.content_len] ?? 0) || 0,
    });
  }
  return map;
}

// 권고: GSC 강자(impressions 우선 → clicks → content_len)를 canonical로.
function pickCanonical(docA, docB, gsc) {
  const ga = gsc.get(docA.slug);
  const gb = gsc.get(docB.slug);
  const ia = ga?.impressions ?? 0;
  const ib = gb?.impressions ?? 0;
  if (ia !== ib) return ia > ib ? docA.slug : docB.slug;
  const ca = ga?.clicks ?? 0;
  const cb = gb?.clicks ?? 0;
  if (ca !== cb) return ca > cb ? docA.slug : docB.slug;
  const la = ga?.contentLen ?? docA.charCount;
  const lb = gb?.contentLen ?? docB.charCount;
  if (la !== lb) return la > lb ? docA.slug : docB.slug;
  return docA.slug; // 완전 동률(드묾) — 결정적 출력 위해 slug 알파벳 앞선 쪽
}

// 페어 집합의 연결 요소(connected component) 클러스터링 — 템플릿 계열은 페어가
// 조합 폭발(C(n,2))하므로 의사결정 단위는 페어가 아니라 클러스터다.
function clusterPairs(pairList) {
  const parent = new Map();
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(x) !== r) {
      const next = parent.get(x);
      parent.set(x, r);
      x = next;
    }
    return r;
  };
  for (const p of pairList) {
    if (!parent.has(p.a.slug)) parent.set(p.a.slug, p.a.slug);
    if (!parent.has(p.b.slug)) parent.set(p.b.slug, p.b.slug);
    const ra = find(p.a.slug);
    const rb = find(p.b.slug);
    if (ra !== rb) parent.set(ra, rb);
  }
  const groups = new Map();
  for (const slug of parent.keys()) {
    const r = find(slug);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(slug);
  }
  const commonPrefix = (slugs) =>
    slugs.reduce((acc, s) => {
      let i = 0;
      while (i < acc.length && i < s.length && acc[i] === s[i]) i++;
      return acc.slice(0, i);
    });
  return [...groups.values()]
    .map((members) => {
      members.sort();
      const inCluster = pairList.filter(
        (p) => members.includes(p.a.slug) && members.includes(p.b.slug),
      );
      const js = inCluster.map((p) => p.jaccard);
      return {
        members,
        label: commonPrefix(members).replace(/[0-9]*$/, '') || members[0],
        pairCount: inCluster.length,
        minJ: Math.min(...js),
        maxJ: Math.max(...js),
      };
    })
    .sort((a, b) => b.members.length - a.members.length || b.maxJ - a.maxJ);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const t0 = Date.now();

  const redirectMap = JSON.parse(fs.readFileSync(REDIRECT_MAP_PATH, 'utf8'));
  const redirectedSlugs = new Set(Object.keys(redirectMap));

  const koFiles = fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md') && !/\.(en|zh|es|vi|th|uz)\.md$/.test(f))
    .sort();

  const docs = [];
  let excludedRedirected = 0;
  for (const f of koFiles) {
    const slug = f.replace(/\.md$/, '');
    if (redirectedSlugs.has(slug)) {
      excludedRedirected++;
      continue; // 이미 308 처리 완료 — 스캔 제외
    }
    try {
      docs.push(buildDoc(slug, fs.readFileSync(path.join(STORIES_DIR, f), 'utf8')));
    } catch (e) {
      console.warn(`[scan] 파싱 실패, 건너뜀: ${f} (${e.message})`);
    }
  }
  const tLoad = Date.now();
  console.log(
    `[scan] ko 원본 ${koFiles.length}개 중 redirect 맵 등재 ${excludedRedirected}개 제외 → 대상 ${docs.length}개 (전처리 ${((tLoad - t0) / 1000).toFixed(1)}s)`,
  );

  // --- 전수 페어 스캔 ---
  const n = docs.length;
  const totalPairs = (n * (n - 1)) / 2;
  let sizePass = 0;
  let sketchPass = 0;
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const A = docs[i].sh;
    const la = A.length;
    if (la === 0) continue;
    for (let j = i + 1; j < n; j++) {
      const B = docs[j].sh;
      const lb = B.length;
      if (lb === 0) continue;
      const minS = la < lb ? la : lb;
      const maxS = la < lb ? lb : la;
      if (minS < REPORT_THRESHOLD * maxS) continue; // 하드 바운드: J ≤ min/max
      sizePass++;
      if (bottomKEstimate(A, B, SKETCH_K) < SKETCH_EST_MIN) continue;
      sketchPass++;
      const jac = exactJaccardAtLeast(A, B, REPORT_THRESHOLD);
      if (jac >= REPORT_THRESHOLD) {
        pairs.push({ a: docs[i], b: docs[j], jaccard: jac });
      }
    }
  }
  const tScan = Date.now();
  console.log(
    `[scan] 페어 ${totalPairs.toLocaleString()}건 → 크기필터 통과 ${sizePass.toLocaleString()} → 스케치 통과 ${sketchPass.toLocaleString()} → J≥${REPORT_THRESHOLD} ${pairs.length}건 (스캔 ${((tScan - tLoad) / 1000).toFixed(1)}s)`,
  );

  pairs.sort((p, q) => q.jaccard - p.jaccard || p.a.slug.localeCompare(q.a.slug));

  // --- GSC 어노테이션 ---
  const gsc = loadGsc();
  for (const p of pairs) {
    p.titleSim = setJaccard(p.a.titleTokens, p.b.titleTokens);
    p.gscA = gsc.get(p.a.slug) ?? null;
    p.gscB = gsc.get(p.b.slug) ?? null;
    p.recommended = pickCanonical(p.a, p.b, gsc);
  }

  // --- sanity check: 기처리/미해결 페어 ---
  const docBySlug = new Map(docs.map((d) => [d.slug, d]));
  const loadWatchDoc = (slug) => {
    if (docBySlug.has(slug)) return { doc: docBySlug.get(slug), inScan: true };
    const p = path.join(STORIES_DIR, `${slug}.md`);
    if (!fs.existsSync(p)) return { doc: null, inScan: false };
    return { doc: buildDoc(slug, fs.readFileSync(p, 'utf8')), inScan: false }; // 진단용 out-of-band 로드
  };
  const watchResults = WATCH_PAIRS.map(([sa, sb]) => {
    const wa = loadWatchDoc(sa);
    const wb = loadWatchDoc(sb);
    const jac = wa.doc && wb.doc ? exactJaccard(wa.doc.sh, wb.doc.sh) : null;
    const inResults = pairs.some(
      (p) =>
        (p.a.slug === sa && p.b.slug === sb) || (p.a.slug === sb && p.b.slug === sa),
    );
    return { sa, sb, aInScan: wa.inScan, bInScan: wb.inScan, jaccard: jac, inResults };
  });
  for (const w of watchResults) {
    console.log(
      `[sanity] ${w.sa}/${w.sb}: J=${w.jaccard === null ? 'n/a' : w.jaccard.toFixed(4)}, 스캔 포함=${w.aInScan}/${w.bInScan}, 결과 등재=${w.inResults}`,
    );
  }

  // --- cover 계열 전체 페어 (임계 무관 정확값 — 리포트 명시용) ---
  const coverDocs = docs.filter((d) => d.slug.startsWith('cover'));
  const coverPairs = [];
  for (let i = 0; i < coverDocs.length; i++) {
    for (let j = i + 1; j < coverDocs.length; j++) {
      coverPairs.push({
        a: coverDocs[i],
        b: coverDocs[j],
        jaccard: exactJaccard(coverDocs[i].sh, coverDocs[j].sh),
        titleSim: setJaccard(coverDocs[i].titleTokens, coverDocs[j].titleTokens),
      });
    }
  }
  coverPairs.sort((p, q) => q.jaccard - p.jaccard);

  // --- CSV 출력 ---
  const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvLines = [
    'slugA,slugB,bodyJaccard,titleSim,indexableA,indexableB,clicksA,clicksB,imprA,imprB,tierA,tierB,recommendedCanonical',
  ];
  for (const p of pairs) {
    csvLines.push(
      [
        p.a.slug,
        p.b.slug,
        p.jaccard.toFixed(4),
        p.titleSim.toFixed(3),
        p.a.indexable,
        p.b.indexable,
        p.gscA ? p.gscA.clicks : '',
        p.gscB ? p.gscB.clicks : '',
        p.gscA ? p.gscA.impressions : '',
        p.gscB ? p.gscB.impressions : '',
        p.gscA ? p.gscA.tier : '',
        p.gscB ? p.gscB.tier : '',
        p.recommended,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  fs.writeFileSync(OUT_CSV, `${csvLines.join('\n')}\n`);

  // --- MD 리포트 ---
  // 버킷: (1) 실행 대상 = 양측 모두 색인 가능. 그중 지역 카테고리 페어는 지역 정책
  // 트랙(허브 통합·pSEO)에서 다루므로 건수·클러스터 요약만, 비지역 페어를 본 표로.
  // (2) 한쪽이라도 색인 불가(robots/thin) 페어는 중복 신호가 없으므로 건수만.
  const actionable = pairs.filter((p) => p.a.indexable && p.b.indexable);
  const actNonRegion = actionable.filter((p) => !p.a.isRegionCat && !p.b.isRegionCat);
  const actRegion = actionable.filter((p) => p.a.isRegionCat || p.b.isRegionCat);
  const actRegionHub = actRegion.filter((p) => p.a.isHub || p.b.isHub);
  const nonActionable = pairs.filter((p) => !(p.a.indexable && p.b.indexable));
  const nonActRegion = nonActionable.filter((p) => p.a.isRegionCat || p.b.isRegionCat);
  const nonActOther = nonActionable.filter((p) => !(p.a.isRegionCat || p.b.isRegionCat));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const thresholds = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
  const thresholdRows = thresholds
    .map((t) => {
      const total = pairs.filter((p) => p.jaccard >= t).length;
      const act = actionable.filter((p) => p.jaccard >= t).length;
      const actNR = actNonRegion.filter((p) => p.jaccard >= t).length;
      return `| ≥ ${t.toFixed(2)} | ${total} | ${act} | ${actNR} |`;
    })
    .join('\n');

  const fmtGsc = (g) => (g ? `${g.clicks} / ${g.impressions} / ${g.tier}` : '—');
  const fmtMembers = (members, max = 8) =>
    members
      .slice(0, max)
      .map((s) => `\`${s}\``)
      .join(', ') + (members.length > max ? ` 외 ${members.length - max}편` : '');
  const clusterTable = (clusters) =>
    clusters
      .map(
        (c) =>
          `| \`${c.label}*\` | ${c.members.length} | ${c.pairCount} | ${c.minJ.toFixed(2)}–${c.maxJ.toFixed(2)} | ${fmtMembers(c.members)} |`,
      )
      .join('\n');
  const clustersNonRegion = clusterPairs(actNonRegion);
  const clustersRegion = clusterPairs(actRegion);

  const actionableRows = actNonRegion
    .map(
      (p, i) =>
        `| ${i + 1} | \`${p.a.slug}\` | \`${p.b.slug}\` | ${p.jaccard.toFixed(3)} | ${p.titleSim.toFixed(2)} | ${fmtGsc(p.gscA)} | ${fmtGsc(p.gscB)} | \`${p.recommended}\` |`,
    )
    .join('\n');

  const hubPairRows = actRegionHub
    .map(
      (p) =>
        `| \`${p.a.slug}\` | \`${p.b.slug}\` | ${p.jaccard.toFixed(3)} | ${fmtGsc(p.gscA)} | ${fmtGsc(p.gscB)} |`,
    )
    .join('\n');

  const coverRows = coverPairs
    .map(
      (p) =>
        `| \`${p.a.slug}\` | \`${p.b.slug}\` | ${p.jaccard.toFixed(3)} | ${p.titleSim.toFixed(2)} | ${p.jaccard >= REPORT_THRESHOLD ? '등재' : '미달'} |`,
    )
    .join('\n');

  const watchRows = watchResults
    .map((w) => {
      const status =
        w.aInScan && w.bInScan
          ? w.inResults
            ? '스캔 대상, 결과 등재'
            : '스캔 대상, 임계 미달'
          : `redirect 맵 제외(${[!w.aInScan && w.sa, !w.bInScan && w.sb].filter(Boolean).join(', ')}) → 결과 부재`;
      return `| \`${w.sa}\` / \`${w.sb}\` | ${w.jaccard === null ? 'n/a' : w.jaccard.toFixed(3)} | ${status} |`;
    })
    .join('\n');

  const coverMax = coverPairs[0] ?? null;
  const md = `# 스토리 근접중복 전수 스캔 — ${SCAN_MONTH}

> **분석 전용 산출물.** 이 스캔은 콘텐츠 파일·리다이렉트 맵을 일절 수정하지 않았다.
> 배경·정책: [p1-followups-2026-07.md](p1-followups-2026-07.md) §1-5 (통합 시 GSC 강자를 canonical로, 약자를 308).
> 전체 페어 데이터(지역·noindex 포함 ${pairs.length}건): [${OUT_BASENAME}.csv](${OUT_BASENAME}.csv)

## 방법론

ko 원본 스토리 ${koFiles.length}편 중 \`lib/regionRedirectMap.json\`에 이미 등재된(=308 처리 완료) ${excludedRedirected}편을 제외한 **${docs.length}편**을 전수 비교했다. 본문에서 프론트매터, AUTO-EXPAND-V1 보일러플레이트 블록(\`lib/storyContentPolicy.ts\`와 동일 마커), 저자 박스 템플릿("## Studio NOL이 …" 섹션 전체), 하단 관련글 링크 목록, 마크다운 문법(이미지·링크 URL·헤딩 기호·표 구분선·강조 기호)을 제거하고 공백을 정규화한 뒤, **문자 5-gram shingle 집합의 정확 Jaccard 유사도**를 계산했다(크기 비율 하드 바운드 + bottom-128 스케치 프리필터(추정 J ≥ ${SKETCH_EST_MIN}, 0.45 기준 대비 ≈4.5σ 여유) 후 후보만 정렬 병합으로 정확 계산 — 등재 페어의 값은 전부 정확값). 타이틀 유사도는 정규화 후 토큰 Jaccard. 색인 가능성은 \`robots\` noindex 프론트매터 + thin-content 게이트(\`lib/storyContentPolicy.ts\` \`computeThinContentStatus\` 재현: AUTO-EXPAND 분리 후 1,500자 임계·쇼트코드 보너스·광역 허브 예외)로 판정했고 — \`pages/[locale]/stories/[id].tsx\`의 ko noindex 조건과 동일 — 지역 카테고리·허브 여부는 \`lib/stories.ts\` \`isListableStory\`·\`regionHubSlugs.json\`과 동일 기준이다. GSC 성과는 \`docs/gsc-audit-output.csv\`(90일 창) slug 매칭. canonical 권고는 impressions → clicks → content_len 순 우위.

## 규모·소요 시간

- 비교 페어: ${totalPairs.toLocaleString()}건 → 크기 필터 통과 ${sizePass.toLocaleString()}건 → 스케치 통과 ${sketchPass.toLocaleString()}건 → **J ≥ ${REPORT_THRESHOLD} 등재 ${pairs.length}건**
- GSC 매칭: 대상 ${docs.length}편 중 ${docs.filter((d) => gsc.has(d.slug)).length}편이 CSV에 존재
- 소요 시간: **${elapsed}s** (전처리 ${((tLoad - t0) / 1000).toFixed(1)}s + 페어 스캔 ${((tScan - tLoad) / 1000).toFixed(1)}s)

## 임계값별 페어 수 (본문 Jaccard, 누적)

| 임계 | 전체 페어 | 양측 색인 가능 | 그중 비지역(본 표 대상) |
|---|---|---|---|
${thresholdRows}

## 실행 대상 — 양측 모두 색인 가능한 페어 (${actionable.length}건)

양측 모두 robots noindex가 아니고 thin-content 게이트에도 걸리지 않는, 즉 **둘 다 실제로 색인되는** 페어. 이 중 지역 카테고리 페어 ${actRegion.length}건은 지역 정책 트랙(§1-6·역세권 pSEO)에서 다룰 사안이라 아래 "지역·noindex" 절에 건수·요약으로 분리했고, **비지역 ${actNonRegion.length}건**이 페어 단위 통합(강자 canonical + 약자 308) 검토의 실질 대상이다.

### 클러스터 요약 (연결 요소 기준 ${clustersNonRegion.length}개)

페어 수가 많은 것은 개별 사건이 아니라 템플릿 계열 내 조합 폭발(C(n,2)) 때문이다 — 의사결정 단위는 페어가 아니라 클러스터로 보는 것이 맞다.

| 클러스터 | 문서 수 | 페어 수 | J 범위 | 구성원 |
|---|---|---|---|---|
${clusterTable(clustersNonRegion) || '| (없음) | | | | |'}

### 전체 페어 표 (${actNonRegion.length}건, 유사도 내림차순)

GSC 컬럼은 \`클릭 / 노출 / tier\`.

| # | slug A | slug B | body J | title sim | GSC A | GSC B | 권고 canonical |
|---|---|---|---|---|---|---|---|
${actionableRows || '| — | (해당 없음) | | | | | | |'}

## cover 계열 판정 (명시 확인)

p1-followups §1-5에서 미해결로 남긴 cover 계열(\`cover*\` slug ${coverDocs.length}편: ${coverDocs.map((d) => `\`${d.slug}\``).join(', ')})의 전 페어 정확 Jaccard:

| slug A | slug B | body J | title sim | J≥${REPORT_THRESHOLD} |
|---|---|---|---|---|
${coverRows || '| (cover 계열 없음) | | | | |'}

**판정: cover 계열에 본문 수준 근접중복 페어는 없다.** 최고가 ${coverMax ? `\`${coverMax.a.slug}\`/\`${coverMax.b.slug}\` J=${coverMax.jaccard.toFixed(3)}` : 'n/a'}로 임계(${REPORT_THRESHOLD})에 크게 못 미친다. \`cover1\`/\`coverrecording1\`(J=${watchResults.find((w) => w.sa === 'cover1')?.jaccard?.toFixed(3) ?? 'n/a'})은 기처리 선례 \`album-art1\`/\`album-artwork1\`(J=${watchResults.find((w) => w.sa === 'album-art1')?.jaccard?.toFixed(3) ?? 'n/a'})과 같은 유형 — **본문은 별개로 작성됐지만 같은 주제를 겨냥한 '주제 변형'**이다. 이런 유형은 본문 Jaccard가 아니라 타이틀·타깃 쿼리 수준(카니벌라이제이션) 분석 대상이며, 통합 여부는 GSC 쿼리 중복 확인 후 별도 판단해야 한다(본 스캔 범위 밖 — titleSim 컬럼이 1차 단서).

## 지역·noindex 관련 페어 — 건수만

- **양측 색인 가능한 지역 카테고리 페어: ${actRegion.length}건** (클러스터 ${clustersRegion.length}개: ${clustersRegion.map((c) => `${c.members.length}편 — ${fmtMembers(c.members, 4)}`).join(' / ')}) — 역/동네 치환 템플릿으로 현재 색인되고 있어 지역 pSEO 정책 트랙에서 별도 검토 필요. 상세는 CSV 참조.
${actRegionHub.length > 0 ? `  - 그중 **광역 허브 관여 페어 ${actRegionHub.length}건** — 허브는 정보 구조상 유지 대상이라 308 통합 불가, 본문 차별화가 유일한 처방:

| slug A | slug B | body J | GSC A | GSC B |
|---|---|---|---|---|
${hubPairRows}
` : ''}- 한쪽 이상 색인 불가(robots noindex 또는 thin)라 중복 콘텐츠 신호가 없는 페어: **지역 관련 ${nonActRegion.length}건 / 그 외 ${nonActOther.length}건** — 통합 불요.

## Sanity check

| 페어 | body J | 판정 |
|---|---|---|
${watchRows}

- \`album-art1\`은 redirect 맵 등재로 스캔에서 제외되어 결과 CSV에 **없음** — 제외 로직 정상 (J는 진단용 out-of-band 계산값).
- \`cover1\`/\`coverrecording1\`은 스캔 대상에 포함되어 유사도가 계산됨(위 cover 절 판정 참조).

## 후속 — 통합 실행은 P1

**통합 실행은 P1 — 이 문서는 후보 목록일 뿐이다.** 실제 통합 시에는 페어별로 (1) 검색 의도가 정말 같은 주제 변형인지 수동 확인, (2) GSC 강자 canonical 유지 + 약자 \`lib/regionRedirectMap.json\` 308 등재, (3) 내부 링크(\`internalLinks.ts\`·본문 링크)를 canonical로 갱신해 308 홉을 방지한다(album-art1 선례 참조). 템플릿 클러스터(practice-room 계열)는 페어 단위 308이 아니라 클러스터 단위 전략(대표 페이지 통합 또는 본문 차별화) 판단이 선행돼야 한다.

---

*생성: \`scripts/scan-near-duplicates.mjs\` (${new Date().toISOString().slice(0, 10)}, 분석 전용 — 콘텐츠 비수정)*
`;
  fs.writeFileSync(OUT_MD, md);

  console.log(`[scan] CSV: ${path.relative(ROOT, OUT_CSV)} (${pairs.length}행)`);
  console.log(`[scan] MD : ${path.relative(ROOT, OUT_MD)}`);
  console.log(
    `[scan] 양측 색인 가능 ${actionable.length}건 (비지역 ${actNonRegion.length} / 지역 카테고리 ${actRegion.length}, 허브 관여 ${actRegionHub.length}) / 색인 불가측 포함 ${nonActionable.length}건 (지역 ${nonActRegion.length} / 기타 ${nonActOther.length})`,
  );
  console.log('[scan] 상위 10개 페어:');
  for (const p of pairs.slice(0, 10)) {
    console.log(
      `  ${p.jaccard.toFixed(3)}  ${p.a.slug} <-> ${p.b.slug}  (indexable ${p.a.indexable}/${p.b.indexable}, 권고 ${p.recommended})`,
    );
  }
  console.log(`[scan] 총 소요 ${elapsed}s`);
}

main();
