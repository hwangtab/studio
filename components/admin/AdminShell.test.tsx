/**
 * 이 컴포넌트가 지키는 것은 하나다 — **어느 관리자 화면에서도 나갈 수 있다.**
 *
 * 예전에는 페이지마다 머리말을 직접 그려서 상세 네 곳과 계약 작성·수정 화면이 막다른
 * 길이었다. 나가는 길을 페이지가 아니라 셸이 책임지게 옮긴 것이 이번 변경이고, 그 보장이
 * 조용히 사라지지 않도록 여기서 고정한다.
 */
import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const replace = jest.fn();
let pathname = '/admin';
jest.mock('next/router', () => ({ useRouter: () => ({ replace, pathname }) }));

const logoutAdmin = jest.fn().mockResolvedValue(undefined);
jest.mock('./contractActions', () => ({ logoutAdmin: () => logoutAdmin() }));

// eslint-disable-next-line import/first
import { AdminShell, ADMIN_NAV, ADMIN_NAV_ENTRIES, activeAdminNavHref, isNavGroup } from './AdminShell';

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  pathname = '/admin';
  // 셸이 마운트 때 "지금 누구로 들어와 있는가"를 한 번 묻는다.
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, id: 'kyungha', name: '황경하' }) });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

const nav = () => screen.getByRole('navigation', { name: '관리자 구역' });

/**
 * 셸은 마운트 직후 현재 관리자를 묻고 그 응답으로 setState를 한다. 그냥 render하면 그
 * 갱신이 act 밖에서 일어나 경고가 뜨므로, 렌더와 그 뒤의 마이크로태스크를 함께 감싼다.
 */
const renderShell = async (ui: React.ReactElement) => {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui);
  });
  return result;
};

it('어느 화면에서든 모든 구역과 로그아웃에 닿는다', async () => {
  pathname = '/admin/contracts/[id]/edit';
  await renderShell(<AdminShell title="계약 수정">본문</AdminShell>);

  // 대시보드는 늘 보이고, 나머지 구역은 묶음 이름을 눌러 열면 닿는다.
  expect(within(nav()).getByRole('link', { name: '대시보드' })).toHaveAttribute('href', '/admin');
  for (const entry of ADMIN_NAV_ENTRIES.filter(isNavGroup)) {
    await act(async () => {
      within(nav()).getByRole('button', { name: entry.label }).click();
    });
    for (const item of entry.items) {
      expect(within(nav()).getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
    }
  }
  expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
});

it('묶음에 들어 있지 않은 구역이 없다 — 새 구역을 더하면 어느 묶음에 넣을지 정해야 한다', () => {
  const grouped = ADMIN_NAV_ENTRIES.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry])).map((i) => i.href);
  expect(new Set(grouped).size).toBe(grouped.length);
  expect(grouped).toEqual(ADMIN_NAV.map((i) => i.href));
  expect(grouped).toEqual(expect.arrayContaining(['/admin/revenue', '/admin/payment-links', '/admin/privacy-logs', '/admin/contracts', '/admin/subscriptions', '/admin/artists']));
  // 예약은 한 화면을 라인으로 갈라 세 곳에 걸린다.
  expect(grouped.filter((h) => h.startsWith('/admin/bookings'))).toEqual(['/admin/bookings?line=practice', '/admin/bookings?line=studio', '/admin/bookings?line=mixing']);
});

describe('데스크톱 드롭다운', () => {
  const group = (name: string) => within(nav()).getByRole('button', { name });

  it('처음에는 닫혀 있고, 누르면 열리고, 다시 누르면 닫힌다', async () => {
    await renderShell(<AdminShell title="대시보드">본문</AdminShell>);
    expect(group('플랫폼')).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav()).queryByRole('link', { name: '펀딩' })).not.toBeInTheDocument();

    await act(async () => group('플랫폼').click());
    expect(group('플랫폼')).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav()).getByRole('link', { name: '펀딩' })).toBeInTheDocument();

    await act(async () => group('플랫폼').click());
    expect(within(nav()).queryByRole('link', { name: '펀딩' })).not.toBeInTheDocument();
  });

  it('한 번에 하나만 열린다', async () => {
    await renderShell(<AdminShell title="대시보드">본문</AdminShell>);
    await act(async () => group('플랫폼').click());
    await act(async () => group('공통').click());
    expect(within(nav()).queryByRole('link', { name: '펀딩' })).not.toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: '매출' })).toBeInTheDocument();
  });

  it('Esc와 바깥 클릭으로 닫힌다', async () => {
    await renderShell(
      <>
        <AdminShell title="대시보드">본문</AdminShell>
      </>,
    );
    await act(async () => group('플랫폼').click());
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(within(nav()).queryByRole('link', { name: '펀딩' })).not.toBeInTheDocument();

    await act(async () => group('플랫폼').click());
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(within(nav()).queryByRole('link', { name: '펀딩' })).not.toBeInTheDocument();
  });

  it('링크를 누르면 닫힌다', async () => {
    await renderShell(<AdminShell title="대시보드">본문</AdminShell>);
    await act(async () => group('플랫폼').click());
    await act(async () => {
      within(nav()).getByRole('link', { name: '펀딩' }).click();
    });
    expect(within(nav()).queryByRole('link', { name: '펀딩' })).not.toBeInTheDocument();
  });
});

