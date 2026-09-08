/**
 * 카카오 전환 급락 감시 (2026-08-13~23 사고 재발 방지).
 *
 * `/ko/practice-room`(사이트 최대 전환 페이지)의 카카오 클릭 전환율이 열흘 만에
 * 7.5%→1.1%로 무너졌는데 트래픽은 정상이었고, 원인 불명인 채로 아무 알림도 없었다.
 * CTA가 렌더는 되지만 클릭이 안 되는 유형의 사고(색 토큰 누락과는 다른 층위)는 DB에
 * 흔적이 없어 `checkCalendar`처럼 외부에서 직접 재봐야 한다 — GA4가 유일한 관측 지점이다.
 *
 * 인증·봇 제외 필터는 scripts/ga4-fetch.mjs와 동일하게 이식했다(OAuth refresh token
 * 방식, direct/(none)+English 언어 조합을 봇으로 제외).
 *
 * **활성화 조건**: Vercel Production 환경변수에 아래 4개가 등록되어 있어야 실행된다.
 * 2026-09-08 기준 아직 미등록 — 그동안은 이 검사를 건너뛰고 `skipped`만 남긴다(실패 아님).
 *   - GA4_PROPERTY_ID
 *   - GA4_OAUTH_REFRESH_TOKEN
 *   - GSC_OAUTH_CLIENT_ID
 *   - GSC_OAUTH_CLIENT_SECRET
 */
import { google, analyticsdata_v1beta } from 'googleapis';

import type { HealthIssue } from './healthCheck';

/** 감시 대상 페이지. 카카오 CTA가 있고 트래픽이 충분한 두 상업 페이지. */
const WATCHED_PAGES = ['/ko/practice-room', '/ko/pricing'] as const;

/** 표본 부족 기준 — 최근 3일 조회수가 이보다 적으면 판정을 유보한다. */
const MIN_RECENT_VIEWS = 30;

/** 급락 판정 배수 — 최근 클릭률이 기준선의 이 비율 미만이면 이상. */
const DROP_THRESHOLD_RATIO = 0.4;

// scripts/ga4-fetch.mjs의 BOT_EXCLUSION과 동일한 필터.
const BOT_EXCLUSION = {
  notExpression: {
    andGroup: {
      expressions: [
        {
          filter: {
            fieldName: 'sessionSourceMedium',
            stringFilter: { matchType: 'EXACT' as const, value: '(direct) / (none)' },
          },
        },
        {
          filter: {
            fieldName: 'language',
            stringFilter: { matchType: 'EXACT' as const, value: 'English' },
          },
        },
      ],
    },
  },
};

export interface LeadRateEnv {
  GA4_PROPERTY_ID?: string;
  GA4_OAUTH_REFRESH_TOKEN?: string;
  GSC_OAUTH_CLIENT_ID?: string;
  GSC_OAUTH_CLIENT_SECRET?: string;
}

/** GA4 Data API 클라이언트 — 테스트에서 가짜 구현으로 주입할 수 있도록 인터페이스로 뺀다. */
export interface Ga4Client {
  runReport(
    propertyId: string,
    requestBody: analyticsdata_v1beta.Schema$RunReportRequest,
  ): Promise<analyticsdata_v1beta.Schema$RunReportResponse>;
}

const createGa4Client = (env: LeadRateEnv): Ga4Client => {
  const oauth2 = new google.auth.OAuth2(env.GSC_OAUTH_CLIENT_ID, env.GSC_OAUTH_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: env.GA4_OAUTH_REFRESH_TOKEN });
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: oauth2 });

  return {
    async runReport(propertyId, requestBody) {
      const res = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody,
      });
      return res.data;
    },
  };
};

const dateRange = (daysAgoStart: number, daysAgoEnd: number) => {
  const fmt = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  return { startDate: fmt(daysAgoStart), endDate: fmt(daysAgoEnd) };
};

interface PageStats {
  views: number;
  kakaoClicks: number;
}

