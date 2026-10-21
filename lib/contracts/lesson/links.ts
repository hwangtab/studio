/**
 * 수강 계약의 고객용 주소. 경로를 `/contracts/` 아래에 둔 것은 의도다 — 연습실·제작 계약 경로에 걸린 보호가 그대로 적용된다:
 * no-store 헤더(next.config.mjs), 측정 스크립트 제외(lib/analytics/privatePaths.ts), 사이트맵·robots 제외(next-sitemap.config.js).
 * 새 경로를 다른 곳에 만들면 그 네 군데를 모두 고쳐야 한다.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';

export const lessonSignPath = (contractId: string, token: string, locale = 'ko'): string =>
  `/${locale}/contracts/lesson/${contractId}/sign?token=${encodeURIComponent(token)}`;
export const lessonCompletePath = (contractId: string, token: string, locale = 'ko'): string =>
  `/${locale}/contracts/lesson/${contractId}/complete?token=${encodeURIComponent(token)}`;
export const buildLessonSignUrl = (contractId: string, token: string): string => `${SITE_URL}${lessonSignPath(contractId, token)}`;
export const buildLessonCompleteUrl = (contractId: string, token: string): string => `${SITE_URL}${lessonCompletePath(contractId, token)}`;
export const lessonAdminUrl = (enrollmentId: string): string => `${SITE_URL}/admin/lessons/${enrollmentId}`;

/** 서명 화면의 본인 확인 시도 제한 키 — 다른 계약 종류와 같은 저장소(rate_limits)를 쓰므로 이름을 나눈다. */
export const lessonRateLimitKey = (contractId: string): string => `lesson:${contractId}`;
