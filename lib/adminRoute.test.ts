/**
 * 이 판정에 두 동작이 걸려 있다 — 사이트 헤더·푸터를 붙이지 않는 것(Layout)과 번역 사전을
 * 기다리지 않는 것(_app). 접두사 비교라 `/administrators` 같은 경로가 딸려 들어오면
 * 그 페이지가 헤더 없이 번역도 없는 채로 렌더된다.
 */
import { isAdminRoute } from './adminRoute';

it.each(['/admin', '/admin/bookings', '/admin/bookings/[id]', '/admin/funding/[id]'])(
  '%s는 관리자 경로다',
  (pathname) => {
    expect(isAdminRoute(pathname)).toBe(true);
  },
);

it.each(['/adminX', '/administrators', '/[locale]', '/[locale]/admin', '/', '/api/admin/auth'])(
  '%s는 관리자 경로가 아니다',
  (pathname) => {
    expect(isAdminRoute(pathname)).toBe(false);
  },
);
