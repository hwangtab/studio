#!/usr/bin/env node
// GA4 Data API raw fetch — 진단용 1회성 스크립트
// 사용: node --env-file=.env.local scripts/ga4-fetch.mjs
//       node --env-file=.env.local scripts/ga4-fetch.mjs --include-bots  (봇 미제외 원본)
//
// 모든 리포트는 기본적으로 봇 트래픽을 제외한다 (BOT_EXCLUSION 참조).
// 제외된 분량은 docs/ga4-raw/bot-excluded.csv에 별도 기록된다.
//
// 필수 환경변수:
//   GA4_PROPERTY_ID          GA4 Admin → Property Settings의 숫자 ID
//   GA4_OAUTH_REFRESH_TOKEN  (최초 1회: node --env-file=.env.local scripts/ga4-oauth-setup.mjs)
//   GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'ga4-raw');
const ALL_LEAD_EVENT_NAMES = [
  'lead_click_kakao',
  'lead_click_phone',
  'lead_click_email',
  'lead_click_naver_map',
  'lead_submit_success',
  'lead_submit_error',
  'lead_form_start',
  'lead_form_abandon',
  'lead_form_field_error',
];

// 마이크로 전환 — 리드가 아니다. 관측은 하되 QUALIFIED에는 절대 넣지 않는다.
const MICRO_EVENT_NAMES = ['micro_click_service', 'micro_click_contact'];

// 실제 "문의 행동"만 유효 리드다.
// micro_click_contact(문의 페이지로 이동)와 micro_click_service(서비스 페이지 클릭)는
// 의도적으로 제외한다 — 이동은 문의가 아니다. 이 집합을 넓히면 이 사업의 유일하게
// 신뢰 가능한 지표가 희석된다.
const QUALIFIED_LEAD_EVENT_NAMES = new Set([
  'lead_click_kakao',
  'lead_click_phone',
  'lead_click_email',
  'lead_click_naver_map',
  'lead_submit_success',
]);
const FORM_ERROR_EVENT_NAMES = new Set([
  'lead_submit_error',
  'lead_form_field_error',
  'lead_form_abandon',
]);

const TRACKED_EVENT_NAMES = [...ALL_LEAD_EVENT_NAMES, ...MICRO_EVENT_NAMES];

// GA4 내장 봇 필터는 IAB 알려진 크롤러만 거른다. GA 스크립트를 실제로 실행하는
// 헤드리스 브라우저는 그대로 통과하므로 여기서 직접 잘라낸다.
//
// 지문 (2026-07-14 90일 진단): 소스 (direct)/(none) + 브라우저 언어 English 조합이
// 1,992세션(전체의 14.2%). 평균 체류 12초, first_visit 99.5%(쿠키 미유지),
// 해상도가 412x732·393x851·1280x1200 3종에 고정, 794세션 중 scroll 이벤트 1건,
// 도시·OS가 (not set)인데 deviceCategory는 desktop. 4월 중순부터 매일 일정량 유입.
// 리드 이벤트는 이 덩어리 전체에서 카카오 클릭 1건뿐.
//
// 진짜 영어권 방문자는 대부분 google/organic으로 들어오고(555세션, 체류 129초)
// 한국어 직접유입은 체류 203초라, 이 두 조건의 교집합만 잘라도 실사용자 손실은 미미하다.
const BOT_EXCLUSION = {
  notExpression: {
    andGroup: {
      expressions: [
        { filter: { fieldName: 'sessionSourceMedium', stringFilter: { matchType: 'EXACT', value: '(direct) / (none)' } } },
        { filter: { fieldName: 'language', stringFilter: { matchType: 'EXACT', value: 'English' } } },
      ],
    },
  },
};

// 위 notExpression의 여집합 — 봇 감사 리포트에서 "무엇을 버렸는지" 보여주는 데 쓴다.
const BOT_ONLY = BOT_EXCLUSION.notExpression;

const INCLUDE_BOTS = process.argv.includes('--include-bots');

// 기존 dimensionFilter를 덮어쓰지 않고 AND로 병합한다.
function withBotFilter(requestBody) {
  const existing = requestBody.dimensionFilter;
  return {
    ...requestBody,
    dimensionFilter: existing
      ? { andGroup: { expressions: [existing, BOT_EXCLUSION] } }
      : BOT_EXCLUSION,
  };
}

function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GSC_OAUTH_CLIENT_ID,
    process.env.GSC_OAUTH_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GA4_OAUTH_REFRESH_TOKEN });
  return oauth2;
}

