/**
 * 제작 계약의 고객용 주소. 경로를 `/contracts/` 아래에 둔 것은 의도다 — 연습실 계약 경로에 걸린 보호가
 * 그대로 적용된다: no-store 헤더(next.config.mjs), 측정 스크립트 제외(lib/analytics/privatePaths.ts),
 * 사이트맵·robots 제외(next-sitemap.config.js). 새 경로를 다른 곳에 만들면 그 네 군데를 모두 고쳐야 한다.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';

export const productionSignPath = (contractId: string, token: string, locale = 'ko'): string =>
  `/${locale}/contracts/production/${contractId}/sign?token=${encodeURIComponent(token)}`;

export const productionCompletePath = (contractId: string, token: string, locale = 'ko'): string =>
  `/${locale}/contracts/production/${contractId}/complete?token=${encodeURIComponent(token)}`;

export const buildProductionSignUrl = (contractId: string, token: string): string =>
  `${SITE_URL}${productionSignPath(contractId, token)}`;

export const buildProductionCompleteUrl = (contractId: string, token: string): string =>
  `${SITE_URL}${productionCompletePath(contractId, token)}`;

export const productionAdminUrl = (contractId: string): string =>
  `${SITE_URL}/admin/contracts/production/${contractId}`;

/** 시도 제한 키 접두사. 연습실 계약 id와 같은 저장소(rate_limits)를 쓰므로 이름을 나눈다. */
export const productionRateLimitKey = (contractId: string): string => `production:${contractId}`;
