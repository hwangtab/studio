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
// next.config.mjs 단독 리다이렉트 4종도 합쳐야 한다 — 빠지면 실존 .md(예:
// practice-room-drum1)가 catalog에 남아 매주 NOINDEX_CANDIDATE 노이즈로 집계된다.
// 마스터 정의는 lib/sitemap/routes.js REDIRECTED_SLUGS이며, gscAudit.test.ts가
// 두 집합의 동일성을 CI에서 강제한다(여기 리스트를 고치면 routes.js도 함께).
const NEXT_CONFIG_REDIRECTED_SLUGS = [
  'practice-room-drum1',
  'song-structure1',
  'english-speaking-music-lessons-seoul',
  'chinese-music-lessons-seoul',
];
export const REDIRECTED_SLUGS: ReadonlySet<string> = new Set([
  ...Object.keys(regionRedirectMap as Record<string, string>),
  ...NEXT_CONFIG_REDIRECTED_SLUGS,
]);

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
  // ko 캐노니컬이 실제 noindex(robots 또는 thin 게이트)인지. catalog 빌드 시 확정.
  noindex: boolean;
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

/** 비-story 사이트 라우트(마케팅·guides·release·en 색인 페이지·카테고리 허브 등). */
export interface SiteRouteEntry {
  path: string; // 예: '/ko/pricing', '/en/release-project', '/ko/guides/indie-release-guide'
  clicks: number;
  impressions: number;
  tier: Tier;
}

export interface AuditSnapshot {
  date: string;
  windowDays: number;
  totalRows: number;
  uniqueSlugs: number;
  clusters: Record<ClusterName, ClusterStats>;
  pages: PageEntry[];
  // 구버전 Blob 스냅샷에는 없음 — 소비처는 반드시 optional로 다룰 것(하위호환).
  siteRoutes?: SiteRouteEntry[];
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
  // generate-story-catalog.js가 isStoryThin(slug,'ko')로 산출. 구버전 catalog에는
  // 없을 수 있어 runAudit에서 Boolean()으로 안전 변환.
  noindex?: boolean;
}

export function loadStoryCatalog(): StoryCatalogEntry[] {
  // 빌드 시점 manifest 사용. classify 로직은 generator 측에 위치.
  return (storyCatalog as { entries: StoryCatalogEntry[] }).entries;
}

// 스토리 상세만 매칭. 끝 앵커가 없던 구버전은 '/ko/stories/category/vocal'에서
// 'category'를 슬러그로 오캡처해 카테고리 허브 트래픽이 유령 슬러그로 새고 있었다 —
// 카테고리 허브는 이제 urlToRoutePath 경로로 siteRoutes에 정상 집계된다.
export function urlToSlug(url: string): string | null {
  const m = url.match(/\/[a-z]{2}\/stories\/([^/?#]+)\/?(?:[?#]|$)/);
  return m ? m[1] : null;
}

// 비-story URL → 정규화된 사이트 라우트 경로. 쿼리·해시 제거, 트레일링 슬래시 정규화.
// 외부 도메인·이상 URL은 null(집계 제외).
export function urlToRoutePath(url: string, siteUrl: string): string | null {
  try {
    const u = new URL(url);
    const site = new URL(siteUrl);
    if (u.hostname !== site.hostname) return null;
    let p = u.pathname;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
  } catch {
    return null;
  }
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
}): Promise<{
  rowCount: number;
  slugMetrics: Map<string, { clicks: number; impressions: number }>;
  // 비-story 라우트(마케팅 페이지·guides·release·카테고리 허브·en 색인 페이지).
  // 구버전은 이 행들을 무언 폐기해 주간 리포트가 stories 밖 전 표면에 눈이 멀었다.
  routeMetrics: Map<string, { clicks: number; impressions: number }>;
}> {
  const auth = makeAuth(opts.auth);
  const sc = google.searchconsole({ version: 'v1', auth });

  const end = new Date();
  const start = new Date(end.getTime() - opts.windowDays * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const slugMetrics = new Map<string, { clicks: number; impressions: number }>();
  const routeMetrics = new Map<string, { clicks: number; impressions: number }>();
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
      if (slug) {
        const cur = slugMetrics.get(slug) || { clicks: 0, impressions: 0 };
        cur.clicks += row.clicks || 0;
        cur.impressions += row.impressions || 0;
        slugMetrics.set(slug, cur);
        continue;
      }
      const routePath = urlToRoutePath(url, opts.siteUrl);
      if (!routePath) continue;
      const cur = routeMetrics.get(routePath) || { clicks: 0, impressions: 0 };
      cur.clicks += row.clicks || 0;
      cur.impressions += row.impressions || 0;
      routeMetrics.set(routePath, cur);
    }

    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }

  return { rowCount: totalRows, slugMetrics, routeMetrics };
}

export async function runAudit(opts: {
  siteUrl: string;
  windowDays: number;
  auth: GscAuth;
}): Promise<AuditSnapshot> {
  const catalog = loadStoryCatalog().filter(c => !REDIRECTED_SLUGS.has(c.slug));
  const { rowCount, slugMetrics, routeMetrics } = await fetchGscPageMetrics({
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
      noindex: Boolean(c.noindex),
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

  // 비-story 라우트를 클릭 내림차순 스냅샷으로 — en 색인 3페이지·guides·release tier·
  // 카테고리 허브·마케팅 페이지가 주간 리포트에 합류한다.
  const siteRoutes: SiteRouteEntry[] = [...routeMetrics.entries()]
    .map(([path, m]) => ({
      path,
      clicks: m.clicks,
      impressions: m.impressions,
      tier: computeTier(m.clicks, m.impressions),
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

  return {
    date: new Date().toISOString().slice(0, 10),
    windowDays: opts.windowDays,
    totalRows: rowCount,
    uniqueSlugs: slugMetrics.size,
    clusters,
    pages,
    siteRoutes,
  };
}

function emptyStats(): ClusterStats {
  return { count: 0, clicks: 0, impressions: 0, keep: 0, watch: 0, watchLow: 0, noindexCandidate: 0 };
}

export { PSEO_CLUSTERS };
