/**
 * 이 컴포넌트가 지키는 것은 하나다 — **어느 관리자 화면에서도 나갈 수 있다.**
 *
 * 예전에는 페이지마다 머리말을 직접 그려서 상세 네 곳과 계약 작성·수정 화면이 막다른
 * 길이었다. 나가는 길을 페이지가 아니라 셸이 책임지게 옮긴 것이 이번 변경이고, 그 보장이
 * 조용히 사라지지 않도록 여기서 고정한다.
 */
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const replace = jest.fn();
let pathname = '/admin';
jest.mock('next/router', () => ({ useRouter: () => ({ replace, pathname }) }));

const logoutAdmin = jest.fn().mockResolvedValue(undefined);
jest.mock('./contractActions', () => ({ logoutAdmin: () => logoutAdmin() }));

// eslint-disable-next-line import/first
import { AdminShell, ADMIN_NAV, activeAdminNavHref } from './AdminShell';

beforeEach(() => {
  jest.clearAllMocks();
  pathname = '/admin';
});

const nav = () => screen.getByRole('navigation', { name: '관리자 구역' });

it('어느 화면에서든 다섯 구역과 로그아웃에 닿는다', () => {
  pathname = '/admin/contracts/[id]/edit';
  render(<AdminShell title="계약 수정">본문</AdminShell>);

  for (const item of ADMIN_NAV) {
    expect(within(nav()).getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
  }
  expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
});

it('지금 있는 구역만 현재 위치로 표시한다 — 상세 화면에서도 그 구역이 켜진다', () => {
  pathname = '/admin/bookings/[id]';
  render(<AdminShell title="예약 상세">본문</AdminShell>);

  expect(within(nav()).getByRole('link', { name: '예약·믹싱' })).toHaveAttribute('aria-current', 'page');
  // '/admin'은 모든 관리자 경로의 접두사라, 잘못 맞히면 상세에서도 대시보드가 켜진다.
  expect(within(nav()).getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current');
});

it('되돌아가는 링크는 상단 바와 별개로, 준 곳에만 나온다', () => {
  const { rerender } = render(<AdminShell title="구독 관리">본문</AdminShell>);
  expect(screen.queryByRole('link', { name: /구독 목록/ })).not.toBeInTheDocument();

  rerender(
    <AdminShell title="구독 상세" backHref="/admin/subscriptions" backLabel="구독 목록">
      본문
    </AdminShell>,
  );
  expect(screen.getByRole('link', { name: /구독 목록/ })).toHaveAttribute('href', '/admin/subscriptions');
});

it('제목·설명·페이지 고유 동작·본문을 그대로 싣는다', () => {
  render(
    <AdminShell title="계약 관리" description="계약을 작성하고 발송합니다." actions={<button type="button">새 계약 작성</button>}>
      <p>본문 내용</p>
    </AdminShell>,
  );

  expect(screen.getByRole('heading', { level: 1, name: '계약 관리' })).toBeInTheDocument();
  expect(screen.getByText('계약을 작성하고 발송합니다.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '새 계약 작성' })).toBeInTheDocument();
  expect(screen.getByText('본문 내용')).toBeInTheDocument();
});

it('로그아웃하면 세션을 끊고 로그인 화면으로 보낸다', async () => {
  render(<AdminShell title="대시보드">본문</AdminShell>);

  screen.getByRole('button', { name: '로그아웃' }).click();
  await Promise.resolve();
  await Promise.resolve();

  expect(logoutAdmin).toHaveBeenCalled();
  expect(replace).toHaveBeenCalledWith('/admin/login');
});

describe('activeAdminNavHref', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/contracts', '/admin/contracts'],
    ['/admin/contracts/[id]', '/admin/contracts'],
    ['/admin/contracts/[id]/edit', '/admin/contracts'],
    ['/admin/bookings/[id]', '/admin/bookings'],
    ['/admin/funding/[id]', '/admin/funding'],
    ['/admin/subscriptions/new', '/admin/subscriptions'],
  ])('%s → %s', (pathnameInput, expected) => {
    expect(activeAdminNavHref(pathnameInput)).toBe(expected);
  });

  it('관리자 경로가 아니면 아무것도 켜지 않는다', () => {
    expect(activeAdminNavHref('/[locale]')).toBeNull();
    expect(activeAdminNavHref('/[locale]/contact')).toBeNull();
  });

  it('경계를 넘겨 맞히지 않는다 — 접두사가 같을 뿐인 경로', () => {
    // '/admin/contractsX'는 '/admin/contracts'로 시작하지만 다른 경로다.
    expect(activeAdminNavHref('/admin/contractsX')).toBe('/admin');
  });
});
