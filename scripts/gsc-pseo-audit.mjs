#!/usr/bin/env node
// 로컬 수동 실행용 — lib/seo/gscAudit.ts의 runAudit과 동일 로직을 mjs에서 호출.
// CSV(docs/gsc-audit-output.csv) + 콘솔 요약 출력.
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

const PSEO_CLUSTERS = new Set(['city-ktx-visit', 'seoul-district-studio', 'practice-room-station']);

function classifyCluster(title) {
  if (/^.+에서 서울 녹음실 방문 가이드/.test(title)) return 'city-ktx-visit';
  if (/구 .+ 녹음실/.test(title) && /연신내/.test(title)) return 'seoul-district-studio';
  if (/음악연습실/.test(title) && /(정거장|월\s*\d+만원)/.test(title)) return 'practice-room-station';
  return 'other';
}

function computeTier(clicks, impressions) {
  if (clicks >= 1) return 'KEEP';
  if (impressions >= 10) return 'WATCH';
  if (impressions >= 1) return 'WATCH_LOW';
  return 'NOINDEX_CANDIDATE';
}

function urlToSlug(url) {
  const m = url.match(/\/[a-z]{2}\/stories\/([^/?#]+)/);
  return m ? m[1] : null;
}

function loadCatalog() {
  const files = fs.readdirSync(STORIES_DIR).filter((f) =>
    f.endsWith('.md') && !/\.(en|zh|es|vi|th|uz)\.md$/.test(f)
  );
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(STORIES_DIR, f), 'utf-8');
    const { data, content } = matter(raw);
    const title = data.title || '';
    return {
      slug: f.replace(/\.md$/, ''),
      title,
      contentLen: content.length,
      cluster: classifyCluster(title),
    };
  });
}

async function fetchGsc() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GSC_OAUTH_CLIENT_ID,
    process.env.GSC_OAUTH_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GSC_OAUTH_REFRESH_TOKEN });
  const sc = google.searchconsole({ version: 'v1', auth: oauth2 });

  const end = new Date();
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const slugMetrics = new Map();
  let startRow = 0;
  const rowLimit = 25000;
  let totalRows = 0;

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
    totalRows += rows.length;
    for (const row of rows) {
      const url = row.keys[0];
      const slug = urlToSlug(url);
      if (!slug) continue;
      const cur = slugMetrics.get(slug) || { clicks: 0, impressions: 0 };
      cur.clicks += row.clicks;
      cur.impressions += row.impressions;
      slugMetrics.set(slug, cur);
    }
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }
  return { totalRows, slugMetrics };
}

async function main() {
  console.log('Loading clusters from content/stories/...');
  const catalog = loadCatalog();
  const clusterCount = catalog.reduce((acc, c) => {
    acc[c.cluster] = (acc[c.cluster] || 0) + 1;
    return acc;
  }, {});
  for (const [k, v] of Object.entries(clusterCount)) console.log(`  ${k}: ${v}`);

  console.log('\nFetching GSC search analytics (90 days)...');
  const { totalRows, slugMetrics } = await fetchGsc();
  console.log(`  rows returned: ${totalRows}`);
  console.log(`  unique story slugs with GSC data: ${slugMetrics.size}`);

  const csvLines = ['cluster,slug,title,content_len,clicks,impressions,tier'];
  const summary = {};
  for (const c of catalog) {
    const m = slugMetrics.get(c.slug);
    const clicks = m ? m.clicks : 0;
    const impressions = m ? m.impressions : 0;
    const tier = computeTier(clicks, impressions);
    csvLines.push([c.cluster, c.slug, `"${c.title.replace(/"/g, '""')}"`, c.contentLen, clicks, impressions, tier].join(','));
    const s = summary[c.cluster] = summary[c.cluster] || { count: 0, clicks: 0, impressions: 0, keep: 0, watch: 0, watchLow: 0, noindex: 0 };
    s.count++;
    s.clicks += clicks;
    s.impressions += impressions;
    if (tier === 'KEEP') s.keep++;
    else if (tier === 'WATCH') s.watch++;
    else if (tier === 'WATCH_LOW') s.watchLow++;
    else s.noindex++;
  }

  console.log('\n=== Cluster aggregates ===');
  for (const [k, s] of Object.entries(summary)) {
    console.log(`[${k}] n=${s.count} clicks=${s.clicks} imp=${s.impressions} KEEP=${s.keep} WATCH=${s.watch} WATCH_LOW=${s.watchLow} NOINDEX=${s.noindex}`);
  }

  const outDir = path.join(ROOT, 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, 'gsc-audit-output.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`\nCSV saved: ${path.relative(ROOT, csvPath)}`);
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
