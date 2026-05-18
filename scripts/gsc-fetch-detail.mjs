#!/usr/bin/env node
// GSC 쿼리×페이지×CTR×position 차원 raw fetch — 진단용 1회성 스크립트
// 사용: node --env-file=.env.local scripts/gsc-fetch-detail.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:studionol.co.kr';
const OUT_DIR = path.join(ROOT, 'docs', 'gsc-raw');

function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GSC_OAUTH_CLIENT_ID,
    process.env.GSC_OAUTH_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GSC_OAUTH_REFRESH_TOKEN });
  return oauth2;
}

function dateRange(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function slugFromUrl(url) {
  const m = url.match(/\/[a-z]{2}\/stories\/([^/?#]+)/);
  return m ? m[1] : null;
}

function escapeCsv(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

async function fetchAll(sc, requestBody) {
  const rows = [];
  const rowLimit = 25000;
  let startRow = 0;
  while (true) {
    const res = await sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { ...requestBody, rowLimit, startRow, dataState: 'final' },
    });
    const batch = res.data.rows || [];
    rows.push(...batch);
    process.stdout.write(`\r  fetched ${rows.length} rows...`);
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }
  process.stdout.write('\n');
  return rows;
}

// Query 1: page × query — 카니벌라이제이션·검색어 클러스터 분석
async function fetchPageQuery(sc) {
  console.log('\n[1/3] page×query (90d)...');
  const rows = await fetchAll(sc, {
    ...dateRange(90),
    dimensions: ['page', 'query'],
  });

  const lines = ['page,slug,query,clicks,impressions,ctr,position'];
  for (const row of rows) {
    const [page, query] = row.keys;
    lines.push([
      escapeCsv(page),
      slugFromUrl(page) || '',
      escapeCsv(query),
      row.clicks,
      row.impressions,
      (row.ctr * 100).toFixed(2),
      row.position.toFixed(1),
    ].join(','));
  }

  const out = path.join(OUT_DIR, 'page-query.csv');
  fs.writeFileSync(out, lines.join('\n'), 'utf-8');
  console.log(`  → ${path.relative(ROOT, out)} (${rows.length} rows)`);
}

// Query 2: page 전체 집계 → quick-win(10-20위)과 CTR 저조 페이지 분리 출력
async function fetchPageAll(sc) {
  console.log('\n[2/3] page metrics (90d)...');
  const rows = await fetchAll(sc, {
    ...dateRange(90),
    dimensions: ['page'],
  });

  // 전체 페이지 CSV
  const allLines = ['page,slug,clicks,impressions,ctr,position'];
  for (const row of rows) {
    const [page] = row.keys;
    allLines.push([
      escapeCsv(page),
      slugFromUrl(page) || '',
      row.clicks,
      row.impressions,
      (row.ctr * 100).toFixed(2),
      row.position.toFixed(1),
    ].join(','));
  }
  const outAll = path.join(OUT_DIR, 'page-all.csv');
  fs.writeFileSync(outAll, allLines.join('\n'), 'utf-8');
  console.log(`  → ${path.relative(ROOT, outAll)} (${rows.length} rows)`);

  // quick-win: position 10~20, impressions >= 50
  const quickWin = rows
    .filter((r) => r.position >= 10 && r.position <= 20 && r.impressions >= 50)
    .sort((a, b) => a.position - b.position);

  const qwLines = ['page,slug,clicks,impressions,ctr,position'];
  for (const row of quickWin) {
    const [page] = row.keys;
    qwLines.push([
      escapeCsv(page),
      slugFromUrl(page) || '',
      row.clicks,
      row.impressions,
      (row.ctr * 100).toFixed(2),
      row.position.toFixed(1),
    ].join(','));
  }
  const outQw = path.join(OUT_DIR, 'quick-win.csv');
  fs.writeFileSync(outQw, qwLines.join('\n'), 'utf-8');
  console.log(`  → ${path.relative(ROOT, outQw)} (${quickWin.length} pages, pos 10-20, imp≥50)`);
}

// Query 3: 일별 추세 (28d) — 전체 사이트 클릭·노출 추이
async function fetchTrend(sc) {
  console.log('\n[3/3] daily trend (28d)...');
  const rows = await fetchAll(sc, {
    ...dateRange(28),
    dimensions: ['date'],
  });

  const lines = ['date,clicks,impressions,ctr,position'];
  for (const row of rows) {
    const [date] = row.keys;
    lines.push([
      date,
      row.clicks,
      row.impressions,
      (row.ctr * 100).toFixed(2),
      row.position.toFixed(1),
    ].join(','));
  }

  const out = path.join(OUT_DIR, 'trend.csv');
  fs.writeFileSync(out, lines.join('\n'), 'utf-8');
  console.log(`  → ${path.relative(ROOT, out)} (${rows.length} days)`);
}

async function main() {
  console.log('=== GSC Detail Fetch ===');
  console.log(`Site: ${SITE_URL}`);

  if (!process.env.GSC_OAUTH_CLIENT_ID || !process.env.GSC_OAUTH_REFRESH_TOKEN) {
    console.error('ERROR: GSC 환경변수 누락. .env.local에 GSC_OAUTH_CLIENT_ID / GSC_OAUTH_REFRESH_TOKEN 필요');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const auth = getAuth();
  const sc = google.searchconsole({ version: 'v1', auth });

  await fetchPageQuery(sc);
  await fetchPageAll(sc);
  await fetchTrend(sc);

  console.log('\n✓ 완료. docs/gsc-raw/ 확인.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
