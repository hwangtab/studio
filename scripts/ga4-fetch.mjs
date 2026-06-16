#!/usr/bin/env node
// GA4 Data API raw fetch — 진단용 1회성 스크립트
// 사용: node --env-file=.env.local scripts/ga4-fetch.mjs
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

function writecsv(outPath, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map((v, i) => {
      const h = headers[i];
      return (h === 'landing_page' || h === 'page_path' || h === 'event_name' || h === 'source' || h === 'medium' || h === 'device' || h === 'country')
        ? escapeCsv(v)
        : v;
    }).join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`  → ${path.relative(ROOT, outPath)} (${rows.length} rows)`);
}

async function runReport(analyticsdata, propertyId, requestBody) {
  const res = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody,
  });
  return res.data.rows || [];
}

// Report 1: 랜딩 페이지별 세션·이탈률·참여 시간
async function fetchLanding(analyticsdata, propertyId) {
  console.log('\n[1/4] landing page metrics (90d)...');
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
  console.log('\n[2/4] lead events by page (90d)...');
  const rows = await runReport(analyticsdata, propertyId, {
    dateRanges: [dateRange(90)],
    dimensions: [{ name: 'eventName' }, { name: 'pagePath' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: [
            ...ALL_LEAD_EVENT_NAMES,
          ],
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
  console.log('\n[5/5] LLM referrers × landing page (90d)...');
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
  console.log('\n[3/4] source/medium sessions + lead events (90d)...');
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
  console.log('\n[4/4] device × country (90d)...');
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

  const auth = getAuth();
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  await fetchLanding(analyticsdata, propertyId);
  await fetchEvents(analyticsdata, propertyId);
  await fetchSource(analyticsdata, propertyId);
  await fetchDevice(analyticsdata, propertyId);
  await fetchLlmReferrers(analyticsdata, propertyId);

  console.log('\n✓ 완료. docs/ga4-raw/ 확인.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