function dateRange(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function escapeCsv(s) {
  return `"${String(s ?? '').replace(/"/g, '""')}"`;
}

// 콤마·괄호가 섞여 들어올 수 있는 열은 따옴표로 감싼다. 숫자 열은 그대로 둔다.
const TEXT_COLUMNS = new Set([
  'landing_page', 'page_path', 'event_name', 'source', 'medium', 'device', 'country',
  'llm_source', 'screen_resolution', 'operating_system',
]);

function writecsv(outPath, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map((v, i) => (TEXT_COLUMNS.has(headers[i]) ? escapeCsv(v) : v)).join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`  → ${path.relative(ROOT, outPath)} (${rows.length} rows)`);
}

// applyBotFilter: false — 봇 감사 리포트처럼 일부러 봇을 봐야 할 때만 끈다.
async function runReport(analyticsdata, propertyId, requestBody, { applyBotFilter = true } = {}) {
  const body = (applyBotFilter && !INCLUDE_BOTS) ? withBotFilter(requestBody) : requestBody;
  const res = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: body,
  });
  return res.data.rows || [];
}

// Report 1: 랜딩 페이지별 세션·이탈률·참여 시간
async function fetchLanding(analyticsdata, propertyId) {
  console.log('\n[1/6] landing page metrics (90d)...');
  const rows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [{ name: 'landingPage' }],
    metrics: [
      { name: 'sessions' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'engagedSessions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 500,
  });

  const out = rows.map((r) => [
    r.dimensionValues[0].value,
    r.metricValues[0].value,
    parseFloat(r.metricValues[1].value).toFixed(3),
    parseFloat(r.metricValues[2].value).toFixed(1),
    r.metricValues[3].value,
  ]);
  writecsv(
    path.join(OUT_DIR, 'landing.csv'),
    ['landing_page', 'sessions', 'bounce_rate', 'avg_session_sec', 'engaged_sessions'],
    out,
  );
}

// Report 2: 리드 이벤트(카카오·전화·폼 제출) — 페이지별
async function fetchEvents(analyticsdata, propertyId) {
  console.log('\n[2/6] lead events by page (90d)...');
  const rows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [{ name: 'eventName' }, { name: 'pagePath' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: TRACKED_EVENT_NAMES,
        },
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 500,
  });

  const out = rows.map((r) => [
    r.dimensionValues[0].value,
    r.dimensionValues[1].value,
    r.metricValues[0].value,
  ]);
  writecsv(
    path.join(OUT_DIR, 'events.csv'),
    ['event_name', 'page_path', 'event_count'],
    out,
  );
}

// Report 5: LLM 레퍼러별 랜딩 페이지 — ChatGPT/Perplexity 등 AI 트래픽 인용 역추적
async function fetchLlmReferrers(analyticsdata, propertyId) {
  console.log('\n[5/6] LLM referrers × landing page (90d)...');
  const rows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [{ name: 'sessionSource' }, { name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        inListFilter: {
          values: [
            'chatgpt.com',
            'perplexity.ai',
            'perplexity',
            'copilot.com',
            'gemini.google.com',
            'notebooklm.google.com',
          ],
        },
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 100,
  });

  const out = rows.map((r) => [
    r.dimensionValues[0].value,
    r.dimensionValues[1].value,
    r.metricValues[0].value,
    parseFloat(r.metricValues[1].value).toFixed(3),
    parseFloat(r.metricValues[2].value).toFixed(1),
  ]);
  writecsv(
    path.join(OUT_DIR, 'llm_referrers.csv'),
    ['llm_source', 'landing_page', 'sessions', 'bounce_rate', 'avg_session_sec'],
    out,
  );
}

const sourceKey = (source, medium) => `${source}\u0000${medium}`;

