#!/usr/bin/env node
// GA4 Data API raw fetch — 진단용 1회성 스크립트
// 사용: node --env-file=.env.local scripts/ga4-fetch.mjs
//
// 선결 조건:
//   1. GCP Console → service account 생성 → JSON key 다운로드
//   2. GA4 Admin → Property Access → 서비스 계정 이메일 Viewer 추가
//   3. .env.local에 GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_KEY (JSON 파일 경로 또는 base64 문자열)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'ga4-raw');

function getClient() {
  const keyEnv = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!keyEnv) throw new Error('GA4_SERVICE_ACCOUNT_KEY 환경변수 누락');

  let credentials;
  if (keyEnv.startsWith('{')) {
    // 인라인 JSON 문자열
    credentials = JSON.parse(keyEnv);
  } else if (keyEnv.endsWith('.json') || fs.existsSync(keyEnv)) {
    // 파일 경로
    credentials = JSON.parse(fs.readFileSync(keyEnv, 'utf-8'));
  } else {
    // base64
    credentials = JSON.parse(Buffer.from(keyEnv, 'base64').toString('utf-8'));
  }

  return new BetaAnalyticsDataClient({ credentials });
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
    lines.push(headers.map((_, i) => row[i]).join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`  → ${path.relative(ROOT, outPath)} (${rows.length} rows)`);
}

// Report 1: 랜딩 페이지별 세션·이탈률·참여 시간
async function fetchLanding(client, propertyId) {
  console.log('\n[1/4] landing page metrics (90d)...');
  const { startDate, endDate } = dateRange(90);
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
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

  const rows = (response.rows || []).map((r) => [
    escapeCsv(r.dimensionValues[0].value),
    r.metricValues[0].value,
    parseFloat(r.metricValues[1].value).toFixed(3),
    parseFloat(r.metricValues[2].value).toFixed(1),
    r.metricValues[3].value,
  ]);
  writecsv(
    path.join(OUT_DIR, 'landing.csv'),
    ['landing_page', 'sessions', 'bounce_rate', 'avg_session_sec', 'engaged_sessions'],
    rows,
  );
}

// Report 2: 리드 이벤트(카카오·전화·폼 제출) — 페이지별
async function fetchEvents(client, propertyId) {
  console.log('\n[2/4] lead events by page (90d)...');
  const { startDate, endDate } = dateRange(90);
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'eventName' }, { name: 'pagePath' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: [
            'lead_click_kakao',
            'lead_click_phone',
            'lead_submit_success',
            'lead_form_start',
            'lead_form_abandon',
          ],
        },
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 500,
  });

  const rows = (response.rows || []).map((r) => [
    r.dimensionValues[0].value,
    escapeCsv(r.dimensionValues[1].value),
    r.metricValues[0].value,
  ]);
  writecsv(
    path.join(OUT_DIR, 'events.csv'),
    ['event_name', 'page_path', 'event_count'],
    rows,
  );
}

// Report 3: 소스·매체별 세션
async function fetchSource(client, propertyId) {
  console.log('\n[3/4] source/medium sessions (90d)...');
  const { startDate, endDate } = dateRange(90);
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'bounceRate' }, { name: 'conversions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 100,
  });

  const rows = (response.rows || []).map((r) => [
    r.dimensionValues[0].value,
    r.dimensionValues[1].value,
    r.metricValues[0].value,
    parseFloat(r.metricValues[1].value).toFixed(3),
    r.metricValues[2].value,
  ]);
  writecsv(
    path.join(OUT_DIR, 'source.csv'),
    ['source', 'medium', 'sessions', 'bounce_rate', 'conversions'],
    rows,
  );
}

// Report 4: 디바이스·국가 분포
async function fetchDevice(client, propertyId) {
  console.log('\n[4/4] device × country (90d)...');
  const { startDate, endDate } = dateRange(90);
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'deviceCategory' }, { name: 'country' }],
    metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 50,
  });

  const rows = (response.rows || []).map((r) => [
    r.dimensionValues[0].value,
    r.dimensionValues[1].value,
    r.metricValues[0].value,
    parseFloat(r.metricValues[1].value).toFixed(3),
  ]);
  writecsv(
    path.join(OUT_DIR, 'device.csv'),
    ['device', 'country', 'sessions', 'bounce_rate'],
    rows,
  );
}

async function main() {
  console.log('=== GA4 Data API Fetch ===');

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    console.error('ERROR: GA4_PROPERTY_ID 환경변수 누락. .env.local에 추가 필요');
    process.exit(1);
  }
  console.log(`Property: ${propertyId}`);

  let client;
  try {
    client = getClient();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    console.error('GA4_SERVICE_ACCOUNT_KEY 환경변수를 확인하세요.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  await fetchLanding(client, propertyId);
  await fetchEvents(client, propertyId);
  await fetchSource(client, propertyId);
  await fetchDevice(client, propertyId);

  console.log('\n✓ 완료. docs/ga4-raw/ 확인.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
