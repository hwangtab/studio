#!/usr/bin/env node
// CTR 수술 판정기 — 수술 전후를 GSC에 기간지정으로 질의해 노출 정규화 편차로 판정한다.
//
// 사용:
//   node --env-file=.env.local scripts/ctr-verdict.mjs --from-log
//     → docs/ctr-surgery-log.md의 측정 중(🔒) 실험을 전부 읽어 일괄 판정. 이게 기본 동선이다.
//
//   node --env-file=.env.local scripts/ctr-verdict.mjs \
//     --surgery 2026-07-26 --days 20 \
//     --slugs vocal-doubling1,chest-voice1 --control producer1,daw-choice1
//     → 수동 지정 판정 (로그에 없는 실험이나 재검증용)
//
// 왜 이 스크립트가 필요한가 (docs/ctr-surgery-log.md "방법론 경고" 참조):
//   docs/gsc-raw/*.csv는 90일 롤링 창의 스냅샷이다. 두 시점 스냅샷을 빼서 "증분"이라 부르면
//   창 뒤끝에서 빠져나간 기간이 섞여 판정이 뒤집힌다. 실제로 vocal-doubling1이 스냅샷 차분으로는
//   "무효", 기간지정으로는 "+195% 성공"으로 갈렸다. 판정은 반드시 이 스크립트로 한다.
//
// 판정 규칙:
//   기대 클릭 = 수술전 CTR × 수술후 노출 (교훈 5 노출 정규화 — 창 길이가 달라도 유효)
//   유의성 = 포아송 꼬리검정 (관측 클릭 vs λ=기대 클릭). 플랫 하한("기대<10이면 무조건 미달")은
//   쓰지 않는다 — 기대 2.0에서 13클릭이 관측되면 그건 표본 미달이 아니라 압도적 성공이다(p≈1e-8).
//   편차 ≥ +20% 이고 p < 0.05 → ✅ 성공
//   편차 ≤ -20% 이고 p < 0.05 → ❌ 무효
//   p ≥ 0.05 이고 기대 < 10   → ⓘ 표본 미달 (신호 없음과 구분 불가 — 판정 유보)
//   그 외                     → ➖ 변화없음
//   저노출 페이지(28일 노출 500 미만)는 애초에 실험 대상으로 잡지 말 것 — 로그의 "실험 설계 교훈" 절.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const SITE = process.env.GSC_SITE_URL || 'sc-domain:studionol.co.kr';
const DAYS = Number(argOf('days', '28'));
const THRESHOLD = Number(argOf('threshold', '20'));
const MIN_EXPECTED = Number(argOf('min-expected', '10'));
const DEFAULT_CONTROL = ['producer1', 'daw-choice1', 'practice-room-monthly1'];
// GSC 데이터는 약 3일 지연 후 최종화된다 — after 창의 끝을 여기까지로 자른다.
const DATA_FINAL = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);

const shift = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const minIso = (a, b) => (a < b ? a : b);
const daysBetween = (a, b) =>
  Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);

// ── 실험 수집: --from-log 또는 수동 지정 ─────────────────────────────
// 반환: [{ surgery, slugs: [{slug, review?}] }] — 수술일별로 묶는다(질의 횟수 절약).