// Report 3: 소스·매체별 세션 + Studio NOL 리드 이벤트
async function fetchSource(analyticsdata, propertyId) {
  console.log('\n[3/6] source/medium sessions + lead events (90d)...');
  const sessionRows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 100,
  });

  const leadRows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ALL_LEAD_EVENT_NAMES,
        },
      },
    },
    limit: 500,
  });

  const leadEventsBySource = new Map();
  for (const row of leadRows) {
    const source = row.dimensionValues[0].value;
    const medium = row.dimensionValues[1].value;
    const eventName = row.dimensionValues[2].value;
    const eventCount = Number(row.metricValues[0].value) || 0;
    const key = sourceKey(source, medium);
    const current = leadEventsBySource.get(key) || { leadEvents: 0, qualifiedLeads: 0, formErrors: 0 };
    current.leadEvents += eventCount;
    if (QUALIFIED_LEAD_EVENT_NAMES.has(eventName)) current.qualifiedLeads += eventCount;
    if (FORM_ERROR_EVENT_NAMES.has(eventName)) current.formErrors += eventCount;
    leadEventsBySource.set(key, current);
  }

  const out = sessionRows.map((r) => {
    const source = r.dimensionValues[0].value;
    const medium = r.dimensionValues[1].value;
    const counts = leadEventsBySource.get(sourceKey(source, medium)) || { leadEvents: 0, qualifiedLeads: 0, formErrors: 0 };
    return [
      source,
      medium,
      r.metricValues[0].value,
      parseFloat(r.metricValues[1].value).toFixed(3),
      counts.leadEvents,
      counts.qualifiedLeads,
      counts.formErrors,
    ];
  });
  writecsv(
    path.join(OUT_DIR, 'source.csv'),
    ['source', 'medium', 'sessions', 'bounce_rate', 'lead_events', 'qualified_leads', 'form_errors'],
    out,
  );
}
// Report 4: 디바이스·국가 분포
async function fetchDevice(analyticsdata, propertyId) {
  console.log('\n[4/6] device × country (90d)...');
  const rows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [{ name: 'deviceCategory' }, { name: 'country' }],
    metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 50,
  });

  const out = rows.map((r) => [
    r.dimensionValues[0].value,
    r.dimensionValues[1].value,
    r.metricValues[0].value,
    parseFloat(r.metricValues[1].value).toFixed(3),
  ]);
  writecsv(
    path.join(OUT_DIR, 'device.csv'),
    ['device', 'country', 'sessions', 'bounce_rate'],
    out,
  );
}

// Report 6: 봇 감사 — 위 리포트들에서 제외된 트래픽이 정확히 무엇인지 기록.
// 제외량이 조용히 늘거나(새 봇 유입) 줄어드는(지문 변화) 걸 눈으로 잡기 위한 안전장치.
async function fetchBotAudit(analyticsdata, propertyId) {
  console.log('\n[6/6] bot audit — 제외된 트래픽 (90d)...');
  const rows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [
      { name: 'screenResolution' },
      { name: 'operatingSystem' },
      { name: 'deviceCategory' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
    dimensionFilter: BOT_ONLY,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 100,
  }, { applyBotFilter: false });

  const out = rows.map((r) => [
    r.dimensionValues[0].value,
    r.dimensionValues[1].value,
    r.dimensionValues[2].value,
    r.metricValues[0].value,
    parseFloat(r.metricValues[1].value).toFixed(3),
    parseFloat(r.metricValues[2].value).toFixed(1),
  ]);
  writecsv(
    path.join(OUT_DIR, 'bot-excluded.csv'),
    ['screen_resolution', 'operating_system', 'device', 'sessions', 'engagement_rate', 'avg_session_sec'],
    out,
  );

  const excluded = out.reduce((sum, r) => sum + Number(r[3]), 0);
  console.log(`  ⚠ 봇으로 판정해 제외한 세션: ${excluded}`);
}

async function main() {
  console.log('=== GA4 Data API Fetch ===');

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    console.error('ERROR: GA4_PROPERTY_ID 환경변수 누락');
    process.exit(1);
  }
  if (!process.env.GA4_OAUTH_REFRESH_TOKEN) {
    console.error('ERROR: GA4_OAUTH_REFRESH_TOKEN 환경변수 누락');
    console.error('먼저 실행하세요: node --env-file=.env.local scripts/ga4-oauth-setup.mjs');
    process.exit(1);
  }

  console.log(`Property: ${propertyId}`);
  console.log(INCLUDE_BOTS
    ? '봇 필터: OFF (--include-bots) — 원본 그대로'
    : '봇 필터: ON — (direct)/(none) + English 세션 제외');

  const auth = getAuth();
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  await fetchLanding(analyticsdata, propertyId);
  await fetchEvents(analyticsdata, propertyId);
  await fetchSource(analyticsdata, propertyId);
  await fetchDevice(analyticsdata, propertyId);
  await fetchLlmReferrers(analyticsdata, propertyId);
  if (!INCLUDE_BOTS) await fetchBotAudit(analyticsdata, propertyId);

  console.log('\n✓ 완료. docs/ga4-raw/ 확인.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
