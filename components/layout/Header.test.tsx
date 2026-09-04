import React from 'react';
import { render, screen, act } from '@testing-library/react';

/**
 * 헤더 모바일 메뉴가 라우트 변경 시 닫히는지.
 *
 * Header는 Layout 안에 있어 페이지 전환으로 remount되지 않는다(_app.tsx의 remount key는
 * 안쪽 Component에만 걸린다). 그래서 메뉴를 연 채 브라우저 뒤로가기처럼 링크 클릭이 아닌
 * 경로로 이동하면 isMenuOpen이 true로 남았다.
 *
 * MobileNav는 iOS 성능 때문에 항상 mount된 채 CSS로만 토글하는 구조라, 새 페이지 위에
 * 이전 메뉴가 그대로 떠 있고 useFocusTrapDialog가 포커스를 그 안에 계속 가둔다 —
 * 키보드·스크린리더 사용자가 새 페이지를 조작할 수 없게 되는 것이 이 버그의 핵심이다.
 * 시각적 잔존만의 문제가 아니라서 회귀로 고정한다.
 */

const routeHandlers: Record<string, Array<() => void>> = {};
const mockRouter = {
  asPath: '/ko',
  pathname: '/[locale]',
  query: {},
  push: jest.fn(),
  events: {
    on: (event: string, cb: () => void) => {
      (routeHandlers[event] ||= []).push(cb);
    },
    off: (event: string, cb: () => void) => {
      routeHandlers[event] = (routeHandlers[event] || []).filter((h) => h !== cb);
    },
  },
};

jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}));
// lib/i18n.ts가 모듈 로드 시 i18n.use(initReactI18next)를 부르므로 그것까지 목킹해야
// 한다(components/Layout.test.tsx와 같은 패턴).
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: jest.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

// eslint-disable-next-line import/first
import { Header } from './Header';

const renderHeader = () =>
  render(
    <Header
      locale="ko"
      isScrolled={false}
      hasHero={false}
      isDarkMode={false}
      toggleDarkMode={() => {}}
    />,
  );

/**
 * MobileNav는 항상 DOM에 있고(iOS 성능 때문에 CSS로만 토글) 열림 여부는
 * role="dialog" 컨테이너의 aria-hidden으로 드러난다.
 */
const mobileNav = () => document.querySelector('[role="dialog"]');
const menuToggle = () => screen.getByRole('button', { name: /actions\.(open|close)Menu/ });

beforeEach(() => {
  for (const key of Object.keys(routeHandlers)) delete routeHandlers[key];
  jest.clearAllMocks();
});

describe('Header 모바일 메뉴', () => {
  it('라우트 변경 이벤트를 구독한다', () => {
    renderHeader();
    expect(routeHandlers.routeChangeStart?.length ?? 0).toBeGreaterThan(0);
  });

  it('언마운트 시 라우트 구독을 해제한다 (리스너 누수 방지)', () => {
    const { unmount } = renderHeader();
    const mounted = routeHandlers.routeChangeStart.length;
    expect(mounted).toBeGreaterThan(0);

    unmount();
    // 마운트하며 늘어난 만큼 그대로 줄어야 한다. 개수를 1로 단정하지 않는 이유는
    // Header 트리의 다른 컴포넌트도 같은 이벤트를 구독할 수 있기 때문이다.
    expect(routeHandlers.routeChangeStart.length).toBe(0);
  });

  /**
   * 핵심 회귀: 메뉴를 연 뒤 링크 클릭이 아닌 경로 이동(뒤로가기)이 일어나면 닫혀야 한다.
   * 이 테스트가 없던 시절, 열린 메뉴가 새 페이지 위에 남아 포커스를 가뒀다.
   */
  it('메뉴를 연 채 라우트가 바뀌면 닫힌다 (뒤로가기 시나리오)', () => {
    renderHeader();

    act(() => {
      menuToggle().click();
    });
    expect(menuToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(mobileNav()).toHaveAttribute('aria-hidden', 'false');

    // 브라우저 뒤로가기 — Header는 remount되지 않고 라우트 이벤트만 발생한다.
    act(() => {
      routeHandlers.routeChangeStart.forEach((cb) => cb());
    });

    expect(menuToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(mobileNav()).toHaveAttribute('aria-hidden', 'true');
  });
});
