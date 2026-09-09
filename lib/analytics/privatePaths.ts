/**
 * 측정 스크립트(GTM·Vercel Analytics)를 아예 mount하지 않을 경로.
 *
 * 이 페이지들의 URL에는 관리 토큰(`?token=`)이나 토스 paymentKey가 실린다. GA4는
 * `page_location`에 쿼리스트링을 통째로 담아 보내므로, 그대로 두면 후원·예약 취소 권한이
 * 있는 비밀값이 제3자 분석 서비스에 영구 보관된다. 계약서 서명 링크도 같다.
 *
 * 쿼리에서 파라미터를 지우는 대신 mount 자체를 막는다 — 지우는 방식은 스크립트를 새로
 * 붙일 때마다 다시 새기 때문이다.
 */
const PRIVATE_PATH_PATTERN =
  /^\/(ko|en|zh|es|vi|th|uz)\/(funding\/(manage|deposit|success)|booking\/(manage|success)|contracts)\b/;

/** `router.asPath`처럼 쿼리·해시가 붙어 있어도 된다 — 경로 부분만 본다. */
export const isPrivateAnalyticsPath = (pathOrUrl: string): boolean => {
  const path = (pathOrUrl || '').split('#')[0].split('?')[0];
  return PRIVATE_PATH_PATTERN.test(path);
};
