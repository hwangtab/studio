#!/usr/bin/env node
// GSC Search Analytics — 213개 programmatic SEO 페이지 + 전체 stories 분석.
// 출력:
//  1. 클러스터별 90일 합계 (clicks, impressions, indexed_count, zero_impression_count)
//  2. Tier 자동 분류 (KEEP / WATCH / NOINDEX_CANDIDATE)
//  3. zero_impression 페이지 목록 CSV (docs/gsc-audit-output.csv)
//
// 사용: node --env-file=.env.local scripts/gsc-pseo-audit.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORIES_DIR = path.join(ROOT, 'content/stories');

const SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:studionol.co.kr';
const SITE_HOST = 'https://studionol.co.kr';

// ---- 1. 클러스터 분류 (filename + frontmatter title 기반) ----
function classifyClusters() {
  const files = fs.readdirSync(STORIES_DIR).filter((f) =>
    f.endsWith('.md') && !/\.(en|zh|es|vi|th|uz)\.md$/.test(f)
  );
  const clusters = {
    'city-ktx-visit': [],
    'seoul-district-studio': [],
    'practice-room-station': [],
    'other': [],
  };
  for (const f of files) {
    const raw = fs.readFileSync(path.join(STORIES_DIR, f), 'utf-8');
    const { data, content } = matter(raw);
    const title = data.title || '';
    const slug = f.replace(/\.md$/, '');
    const entry = { slug, file: f, title, len: content.length };
    if (/^.+에서 서울 녹음실 방문 가이드/.test(title)) clusters['city-ktx-visit'].push(entry);
    else if (/구 .+ 녹음실/.test(title) && /연신내/.test(title)) clusters['seoul-district-studio'].push(entry);
    else if (/음악연습실/.test(title) && /(정거장|월\s*\d+만원)/.test(title)) clusters['practice-room-station'].push(entry);
    else clusters['other'].push(entry);
  }
  return clusters;
}

// ---- 2. GSC 조회 (OAuth2 user auth 우선, 없으면 service account) ----
function makeAuth() {
  const cid = process.env.GSC_OAUTH_CLIENT_ID;
  const csec = process.env.GSC_OAUTH_CLIENT_SECRET;
  const rtok = process.env.GSC_OAUTH_REFRESH_TOKEN;
  if (cid && csec && rtok) {
    const oauth2 = new google.auth.OAuth2(cid, csec);
    oauth2.setCredentials({ refresh_token: rtok });
    return oauth2;
  }
  // service account 폴백 (GSC에 service account 사용자 추가됐을 때만 동작)
  return new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

async function fetchGsc() {
  const auth = makeAuth();
  const sc = google.searchconsole({ version: 'v1', auth });

  const end = new Date();
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const all = [];
  let startRow = 0;
  const rowLimit = 25000;
  while (true) {
    const res = await sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ['page'],
        rowLimit,
        startRow,
        dataState: 'final',
      },
    });
    const rows = res.data.rows || [];
    all.push(...rows);
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }
  return all;
}

