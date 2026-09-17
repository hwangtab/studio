/**
 * ko 전용 SSG 라우트 — getStaticPaths가 ko(또는 defaultLocale) 하나만 등록하고
 * fallback:false라, 다른 로케일로는 정적 파일 자체가 없어 404가 난다
 * (2026-09-14 적발: /ko/funding·/ko/artists. 2026-09-14 추가 적발: /ko/guides/<slug>).
 *
 * funding/[slug]/index.tsx만 예외다 — DB 프로젝트를 첫 요청에 만들려고
 * fallback:'blocking'을 쓰는데(2026-09-17 ISR 전환), blocking은 paths에 없는
 * 로케일 요청도 렌더를 시도한다. 그래서 getStaticProps가 params.locale을 직접
 * 확인해 notFound로 막아 같은 보장을 유지한다 — 아래 규칙·판정 함수는 그대로다.
 *
 * LanguageSwitcher가 이 목록에 걸리는 경로에서는 로케일 세그먼트만 치환한 링크를
 * 만들지 않고 해당 로케일 홈으로 탈출시킨다 — isRoutePatternPath 예외와 같은 자리,
 * 같은 방식(components/LanguageSwitcher.tsx).
 *
 * **세그먼트 전체가 ko 전용은 아니다.** funding 세그먼트에는 진짜 ko 전용 정적
 * 페이지(index, apply, [slug]/index)와, getServerSideProps로 모든 로케일 경로를
 * 받아 런타임에 /ko/funding으로 307 리다이렉트하는 SSR 페이지(terms·success·fail·
 * manage/[orderNo]·[slug]/pledge)가 섞여 있다. 후자는 404가 아니므로 홈으로
 * 탈출시키면 오히려 회귀다 — 특히 success·manage·pledge는 쿼리(주문번호 등)를
 * 지닌 채 리다이렉트돼야 하는데 홈으로 보내면 그 맥락을 잃는다. 그래서 세그먼트
 * 문자열 하나가 아니라 규칙(KoOnlyRouteRule)으로 깊이와 리터럴 형제 라우트를
 * 구분한다. `creator`(개설자 로그인·목록, 2026-09-17)도 같은 이유로 리터럴
 * 형제다 — getServerSideProps로 세션을 확인해 리다이렉트하는 페이지라
 * [slug]/index.tsx로 잘못 넘겨받으면 안 된다.
 *
 * 정본은 각 페이지의 getStaticPaths다. 이 규칙이 실제 페이지 구현과 갈리지 않도록
 * lib/koOnlyRoutes.test.ts가 각 규칙의 ko 전용 페이지 소스를 읽어 getStaticPaths가
 * ko(또는 defaultLocale) 하나만 등록하고 fallback:false인지 대조한다.
 */
export interface KoOnlyRouteRule {
  /** 최상위 디렉터리 세그먼트. */
  segment: string;
  /** true면 세그먼트만으로도(슬러그 없이) ko 전용 페이지가 있다(예: /artists, /funding). */
  hasIndexPage: boolean;
  /**
   * 두 번째 세그먼트가 사실은 슬러그가 아니라 형제 SSR 페이지의 리터럴 파일명인
   * 목록(예: funding/terms.tsx, funding/success.tsx). Next.js 파일 라우팅에서
   * 리터럴 라우트가 동적 세그먼트([slug])보다 우선하므로, 이 이름과 일치하면
   * ko 전용 정적 페이지가 아니라 SSR + 런타임 리다이렉트 페이지다.
   */
  literalSiblings: readonly string[];
}

export const KO_ONLY_ROUTE_RULES: readonly KoOnlyRouteRule[] = [
  { segment: 'artists', hasIndexPage: true, literalSiblings: [] },
  { segment: 'funding', hasIndexPage: true, literalSiblings: ['terms', 'success', 'fail', 'manage', 'creator'] },
  { segment: 'guides', hasIndexPage: false, literalSiblings: [] },
];

/**
 * 로케일 세그먼트를 뺀 경로(예: '/artists/some-slug')가 ko 전용 정적 라우트인지
 * 판정한다. 세그먼트 깊이가 2를 넘는 경로(예: /funding/<slug>/pledge)는 이 저장소에
 * ko 전용 정적 라우트가 없으므로(전부 SSR) 항상 false다.
 */
export const isKoOnlyRoutePath = (pathWithoutLocale: string): boolean => {
  const segments = pathWithoutLocale.split('/').filter(Boolean);
  if (segments.length === 0 || segments.length > 2) return false;

  const [first, second] = segments;
  const rule = KO_ONLY_ROUTE_RULES.find((r) => r.segment === first);
  if (!rule) return false;

  if (segments.length === 1) return rule.hasIndexPage;
  return !rule.literalSiblings.includes(second);
};
