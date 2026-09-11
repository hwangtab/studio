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
 * 페이지의 이탈 링크는 전부 문서 이동(`<a href>`)으로 둔다.
 */

/** 정규식(런타임 판정)과 next.config.mjs의 no-store `source`를 함께 만드는 한 벌의 정의. */
const PRIVATE_ROUTE_BODIES: ReadonlyArray<readonly [body: string, hasSubPath: boolean]> = [
  ['contracts', true],
  // fail에는 토스가 orderId(=주문번호)를 붙인다. 예전엔 success만 제외해 놓아서
  // 결제 실패 페이지의 주문번호가 상시 측정에 적재됐다.
  ['funding/(success|fail)', false],
  // 무통장입금(deposit)은 2026-09-11에 결제수단에서 빠지며 페이지도 함께 삭제됐다.
  ['funding/manage', true],
  ['booking/(success|fail)', false],
  ['booking/manage', true],
];

const LOCALE_GROUP = '(ko|en|zh|es|vi|th|uz)';

const PRIVATE_PATH_PATTERN = new RegExp(
  `^/${LOCALE_GROUP}/(${PRIVATE_ROUTE_BODIES.map(([body]) => body).join('|')})\\b`,
);

/**
 * 위 목록에서 **측정만** 되돌리는 예외. no-store는 그대로 유지된다(HTML에 관리 토큰이 실린다).
 *
 * 펀딩 success는 토스가 돌려보내는 승인 URL(paymentKey·orderId·amount)에서 확정을 끝낸 뒤
 * 비밀값이 없는 `?o=<주문번호>`로 **리다이렉트**한다 — 즉 이 경로가 실제로 렌더되는 순간의
 * URL에는 토큰도 paymentKey도 없다. 그런데 측정에서 빠져 있는 동안 `funding_pledge_paid`가
 * 큐에만 쌓이다 탭을 닫으면 사라져, 퍼널이 **진입 100% · 결제 0%** 로 보였다(첫 캠페인
 * 트래픽을 재려면 오픈 전에 고쳐야 하는 문제였다).
 *
 * fail은 예외가 아니다 — 토스가 실패 URL에 orderId를 직접 붙이므로 우리가 막을 수 없다.
 *
 * 주의: 이 예외를 늘리려면 "그 경로가 렌더될 때 URL에 비밀값이 절대 없는가"를 먼저 증명해야
 * 한다. success는 **성공도 실패도** 리다이렉트로 그것을 보장한다
 * (pages/[locale]/funding/success.tsx getServerSideProps). 그래도 그 한 줄에만 기대지 않는다 —
 * 아래 SECRET_QUERY_PATTERN이 비밀값이 붙은 URL을 발견하면 예외를 취소하고 측정에서 뺀다.
 * 예외가 조용히 새는 경로(승인 실패를 그 자리에서 렌더하는 분기 하나면 충분했다)를 코드로
 * 막아 두는 것이다.
 */
const MEASURED_EXCEPTION_PATTERN = new RegExp(`^/${LOCALE_GROUP}/funding/success$`);

/** 위 예외에 해당하는 `router.pathname` 목록 — Layout은 계속 껍데기를 벗긴다(테스트가 대조). */
export const MEASURED_PRIVATE_PAGE_ROUTES: readonly string[] = ['/[locale]/funding/success'];

/**
 * 쿼리에 이 이름들이 있으면 예외를 **취소**한다 — 측정 제외로 되돌린다.
 *
 * 경로만 보고 예외를 적용하면, 그 경로가 어쩌다 비밀값을 달고 렌더되는 순간 그대로 유출된다.
 * 값이 무엇인지는 보지 않는다 — 이름이 보이면 그걸로 충분하다(안전한 쪽으로 틀린다).
 */
const SECRET_QUERY_PATTERN = /(^|&)(paymentKey|orderId|token|secret)=/i;

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

/**
 * 같은 페이지들을 Next.js `router.pathname`(동적 세그먼트가 `[...]`인 형태)으로 적은 목록.
 * `components/Layout.tsx`가 사이트 껍데기(헤더·푸터·플로팅 버튼)를 벗길 때 쓴다.
 *
 * 본문 링크만 문서 이동으로 바꾸는 것으로는 부족하다 — 헤더 로고·네비·푸터가 전부
 * next/link라, 로고 한 번이면 위에 적은 뒤로가기 유출이 그대로 재현된다. 본문의 "홈으로"
 * 보다 헤더 로고가 더 자주 눌린다. 계약 화면과 같은 판단이기도 하다: 한 가지 일만 하러
 * 온 화면이라 네비게이션이 필요 없고, 브랜드는 페이지가 자기 상단에서 직접 밝힌다.
 *
 * `/funding/[slug]/pledge`는 **일부러 뺐다.** URL에 비밀값이 없는 결제 **전** 입력 폼이라
 * 측정 대상이고, 후원자가 가격·약관을 다시 보러 나갈 수 있어야 한다(우하단 플로팅 버튼만
 * FundingMobileCta와 겹쳐 `Layout`이 이미 따로 숨긴다).
 *
 * 계약 화면은 `Layout`이 `isContractPage`로 따로 판정한다 — 라이트 고정 등 규칙이 더 있다.
 */
export const PRIVATE_PAGE_ROUTES: readonly string[] = [
  '/[locale]/funding/manage/[orderNo]',
  '/[locale]/funding/success',
  '/[locale]/funding/fail',
  '/[locale]/booking/manage/[orderNo]',
  '/[locale]/booking/success',
  '/[locale]/booking/fail',
];

export const isPrivatePageRoute = (pathname: string): boolean => PRIVATE_PAGE_ROUTES.includes(pathname);

/** `router.asPath`처럼 쿼리·해시가 붙어 있어도 된다 — 경로로 판정하되 쿼리는 예외 취소에 쓴다. */
export const isPrivateAnalyticsPath = (pathOrUrl: string): boolean => {
  const withoutHash = (pathOrUrl || '').split('#')[0];
  const queryAt = withoutHash.indexOf('?');
  const path = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const query = queryAt === -1 ? '' : withoutHash.slice(queryAt + 1);
  if (MEASURED_EXCEPTION_PATTERN.test(path) && !SECRET_QUERY_PATTERN.test(query)) return false;
  return PRIVATE_PATH_PATTERN.test(path);
};
