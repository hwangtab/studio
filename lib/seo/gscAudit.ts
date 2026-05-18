// GSC pSEO audit 핵심 로직. scripts/gsc-pseo-audit.mjs와 cron endpoint 양쪽이 공유.
//
// Tier 정의:
//   KEEP             — 90일 클릭 ≥1
//   WATCH            — 클릭 0, 임프레션 ≥10
//   WATCH_LOW        — 클릭 0, 임프레션 1-9
//   NOINDEX_CANDIDATE — 클릭 0, 임프레션 0

import { google } from 'googleapis';
// 빌드 타임 생성된 story catalog manifest (scripts/generate-story-catalog.js).
// 1,569개 .md 런타임 fs 읽기 회피 - Vercel Function 번들에 자동 포함됨.
import storyCatalog from '../story-catalog.json';
import regionRedirectMap from '../regionRedirectMap.json';

// 308 redirect 처리된 슬러그는 GSC 노출·클릭 0이 정상이므로 audit 대상에서 제외.
const REDIRECTED_SLUGS: ReadonlySet<string> = new Set(Object.keys(regionRedirectMap as Record<string, string>));

export type ClusterName = 'city-ktx-visit' | 'seoul-district-studio' | 'practice-room-station' | 'other';
export type Tier = 'KEEP' | 'WATCH' | 'WATCH_LOW' | 'NOINDEX_CANDIDATE';

export interface PageEntry {
  slug: string;
  title: string;
  contentLen: number;
  cluster: ClusterName;
  clicks: number;
  impressions: number;
  tier: Tier;
}

export interface ClusterStats {
  count: number;
  clicks: number;
  impressions: number;
  keep: number;
  watch: number;
  watchLow: number;
  noindexCandidate: number;
}

export interface AuditSnapshot {
  date: string;
  windowDays: number;
  totalRows: number;
  uniqueSlugs: number;
  clusters: Record<ClusterName, ClusterStats>;
  pages: PageEntry[];
}

const PSEO_CLUSTERS: ReadonlySet<ClusterName> = new Set([
  'city-ktx-visit',
  'seoul-district-studio',
  'practice-room-station',
]);

function computeTier(clicks: number, impressions: number): Tier {
  if (clicks >= 1) return 'KEEP';
  if (impressions >= 10) return 'WATCH';
  if (impressions >= 1) return 'WATCH_LOW';
  return 'NOINDEX_CANDIDATE';
}

export interface StoryCatalogEntry {
  slug: string;
  title: string;
  contentLen: number;
  cluster: ClusterName;
}

export function loadStoryCatalog(): StoryCatalogEntry[] {
  // 빌드 시점 manifest 사용. classify 로직은 generator 측에 위치.
  return (storyCatalog as { entries: StoryCatalogEntry[] }).entries;
}

function urlToSlug(url: string): string | null {
  const m = url.match(/\/[a-z]{2}\/stories\/([^/?#]+)/);
  return m ? m[1] : null;
}

interface GscAuth {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function makeAuth(creds: GscAuth) {
  const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2.setCredentials({ refresh_token: creds.refreshToken });
  return oauth2;
}

export async function fetchGscPageMetrics(opts: {
  siteUrl: string;
  windowDays: number;
  auth: GscAuth;
}): Promise<{ rowCount: number; slugMetrics: Map<string, { clicks: number; impressions: number }> }> {
  const auth = makeAuth(opts.auth);
  const sc = google.searchconsole({ version: 'v1', auth });

  const end = new Date();
  const start = new Date(end.getTime() - opts.windowDays * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const slugMetrics = new Map<string, { clicks: number; impressions: number }>();
  let startRow = 0;
  const rowLimit = 25000;
  let totalRows = 0;

  while (true) {
    const res = await sc.searchanalytics.query({
      siteUrl: opts.siteUrl,
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
      const url = (row.keys || [])[0];
      if (!url) continue;
      const slug = urlToSlug(url);
      if (!slug) continue;
      const cur = slugMetrics.get(slug) || { clicks: 0, impressions: 0 };
      cur.clicks += row.clicks || 0;
      cur.impressions += row.impressions || 0;
      slugMetrics.set(slug, cur);
    }

    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }

  return { rowCount: totalRows, slugMetrics };
}

export async function runAudit(opts: {
  siteUrl: string;
  windowDays: number;
  auth: GscAuth;
}): Promise<AuditSnapshot> {
  const catalog = loadStoryCatalog().filter(c => !REDIRECTED_SLUGS.has(c.slug));
  const { rowCount, slugMetrics } = await fetchGscPageMetrics({
    siteUrl: opts.siteUrl,
    windowDays: opts.windowDays,
    auth: opts.auth,
  });

  const pages: PageEntry[] = catalog.map((c) => {
    const m = slugMetrics.get(c.slug);
    const clicks = m ? m.clicks : 0;
    const impressions = m ? m.impressions : 0;
    return {
      slug: c.slug,
      title: c.title,
      contentLen: c.contentLen,
      cluster: c.cluster,
      clicks,
      impressions,
      tier: computeTier(clicks, impressions),
    };
  });

  const clusters: Record<ClusterName, ClusterStats> = {
    'city-ktx-visit': emptyStats(),
    'seoul-district-studio': emptyStats(),
    'practice-room-station': emptyStats(),
    'other': emptyStats(),
  };
  for (const p of pages) {
    const s = clusters[p.cluster];
    s.count += 1;
    s.clicks += p.clicks;
    s.impressions += p.impressions;
    if (p.tier === 'KEEP') s.keep += 1;
    else if (p.tier === 'WATCH') s.watch += 1;
    else if (p.tier === 'WATCH_LOW') s.watchLow += 1;
    else s.noindexCandidate += 1;
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    windowDays: opts.windowDays,
    totalRows: rowCount,
    uniqueSlugs: slugMetrics.size,
    clusters,
    pages,
  };
}

function emptyStats(): ClusterStats {
  return { count: 0, clicks: 0, impressions: 0, keep: 0, watch: 0, watchLow: 0, noindexCandidate: 0 };
}

export { PSEO_CLUSTERS };