// ---- 3. URL → slug 추출 ----
function urlToSlug(url) {
  // /ko/stories/{slug} 또는 /en/stories/{slug} 형식
  const m = url.match(/\/[a-z]{2}\/stories\/([^/?#]+)/);
  return m ? m[1] : null;
}

// ---- 4. 메인 ----
async function main() {
  console.log('Loading clusters from content/stories/...');
  const clusters = classifyClusters();
  const totalPSEO =
    clusters['city-ktx-visit'].length +
    clusters['seoul-district-studio'].length +
    clusters['practice-room-station'].length;
  console.log(`  city-ktx-visit: ${clusters['city-ktx-visit'].length}`);
  console.log(`  seoul-district-studio: ${clusters['seoul-district-studio'].length}`);
  console.log(`  practice-room-station: ${clusters['practice-room-station'].length}`);
  console.log(`  other (non-pSEO stories): ${clusters['other'].length}`);
  console.log(`  total pSEO: ${totalPSEO}`);

  console.log('\nFetching GSC search analytics (90 days)...');
  const rows = await fetchGsc();
  console.log(`  rows returned: ${rows.length}`);

  // slug → aggregated metrics (locale 합산)
  const slugMetrics = new Map();
  for (const row of rows) {
    const url = row.keys[0];
    const slug = urlToSlug(url);
    if (!slug) continue;
    const cur = slugMetrics.get(slug) || { clicks: 0, impressions: 0, urls: [] };
    cur.clicks += row.clicks;
    cur.impressions += row.impressions;
    cur.urls.push({ url, clicks: row.clicks, impressions: row.impressions });
    slugMetrics.set(slug, cur);
  }
  console.log(`  unique story slugs with GSC data: ${slugMetrics.size}`);

  // ---- 5. 클러스터별 집계 ----
  console.log('\n=== Cluster aggregates (90 days) ===');
  const csvLines = ['cluster,slug,title,content_len,clicks,impressions,tier'];
  const summary = {};
  for (const [name, list] of Object.entries(clusters)) {
    let clicks = 0, impressions = 0, hasData = 0, zeroImpression = 0;
    for (const entry of list) {
      const m = slugMetrics.get(entry.slug);
      const c = m ? m.clicks : 0;
      const i = m ? m.impressions : 0;
      clicks += c;
      impressions += i;
      if (m) hasData += 1;
      if (i === 0) zeroImpression += 1;

      let tier;
      if (c >= 1) tier = 'KEEP';
      else if (i >= 10) tier = 'WATCH';
      else if (i >= 1) tier = 'WATCH_LOW';
      else tier = 'NOINDEX_CANDIDATE';

      csvLines.push([name, entry.slug, `"${entry.title.replace(/"/g, '""')}"`, entry.len, c, i, tier].join(','));
    }
    const n = list.length;
    const indexedRate = n > 0 ? ((n - zeroImpression) / n * 100).toFixed(1) : '0.0';
    summary[name] = { n, clicks, impressions, hasData, zeroImpression, indexedRate };
    console.log(`[${name}]`);
    console.log(`  count: ${n}`);
    console.log(`  total clicks: ${clicks}`);
    console.log(`  total impressions: ${impressions}`);
    console.log(`  pages with any data: ${hasData}`);
    console.log(`  zero-impression pages: ${zeroImpression} (${(zeroImpression/n*100).toFixed(1)}% of cluster)`);
    console.log(`  pages with ≥1 impression: ${n - zeroImpression} (${indexedRate}%)`);
  }

  // ---- 6. Tier 권장 요약 ----
  console.log('\n=== Tier recommendations (programmatic clusters only) ===');
  let totalNoindexCandidate = 0;
  for (const name of ['city-ktx-visit', 'seoul-district-studio', 'practice-room-station']) {
    const list = clusters[name];
    let keep = 0, watch = 0, watchLow = 0, noindex = 0;
    for (const e of list) {
      const m = slugMetrics.get(e.slug);
      const c = m ? m.clicks : 0;
      const i = m ? m.impressions : 0;
      if (c >= 1) keep++;
      else if (i >= 10) watch++;
      else if (i >= 1) watchLow++;
      else noindex++;
    }
    totalNoindexCandidate += noindex;
    console.log(`[${name}] KEEP=${keep}  WATCH=${watch}  WATCH_LOW=${watchLow}  NOINDEX_CANDIDATE=${noindex}`);
  }
  console.log(`\nTotal NOINDEX_CANDIDATE across pSEO: ${totalNoindexCandidate} / ${totalPSEO}`);

  // ---- 7. CSV 출력 ----
  const outDir = path.join(ROOT, 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, 'gsc-audit-output.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`\nCSV saved: ${path.relative(ROOT, csvPath)}`);
  console.log('Tier 정의:');
  console.log('  KEEP             — 90일 클릭 ≥1');
  console.log('  WATCH            — 클릭 0, 임프레션 ≥10 (랭킹 진입 중)');
  console.log('  WATCH_LOW        — 클릭 0, 임프레션 1-9 (관찰)');
  console.log('  NOINDEX_CANDIDATE — 클릭 0, 임프레션 0 (90일간 검색 노출 0)');
}

main().catch((err) => {
  console.error('Error:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
