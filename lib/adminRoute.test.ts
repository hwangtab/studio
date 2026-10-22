/**
 * 이 판정에 두 동작이 걸려 있다 — 사이트 헤더·푸터를 붙이지 않는 것(Layout)과 번역 사전을
 * 기다리지 않는 것(_app). 접두사 비교라 `/administrators` 같은 경로가 딸려 들어오면
 * 그 페이지가 헤더 없이 번역도 없는 채로 렌더된다.
 */
import { isAdminNotFoundPath, isAdminRoute } from './adminRoute';

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

describe('isAdminNotFoundPath — 관리자 주소의 404', () => {
  it('404 라우트 + 관리자 주소면 참', () => {
    expect(isAdminNotFoundPath('/404', '/admin/bookings/없는id')).toBe(true);
    expect(isAdminNotFoundPath('/404', '/admin')).toBe(true);
  });
  it('사이트 주소의 404나 404가 아닌 라우트는 거짓', () => {
    expect(isAdminNotFoundPath('/404', '/ko/없는-페이지')).toBe(false);
    expect(isAdminNotFoundPath('/404', '/administrators')).toBe(false);
    expect(isAdminNotFoundPath('/admin/bookings/[id]', '/admin/bookings/x')).toBe(false);
  });
});
