/**
 * 관리자 화면인지 판정한다 — `_app`과 `Layout`이 같은 정의를 쓰게 한 곳에 둔다.
 *
 * 두 곳이 각자 문자열을 비교하고 있으면 한쪽만 고쳐졌을 때 조합이 어긋난다. 실제로
 * 이 판정에 걸린 동작이 둘이다: 사이트 헤더·푸터를 붙이지 않는 것(Layout)과 번역 사전을
 * 기다리지 않는 것(_app). 판정이 갈리면 헤더 없는 화면이 번역을 기다리거나 그 반대가 된다.
 *
 * 받는 값은 `router.pathname`(라우트 패턴)이다. `asPath`가 아니다 — 쿼리·해시가 붙지 않아
 * 서버·클라이언트가 같은 값을 보고, 로케일 접두사가 없는 관리자 경로에서 그대로 비교된다.
 */
export const isAdminRoute = (pathname: string): boolean =>
  pathname === '/admin' || pathname.startsWith('/admin/');