function experimentsFromArgs() {
  const surgery = argOf('surgery');
  const slugs = (argOf('slugs', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!surgery || !slugs.length) return null;
  return [{ surgery, slugs: slugs.map((slug) => ({ slug })) }];
}

function experimentsFromLog() {
  const logPath = path.join(ROOT, 'docs/ctr-surgery-log.md');
  const rows = fs.readFileSync(logPath, 'utf8').split('\n')
    .filter((l) => l.startsWith('| ') && l.includes('🔒'));
  const bySurgery = new Map();
  const skipped = [];
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim());
    const slug = (cells[1] || '').replace(/\*\*/g, '').replace(/`/g, '').trim();
    const surgery = (cells[3] || '').match(/20\d{2}-\d{2}-\d{2}/)?.[0];
    const review = (cells[5] || '').match(/20\d{2}-\d{2}-\d{2}/)?.[0];
    if (!slug || !surgery) {
      skipped.push(`${slug || '(slug 파싱 실패)'} — 수술일 파싱 실패, 표를 직접 확인할 것`);
      continue;
    }
    if (!bySurgery.has(surgery)) bySurgery.set(surgery, []);
    bySurgery.get(surgery).push({ slug, review });
  }
  return {
    groups: [...bySurgery.entries()].map(([surgery, slugs]) => ({ surgery, slugs })),
    skipped,
  };
}

// ── GSC 질의 ─────────────────────────────────────────────────────
const auth = () => {
  const o = new google.auth.OAuth2(process.env.GSC_OAUTH_CLIENT_ID, process.env.GSC_OAUTH_CLIENT_SECRET);
  o.setCredentials({ refresh_token: process.env.GSC_OAUTH_REFRESH_TOKEN });
  return o;
};
const sc = google.searchconsole({ version: 'v1', auth: auth() });

async function pageStats(range) {
  const stats = new Map();
  let startRow = 0;
  for (;;) {
    const res = await sc.searchanalytics.query({
      siteUrl: SITE,
      requestBody: { ...range, dimensions: ['page'], rowLimit: 25000, startRow, dataState: 'final' },
    });
    const rows = res.data.rows || [];
    for (const r of rows) {
      const url = r.keys[0];
      // 앵커(#) 행은 같은 페이지의 섹션이므로 제외. ko 정본만 — uz/en 행이 ko를 덮어쓰면 판정이 뒤집힌다.
      if (url.includes('#') || !url.includes('/ko/stories/')) continue;
      const slug = url.split('/ko/stories/')[1];
      stats.set(slug, { clicks: r.clicks, impressions: r.impressions, position: r.position });
    }
    if (rows.length < 25000) break;
    startRow += 25000;
  }
  return stats;
}

// ── 판정 ─────────────────────────────────────────────────────────

// 포아송 꼬리확률. 관측이 기대보다 크면 P(X ≥ k | λ), 작으면 P(X ≤ k | λ).
// λ ≤ 50이면 정확 합산(exp(-50)≈2e-22로 double 안전), 그보다 크면 정규 근사(연속성 보정).
function poissonTailP(lambda, k) {
  if (lambda <= 0) return 1;
  if (lambda > 50) {
    const z = (Math.abs(k - lambda) - 0.5) / Math.sqrt(lambda);
    // 표준정규 상측꼬리 근사 (Abramowitz-Stegun 26.2.17 간이형)
    const t = 1 / (1 + 0.2316419 * z);
    const d = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    return d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  }
  let pmf = Math.exp(-lambda);
  let cdf = pmf; // P(X ≤ 0)
  const upper = k > lambda;
  const limit = upper ? k - 1 : k;
  for (let i = 1; i <= limit; i++) {
    pmf *= lambda / i;
    cdf += pmf;
  }
  // upper: P(X ≥ k) = 1 - P(X ≤ k-1) / lower: P(X ≤ k)
  return upper ? Math.max(0, 1 - cdf) : cdf;
}

function judge(before, after, slug) {
  const b = before.get(slug) || { clicks: 0, impressions: 0 };
  const a = after.get(slug) || { clicks: 0, impressions: 0 };
  const beforeCtr = b.impressions ? (b.clicks / b.impressions) * 100 : 0;
  const afterCtr = a.impressions ? (a.clicks / a.impressions) * 100 : 0;
  const expected = (beforeCtr / 100) * a.impressions;
  const deviation = expected > 0 ? ((a.clicks - expected) / expected) * 100 : null;
  let label;
  if (expected === 0) {
    label = 'ⓘ 판정불가(기준선 0클릭)';
  } else {
    const p = poissonTailP(expected, a.clicks);
    const sig = p < 0.05;
    if (deviation >= THRESHOLD && sig) label = `✅ 성공 (p=${p.toExponential(1)})`;
    else if (deviation <= -THRESHOLD && sig) label = `❌ 무효 (p=${p.toExponential(1)})`;
    else if (!sig && expected < MIN_EXPECTED) label = `ⓘ 표본 미달(기대 ${expected.toFixed(1)}, p=${p.toFixed(2)})`;
    else label = '➖ 변화없음';
  }
  return { b, a, beforeCtr, afterCtr, expected, deviation, label };
}

function render(before, after, slug, tag) {
  const { b, a, beforeCtr, afterCtr, expected, deviation, label } = judge(before, after, slug);
  const dev = deviation === null ? '   —  ' : `${deviation >= 0 ? '+' : ''}${deviation.toFixed(0)}%`.padStart(6);
  return `  ${slug.padEnd(32)}${tag.padEnd(6)}`
    + `전 ${String(b.clicks).padStart(4)}clk/${String(b.impressions).padStart(6)}imp ${beforeCtr.toFixed(2).padStart(5)}%  `
    + `후 ${String(a.clicks).padStart(4)}clk/${String(a.impressions).padStart(6)}imp ${afterCtr.toFixed(2).padStart(5)}%  `
    + `기대 ${expected.toFixed(1).padStart(6)}  편차 ${dev}  ${label}`;
}

async function judgeGroup({ surgery, slugs }, control) {
  const afterEnd = minIso(shift(surgery, DAYS), DATA_FINAL);
  const afterDays = daysBetween(shift(surgery, 1), afterEnd) + 1;
  if (afterDays < 7) {
    console.log(`\n── 수술일 ${surgery}: 판정 조기 (after 창 ${afterDays}일 < 7일) — 건너뜀`);
    for (const { slug } of slugs) console.log(`  ${slug} → 나중에 다시`);
    return;
  }
  const AFTER = { startDate: shift(surgery, 1), endDate: afterEnd };
  const BEFORE = { startDate: shift(surgery, -DAYS), endDate: shift(surgery, -1) };
  const [before, after] = await Promise.all([pageStats(BEFORE), pageStats(AFTER)]);

  console.log(`\n── 수술일 ${surgery} · 전 ${BEFORE.startDate}~${BEFORE.endDate}(${DAYS}일) / 후 ${AFTER.startDate}~${AFTER.endDate}(${afterDays}일)`);
  if (afterDays < DAYS) {
    console.log(`  ※ after 창이 GSC 최종화 시점(${DATA_FINAL})에 잘렸다. 기대클릭은 CTR×노출이라 창 길이가 달라도 유효.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const { slug, review } of slugs) {
    const early = review && review > today ? ` (잠정 — 리뷰일 ${review} 전)` : '';
    console.log(render(before, after, slug, '') + early);
  }
  if (control.length) {
    console.log('  -- 대조군 (수술 안 함 — 측정 유효성 확인)');
    for (const s of control) console.log(render(before, after, s, 'ctrl'));
  }
}

// ── main ─────────────────────────────────────────────────────────
const control = (argOf('control', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const manual = experimentsFromArgs();

let groups;
let skipped = [];
if (manual) {
  groups = manual;
} else if (has('from-log')) {
  ({ groups, skipped } = experimentsFromLog());
  if (!groups.length) {
    console.log('docs/ctr-surgery-log.md에 측정 중(🔒) 실험이 없다. 판정할 것 없음.');
    process.exit(0);
  }
} else {
  console.error('사용: --from-log  또는  --surgery YYYY-MM-DD --slugs a,b [--days 28] [--control c,d] [--threshold 20] [--min-expected 10]');
  process.exit(1);
}

console.log(`임계 ±${THRESHOLD}% · 표본 하한 기대클릭 ${MIN_EXPECTED} · GSC 최종화 기준일 ${DATA_FINAL}`);
for (const g of groups) {
  await judgeGroup(g, control.length ? control : DEFAULT_CONTROL);
}
for (const s of skipped) console.log(`  ⚠ 건너뜀: ${s}`);
console.log('\n판정을 docs/ctr-surgery-log.md 실험 현황표에 반영하고 커밋할 것.');
