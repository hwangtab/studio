/**
 * 측정 스크립트(GTM·Vercel Analytics)를 아예 mount하지 않을 경로.
 *
 * 이 페이지들의 URL에는 관리 토큰(`?token=`)이나 토스 paymentKey·orderId가 실린다. GA4는
 * `page_location`에 쿼리스트링을 통째로 담아 보내므로, 그대로 두면 후원·예약 취소 권한이
 * 있는 비밀값이 제3자 분석 서비스에 영구 보관된다. 계약서 서명 링크도 같다.
 *
 * 쿼리에서 파라미터를 지우는 대신 mount 자체를 막는다 — 지우는 방식은 스크립트를 새로
 * 붙일 때마다 다시 새기 때문이다.
 *
 * mount 게이팅은 `router.asPath` 기준이라 **이 페이지들에서 나가는 링크가 클라이언트
 * 전환이면 안 된다.** next/link로 공개 페이지에 갔다가 뒤로가기를 누르면, 그 사이 mount된
 * gtag가 살아 있는 채로 토큰이 실린 URL에 되돌아와 page_view를 보낸다. 그래서 private
 * 페이지의 이탈 링크는 전부 문서 이동(`<a href>`)으로 둔다 — PledgeWizard가 depositUrl을
 * `window.location.assign`으로 여는 것과 같은 이유다.
 */

/** 정규식(런타임 판정)과 next.config.mjs의 no-store `source`를 함께 만드는 한 벌의 정의. */
const PRIVATE_ROUTE_BODIES: ReadonlyArray<readonly [body: string, hasSubPath: boolean]> = [
  ['contracts', true],
  // fail에는 토스가 orderId(=주문번호)를 붙인다. 예전엔 success만 제외해 놓아서
  // 결제 실패 페이지의 주문번호가 상시 측정에 적재됐다.
  ['funding/(success|fail)', false],
  ['funding/(deposit|manage)', true],
  ['booking/(success|fail)', false],
  ['booking/manage', true],
];

const LOCALE_GROUP = '(ko|en|zh|es|vi|th|uz)';

const PRIVATE_PATH_PATTERN = new RegExp(
  `^/${LOCALE_GROUP}/(${PRIVATE_ROUTE_BODIES.map(([body]) => body).join('|')})\\b`,
);

/**
 * next.config.mjs `headers()`가 `private, no-store`로 내려야 하는 경로들. 측정 제외 목록과
 * 갈라지지 않도록 같은 정의에서 파생시킨다 — `tests/config/noStoreHeaders.test.ts`가 실제
 * 설정과 대조한다.
 *
 * no-store 쪽에는 여기 없는 `/funding/:slug/pledge`가 하나 더 있다. 입력 전 폼이라 URL에
 * 비밀값이 없어 측정해도 되지만 응답 본문은 공유 캐시에 얹히면 안 된다 — 목적이 다른
 * 의도적 예외라 측정 제외 목록에는 넣지 않는다.
 */
export const PRIVATE_NO_STORE_SOURCES: readonly string[] = PRIVATE_ROUTE_BODIES.map(
  ([body, hasSubPath]) => `/:locale${LOCALE_GROUP}/${body}${hasSubPath ? '/:path*' : ''}`,
);

/** `router.asPath`처럼 쿼리·해시가 붙어 있어도 된다 — 경로 부분만 본다. */
export const isPrivateAnalyticsPath = (pathOrUrl: string): boolean => {
  const path = (pathOrUrl || '').split('#')[0].split('?')[0];
  return PRIVATE_PATH_PATTERN.test(path);
};