/** 지정한 기간의 페이지별 조회수·카카오 클릭수를 한 번의 요청으로 가져온다. */
const fetchPageStats = async (
  client: Ga4Client,
  propertyId: string,
  range: { startDate: string; endDate: string },
): Promise<Map<string, PageStats>> => {
  const stats = new Map<string, PageStats>();
  for (const page of WATCHED_PAGES) stats.set(page, { views: 0, kakaoClicks: 0 });

  // 조회수: screenPageViews (pagePath 차원)
  const viewsRes = await client.runReport(propertyId, {
    dateRanges: [range],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { filter: { fieldName: 'pagePath', inListFilter: { values: [...WATCHED_PAGES] } } },
          BOT_EXCLUSION,
        ],
      },
    },
  });
  for (const row of viewsRes.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value;
    const views = Number(row.metricValues?.[0]?.value ?? '0');
    if (path && stats.has(path)) stats.get(path)!.views = views;
  }

  // 카카오 클릭: lead_click_kakao 이벤트 (pagePath 차원)
  const clicksRes = await client.runReport(propertyId, {
    dateRanges: [range],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          { filter: { fieldName: 'pagePath', inListFilter: { values: [...WATCHED_PAGES] } } },
          { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'lead_click_kakao' } } },
          BOT_EXCLUSION,
        ],
      },
    },
  });
  for (const row of clicksRes.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value;
    const clicks = Number(row.metricValues?.[0]?.value ?? '0');
    if (path && stats.has(path)) stats.get(path)!.kakaoClicks = clicks;
  }

  return stats;
};

export interface LeadRateCheckResult {
  skipped?: string;
  issues: HealthIssue[];
}

/**
 * 카카오 전환율 급락 여부를 확인한다.
 *
 * env 4개가 하나라도 없으면 조용히 건너뛴다(`skipped` 사유 남김 — 실패 취급 금지,
 * 2026-09-08 기준 Vercel Production에 아직 이 env가 없다). GA4 API 호출 자체가
 * 실패하면(자격 만료 등) "점검이 죽은 것"이므로 throw해 healthCheck가 알리게 한다.
 */
export const runLeadRateCheck = async (
  env: LeadRateEnv = process.env as LeadRateEnv,
  clientFactory: (env: LeadRateEnv) => Ga4Client = createGa4Client,
): Promise<LeadRateCheckResult> => {
  const { GA4_PROPERTY_ID, GA4_OAUTH_REFRESH_TOKEN, GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET } = env;
  if (!GA4_PROPERTY_ID || !GA4_OAUTH_REFRESH_TOKEN || !GSC_OAUTH_CLIENT_ID || !GSC_OAUTH_CLIENT_SECRET) {
    return { skipped: 'GA4 env 없음', issues: [] };
  }

  const client = clientFactory(env);

  const [recent, baseline] = await Promise.all([
    // 창 끝을 '어제'로 둔다. GA4 Data API는 당일·전일 데이터가 미완성이라(처리 지연 24~48h)
    // 오늘을 넣으면 최근 3일 표본이 늘 깎여 판정이 흔들린다. 최근 = D-4~D-1, 기준선 = D-32~D-5.
    fetchPageStats(client, GA4_PROPERTY_ID, dateRange(4, 1)),
    fetchPageStats(client, GA4_PROPERTY_ID, dateRange(32, 5)),
  ]);

  const issues: HealthIssue[] = [];

  for (const page of WATCHED_PAGES) {
    const r = recent.get(page)!;
    const b = baseline.get(page)!;

    if (r.views < MIN_RECENT_VIEWS) continue; // 표본 부족 — 판정 유보, 알리지 않음.

    const recentRate = r.kakaoClicks / r.views;
    const baselineRate = b.views > 0 ? b.kakaoClicks / b.views : 0;

    if (baselineRate > 0 && recentRate < baselineRate * DROP_THRESHOLD_RATIO) {
      issues.push({
        severity: 'high',
        title: `${page} 카카오 전환율 급락 (최근 3일)`,
        detail:
          `페이지: ${page}\n` +
          `최근 3일: 클릭 ${r.kakaoClicks} / 조회 ${r.views} (${(recentRate * 100).toFixed(2)}%)\n` +
          `기준선(그 이전 28일): 클릭 ${b.kakaoClicks} / 조회 ${b.views} (${(baselineRate * 100).toFixed(2)}%)\n` +
          '의심 원인: 카카오 CTA 렌더(배경·글자색 등 스타일 누락)·GA4 추적 스니펫 누락·최근 카피 변경 여부를 먼저 확인해 주세요.',
      });
    }
  }

  return { issues };
};
