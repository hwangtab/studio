#!/usr/bin/env node
// 전환 실험 판정기 — GA4 랜딩 기준 "세션당 리드"로 판정한다. CTR 실험은 ctr-verdict.mjs.
//
// 사용:
//   전후 비교 (콜아웃 이동·CTA 신설처럼 한 페이지를 바꾼 실험):
//     node --env-file=.env.local scripts/lead-verdict.mjs \
//       --pages practice-room-monthly1,recording-price1 --from 2026-09-15 --days 28 --control /ko/practice-room
//     → 각 페이지의 [from-days, from) vs [from, from+days) 를 비교. 기대 리드 = 전 전환율 × 후 세션.
//
//   처치군/대조군 (같은 창에서 두 군을 비교하는 실험 — 10/1 믹싱 오퍼·보컬 브릿지):
//     node --env-file=.env.local scripts/lead-verdict.mjs \
//       --tc --from 2026-09-02 --days 28 --pages mixing15,mixing19,... --control mastering1,vocal-compression1,...
//     → 기대 리드 = 대조군 전환율 × 처치군 세션.
//
// 왜 랜딩 기준인가 (CLAUDE.md 규칙 6): 리드 이벤트를 page_path로 세면 스토리에 착지해 LP로
// 이동한 뒤 전환한 세션이 LP 공으로 잡힌다. landingPage 차원으로 세션과 리드를 같은 기준에
// 묶어야 "이 페이지에 온 사람이 문의했는가"가 된다. 2026-09-15 연습실 진단에서 page_path 기준은
// p=0.49(무변화), 랜딩 기준은 p=0.033(-41%)으로 판정이 갈렸다.
//
// 판정 규칙(ctr-verdict와 동일): 편차 ≥+20% & p<0.05 ✅ / ≤-20% & p<0.05 ❌ / p≥0.05 & 기대<10 ⓘ / 그 외 ➖
import { google } from 'googleapis';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);
const FROM = argOf('from'); const DAYS = Number(argOf('days', '28')); const TC = has('tc');
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const PAGES = list(argOf('pages')); const CONTROL = list(argOf('control'));
if (!FROM || !PAGES.length) { console.error('필수: --from YYYY-MM-DD --pages a,b [--control c,d] [--days 28] [--tc]'); process.exit(1); }
for (const k of ['GA4_PROPERTY_ID', 'GA4_OAUTH_REFRESH_TOKEN', 'GSC_OAUTH_CLIENT_ID', 'GSC_OAUTH_CLIENT_SECRET']) if (!process.env[k]) { console.error(`env 누락: ${k}`); process.exit(1); }

