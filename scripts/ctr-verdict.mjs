#!/usr/bin/env node
// CTR 수술 판정기 — 수술 전후를 GSC에 기간지정으로 질의해 노출 정규화 편차로 판정한다.
//
// 사용:
//   node --env-file=.env.local scripts/ctr-verdict.mjs \
//     --surgery 2026-07-26 --days 20 \
//     --slugs vocal-doubling1,chest-voice1 --control producer1,daw-choice1
//
// 왜 이 스크립트가 필요한가 (docs/ctr-surgery-log.md "방법론 경고" 참조):
//   docs/gsc-raw/*.csv는 90일 롤링 창의 스냅샷이다. 두 시점 스냅샷을 빼서 "증분"이라 부르면
//   창 뒤끝에서 빠져나간 기간이 섞여 판정이 뒤집힌다. 실제로 vocal-doubling1이 스냅샷 차분으로는
//   "무효", 기간지정으로는 "+195% 성공"으로 갈렸다. 판정은 반드시 이 스크립트로 한다.

import { google } from 'googleapis';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SITE = process.env.GSC_SITE_URL || 'sc-domain:studionol.co.kr';
const SURGERY = arg('surgery');
const DAYS = Number(arg('days', '20'));
const SLUGS = (arg('slugs', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const CONTROL = (arg('control', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
// 임계 편차(%). 이 값을 넘으면 성공, 음수 방향으로 넘으면 무효.
const THRESHOLD = Number(arg('threshold', '20'));

if (!SURGERY || !SLUGS.length) {
  console.error('사용: node --env-file=.env.local scripts/ctr-verdict.mjs --surgery YYYY-MM-DD --slugs a,b [--days 20] [--control c,d] [--threshold 20]');
  process.exit(1);
}

const shift = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// 수술일 당일은 배포 시차로 제외하고 다음날부터 센다.
const AFTER = { startDate: shift(SURGERY, 1), endDate: shift(SURGERY, DAYS) };
const BEFORE = { startDate: shift(SURGERY, -DAYS), endDate: shift(SURGERY, -1) };

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

const [before, after] = await Promise.all([pageStats(BEFORE), pageStats(AFTER)]);

function verdictFor(slug) {
  const b = before.get(slug) || { clicks: 0, impressions: 0 };
  const a = after.get(slug) || { clicks: 0, impressions: 0 };
  const beforeCtr = b.impressions ? (b.clicks / b.impressions) * 100 : 0;
  const afterCtr = a.impressions ? (a.clicks / a.impressions) * 100 : 0;
  // 노출 정규화(교훈 5): 노출이 변해도 비교 가능하도록 기대 클릭을 기준선 CTR로 환산.
  const expected = (beforeCtr / 100) * a.impressions;
  const deviation = expected > 0 ? ((a.clicks - expected) / expected) * 100 : null;
  const label = deviation === null
    ? '판정불가(기준선 0클릭)'
    : deviation >= THRESHOLD ? '✅ 성공'
      : deviation <= -THRESHOLD ? '❌ 무효'
        : '➖ 변화없음';
  return { b, a, beforeCtr, afterCtr, expected, deviation, label };
}

function render(slug, tag) {
  const { b, a, beforeCtr, afterCtr, expected, deviation, label } = verdictFor(slug);
  const dev = deviation === null ? '   —  ' : `${deviation >= 0 ? '+' : ''}${deviation.toFixed(0)}%`.padStart(6);
  return `  ${slug.padEnd(32)}${tag.padEnd(6)}`
    + `전 ${String(b.clicks).padStart(4)}clk/${String(b.impressions).padStart(6)}imp ${beforeCtr.toFixed(2).padStart(5)}%  `
    + `후 ${String(a.clicks).padStart(4)}clk/${String(a.impressions).padStart(6)}imp ${afterCtr.toFixed(2).padStart(5)}%  `
    + `기대 ${expected.toFixed(1).padStart(6)}  편차 ${dev}  ${label}`;
}

console.log(`수술일 ${SURGERY} · 창 ${DAYS}일`);
console.log(`  전 ${BEFORE.startDate}~${BEFORE.endDate}   후 ${AFTER.startDate}~${AFTER.endDate}`);
console.log(`  기대클릭 = 수술전 CTR × 수술후 노출, 임계 ±${THRESHOLD}%\n`);
console.log('== 수술 대상');
for (const s of SLUGS) console.log(render(s, ''));
if (CONTROL.length) {
  console.log('\n== 대조군 (수술 안 함 — 측정 유효성 확인)');
  for (const s of CONTROL) console.log(render(s, 'ctrl'));
  console.log('\n대조군이 전반적으로 하락했다면 수술군의 "변화없음"도 상대적으로는 선방이다.');
}
