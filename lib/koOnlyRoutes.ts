/**
 * ko 전용 SSG 라우트의 최상위 세그먼트 — getStaticPaths가 ko 하나만 등록하고
 * fallback:false라, 다른 로케일로는 정적 파일 자체가 없어 404가 난다(2026-09-14 적발).
 *
 * LanguageSwitcher가 이 목록에 있는 경로에서는 로케일 세그먼트만 치환한 링크를
 * 만들지 않고 해당 로케일 홈으로 탈출시킨다 — isRoutePatternPath 예외와 같은 자리,
 * 같은 방식(components/LanguageSwitcher.tsx).
 *
 * 정본은 각 페이지의 getStaticPaths다. 이 배열이 실제 페이지 구현과 갈리지 않도록
 * lib/koOnlyRoutes.test.ts가 각 세그먼트의 페이지 소스를 읽어 getStaticPaths가
 * ko(또는 defaultLocale) 하나만 등록하고 fallback:false인지 대조한다.
 */
export const KO_ONLY_ROUTE_SEGMENTS = ['artists', 'funding'] as const;

export type KoOnlyRouteSegment = (typeof KO_ONLY_ROUTE_SEGMENTS)[number];

/** 로케일 세그먼트를 뺀 경로(예: '/artists/some-slug')가 ko 전용 라우트인지 판정한다. */
export const isKoOnlyRoutePath = (pathWithoutLocale: string): boolean => {
  const firstSegment = pathWithoutLocale.split('/').filter(Boolean)[0];
  return (KO_ONLY_ROUTE_SEGMENTS as readonly string[]).includes(firstSegment ?? '');
};