it('지금 있는 구역만 현재 위치로 표시한다 — 상세 화면에서도 그 구역이 켜진다', async () => {
  pathname = '/admin/bookings/[id]';
  await renderShell(<AdminShell title="예약 상세" navLine="studio">본문</AdminShell>);

  // 현재 구역이 든 묶음 이름이 켜지고, 열면 그 구역 링크가 현재 위치로 표시된다.
  // 예약 상세는 자기 라인을 알려 줘야(navLine) 어느 라인의 예약인지 켜진다.
  expect(within(nav()).getByRole('button', { name: '녹음실' })).toHaveAttribute('data-active', 'true');
  expect(within(nav()).getByRole('button', { name: '연습실' })).not.toHaveAttribute('data-active');
  await act(async () => {
    within(nav()).getByRole('button', { name: '녹음실' }).click();
  });
  expect(within(nav()).getByRole('link', { name: '녹음실 예약' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav()).getByRole('link', { name: '믹싱·마스터링' })).not.toHaveAttribute('aria-current');
  // '/admin'은 모든 관리자 경로의 접두사라, 잘못 맞히면 상세에서도 대시보드가 켜진다.
  expect(within(nav()).getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current');
});

it('되돌아가는 링크는 상단 바와 별개로, 준 곳에만 나온다', async () => {
  const { rerender } = await renderShell(<AdminShell title="구독 관리">본문</AdminShell>);
  expect(screen.queryByRole('link', { name: /구독 목록/ })).not.toBeInTheDocument();

  rerender(
    <AdminShell title="구독 상세" backHref="/admin/subscriptions" backLabel="구독 목록">
      본문
    </AdminShell>,
  );
  expect(screen.getByRole('link', { name: /구독 목록/ })).toHaveAttribute('href', '/admin/subscriptions');
});

it('제목·설명·페이지 고유 동작·본문을 그대로 싣는다', async () => {
  await renderShell(
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
  await renderShell(<AdminShell title="대시보드">본문</AdminShell>);

  screen.getByRole('button', { name: '로그아웃' }).click();
  await Promise.resolve();
  await Promise.resolve();

  expect(logoutAdmin).toHaveBeenCalled();
  expect(replace).toHaveBeenCalledWith('/admin/login');
});

/**
 * 좁은 화면에서는 구역을 버튼 하나로 접는다. 한 줄 가로 스크롤에 여덟 구역을 넣었더니
 * 폰에서 두 구역만 보이고 지금 있는 구역이 화면 밖에 있었다.
 */
it('좁은 화면 메뉴 버튼은 현재 구역을 보여 주고, 누르면 모든 구역과 로그아웃을 펼친다', async () => {
  pathname = '/admin/funding/[id]';
  await renderShell(<AdminShell title="펀딩 상세">본문</AdminShell>);

  const toggle = screen.getByRole('button', { name: '펀딩' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('navigation', { name: '관리자 구역 메뉴' })).not.toBeInTheDocument();

  await act(async () => {
    toggle.click();
  });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const menu = screen.getByRole('navigation', { name: '관리자 구역 메뉴' });
  for (const item of ADMIN_NAV) {
    expect(within(menu).getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
  }
  expect(within(menu).getByRole('link', { name: '펀딩' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getAllByRole('button', { name: '로그아웃' })).toHaveLength(2);

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  expect(screen.queryByRole('navigation', { name: '관리자 구역 메뉴' })).not.toBeInTheDocument();
});

describe('activeAdminNavHref', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/contracts', '/admin/contracts'],
    ['/admin/contracts/[id]', '/admin/contracts'],
    ['/admin/contracts/[id]/edit', '/admin/contracts'],
    ['/admin/funding/[id]', '/admin/funding'],
    ['/admin/subscriptions/new', '/admin/subscriptions'],
  ])('%s → %s', (pathnameInput, expected) => {
    expect(activeAdminNavHref(pathnameInput)).toBe(expected);
  });

  it('같은 경로를 여럿이 거는 예약은 라인이 가른다 — 라인을 모르면 아무것도 켜지 않는다', () => {
    expect(activeAdminNavHref('/admin/bookings', 'practice')).toBe('/admin/bookings?line=practice');
    expect(activeAdminNavHref('/admin/bookings', 'studio')).toBe('/admin/bookings?line=studio');
    expect(activeAdminNavHref('/admin/bookings/[id]', 'mixing')).toBe('/admin/bookings?line=mixing');
    expect(activeAdminNavHref('/admin/bookings')).toBeNull();
    expect(activeAdminNavHref('/admin/bookings', null)).toBeNull();
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

/**
 * 비밀번호가 사람마다 달라졌으니(lib/contracts/admin-accounts.ts) 내가 누구로 보이는지가
 * 화면에 있어야 한다 — 개인정보 조회가 내 이름으로 기록된다는 것을 보는 자리다.
 * GSSP prop이 아니라 GET /api/admin/auth 한 번으로 가져온다.
 */
it('지금 로그인한 사람의 이름을 띄운다', async () => {
  await renderShell(<AdminShell title="대시보드">본문</AdminShell>);
  expect(screen.getByTestId('admin-current-user')).toHaveTextContent('황경하');
  expect(fetchMock).toHaveBeenCalledWith('/api/admin/auth', { credentials: 'same-origin' });
});

it('이름을 얻지 못해도 화면은 그대로다', async () => {
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) });
  await renderShell(<AdminShell title="대시보드">본문</AdminShell>);
  expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  expect(screen.queryByTestId('admin-current-user')).not.toBeInTheDocument();
});
