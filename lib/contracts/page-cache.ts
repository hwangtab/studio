import type { ServerResponse } from 'http';

/**
 * 계약 페이지 응답이 공유 캐시에 남지 않게 한다.
 *
 * next.config.mjs의 `/:locale(ko|en|zh|es|vi|th|uz)/:path*` 규칙이
 * `public, s-maxage=3600, stale-while-revalidate=86400`을 붙이는데,
 * 이 패턴은 `/ko/contracts/{id}/sign`·`/complete`까지 그대로 매칭한다.
 *
 * Next는 config 헤더를 렌더 이전에 res에 세팅하고, 페이지 핸들러는
 * Cache-Control이 아직 없을 때만 SSR 기본값 no-store를 붙인다.
 * 즉 아무것도 하지 않으면 계약 본문(이름·호실·기간·금액·연락처)이
 * 공용 프록시와 Vercel Edge에 최대 1시간 + SWR 24시간 보관된다.
 * 재발송·취소로 링크를 무효화해도 캐시 수명 동안 옛 계약이 계속 서빙된다.
 *
 * getServerSideProps 맨 앞에서 부를 것 — notFound·redirect로 빠지는 경로까지
 * 덮어야 하기 때문이다.
 */
export const denyContractPageCaching = (res: ServerResponse): void => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
};