const toPath = (p) => (p.startsWith('/') ? p : `/ko/stories/${p}`);
const shift = (iso, d) => { const x = new Date(`${iso}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const DATA_FINAL = shift(new Date().toISOString().slice(0, 10), -2); // GA4 당일·전일은 미완성
const post = { startDate: FROM, endDate: shift(FROM, DAYS - 1) < DATA_FINAL ? shift(FROM, DAYS - 1) : DATA_FINAL };
const pre = { startDate: shift(FROM, -DAYS), endDate: shift(FROM, -1) };
const LEADS = ['lead_click_kakao', 'lead_click_phone', 'lead_click_email', 'lead_submit_success'];
const BOT = { notExpression: { andGroup: { expressions: [
  { filter: { fieldName: 'sessionSourceMedium', stringFilter: { matchType: 'EXACT', value: '(direct) / (none)' } } },
  { filter: { fieldName: 'language', stringFilter: { matchType: 'EXACT', value: 'English' } } } ] } } };

const oauth2 = new google.auth.OAuth2(process.env.GSC_OAUTH_CLIENT_ID, process.env.GSC_OAUTH_CLIENT_SECRET);
oauth2.setCredentials({ refresh_token: process.env.GA4_OAUTH_REFRESH_TOKEN });
const ad = google.analyticsdata({ version: 'v1beta', auth: oauth2 });
const P = `properties/${process.env.GA4_PROPERTY_ID}`;
const run = async (body) => (await ad.properties.runReport({ property: P, requestBody: { ...body, dimensionFilter: { andGroup: { expressions: [body.dimensionFilter, BOT] } } } })).data.rows || [];
const landing = (p) => ({ filter: { fieldName: 'landingPagePlusQueryString', stringFilter: { matchType: 'BEGINS_WITH', value: p } } });
async function measure(page, win) {
  const s = await run({ dateRanges: [win], metrics: [{ name: 'sessions' }], dimensionFilter: landing(page) });
  const l = await run({ dateRanges: [win], metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [landing(page), { filter: { fieldName: 'eventName', inListFilter: { values: LEADS } } }] } } });
  return { sessions: Number(s[0]?.metricValues[0].value || 0), leads: Number(l[0]?.metricValues[0].value || 0) };
}
const sum = (arr) => arr.reduce((a, x) => ({ sessions: a.sessions + x.sessions, leads: a.leads + x.leads }), { sessions: 0, leads: 0 });

function poissonTwoSidedP(k, lambda) {
  if (lambda <= 0) return 1;
  const pmf = (n) => { let t = Math.exp(-lambda); for (let i = 1; i <= n; i++) t *= lambda / i; return t; };
  const pk = pmf(k); let tot = 0;
  for (let n = 0; n < Math.max(200, lambda * 6 + 60); n++) { const t = pmf(n); if (t <= pk * 1.0000001) tot += t; }
  return Math.min(1, tot);
}
function verdict(observed, expected) {
  const dev = expected > 0 ? observed / expected - 1 : 0; const p = poissonTwoSidedP(observed, expected);
  const mark = dev >= 0.2 && p < 0.05 ? '✅ 성공' : dev <= -0.2 && p < 0.05 ? '❌ 무효' : p >= 0.05 && expected < 10 ? 'ⓘ 표본 미달' : '➖ 변화없음';
  return { dev, p, mark };
}
const pct = (n, d) => (d ? `${(100 * n / d).toFixed(2)}%` : '-');

console.log(`창: 전 ${pre.startDate}~${pre.endDate} / 후 ${post.startDate}~${post.endDate} (GA4 랜딩 기준, 봇 제외, 리드=${LEADS.join('·')})\n`);
if (!TC) {
  console.log('페이지 | 전 세션→리드 (전환율) | 후 세션→리드 (전환율) | 기대 | 편차 | p | 판정');
  for (const pg of [...PAGES.map((p) => ({ p, role: '' })), ...CONTROL.map((p) => ({ p, role: '대조 ' }))]) {
    const path = toPath(pg.p); const a = await measure(path, pre), b = await measure(path, post);
    const expected = a.sessions ? (a.leads / a.sessions) * b.sessions : 0; const v = verdict(b.leads, expected);
    console.log(`${pg.role}${pg.p} | ${a.sessions}→${a.leads} (${pct(a.leads, a.sessions)}) | ${b.sessions}→${b.leads} (${pct(b.leads, b.sessions)}) | ${expected.toFixed(1)} | ${(100 * v.dev).toFixed(0)}% | ${v.p.toExponential(1)} | ${v.mark}`);
  }
} else {
  const t = sum(await Promise.all(PAGES.map((p) => measure(toPath(p), post))));
  const c = sum(await Promise.all(CONTROL.map((p) => measure(toPath(p), post))));
  const expected = c.sessions ? (c.leads / c.sessions) * t.sessions : 0; const v = verdict(t.leads, expected);
  console.log(`처치군 ${PAGES.length}편: 세션 ${t.sessions} → 리드 ${t.leads} (${pct(t.leads, t.sessions)})`);
  console.log(`대조군 ${CONTROL.length}편: 세션 ${c.sessions} → 리드 ${c.leads} (${pct(c.leads, c.sessions)})`);
  console.log(`기대(대조군 전환율 × 처치군 세션) ${expected.toFixed(1)} · 편차 ${(100 * v.dev).toFixed(0)}% · p=${v.p.toExponential(1)} → ${v.mark}`);
  const tp = sum(await Promise.all(PAGES.map((p) => measure(toPath(p), pre)))), cp = sum(await Promise.all(CONTROL.map((p) => measure(toPath(p), pre))));
  console.log(`\n참고 — 같은 두 군의 직전 ${DAYS}일: 처치 ${pct(tp.leads, tp.sessions)} vs 대조 ${pct(cp.leads, cp.sessions)} (처치 전 기저 차이 확인용)`);
}
console.log('\n판정을 docs/ctr-surgery-log.md 실험 현황표에 반영하고 커밋할 것.');
