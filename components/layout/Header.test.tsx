import React from 'react';
import { render, screen, act, cleanup, within } from '@testing-library/react';

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

  /**
   * 펀딩 퍼널과 아티스트 후원은 ko 전용(스펙 §8·§11.2) — 다른 로케일 헤더에는
   * 항목이 없어야 한다. 2026-09-11 재정렬로 둘을 '아티스트' 그룹으로 모았고,
   * 항목이 전부 ko 전용이라 **그룹째** ko에서만 렌더한다(비-ko에서 빈 드롭다운이
   * 열리면 안 된다).
   *
   * react-i18next는 t: (key) => key로 목킹돼 있어 실제 렌더 텍스트는 번역 라벨이
   * 아니라 키('nav.funding')다. MobileNav는 항상 DOM에 마운트돼 있으므로(CSS 토글)
   * 드롭다운을 열지 않아도 그룹 버튼이 조회된다.
   */
  it('ko에서는 아티스트 그룹에 후원·펀딩이 있고 en에서는 그룹 자체가 없다', () => {
    renderHeader();
    // 모바일 메뉴 → 아티스트 그룹 아코디언을 열어야 항목이 DOM에 렌더된다
    // (그룹 내용은 열림 상태에서만 mount되는 구조 — DropdownMenu도 동일).
    act(() => {
      menuToggle().click();
    });
    const nav = mobileNav() as HTMLElement;
    act(() => {
      within(nav).getByRole('button', { name: 'nav.groups.artist' }).click();
    });
    expect(within(nav).getByRole('link', { name: 'nav.funding' })).toHaveAttribute('href', '/ko/funding');
    expect(within(nav).getByRole('link', { name: 'nav.artists' })).toHaveAttribute('href', '/ko/artists');
    cleanup();

    render(
      <Header
        locale="en"
        isScrolled={false}
        hasHero={false}
        isDarkMode={false}
        toggleDarkMode={() => {}}
      />,
    );
    // 그룹을 여는 버튼조차 없어야 한다 — 빈 드롭다운이 남으면 정리가 덜 된 것이다.
    expect(screen.queryByRole('button', { name: 'nav.groups.artist' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'nav.funding' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'nav.artists' })).toBeNull();
  });

  /**
   * 재정렬의 뼈대를 고정한다. 그룹 라벨과 1탭 링크가 다시 뒤섞이면 여기서 잡힌다.
   *
   *   1탭  = 드롭다운에 넣으면 오히려 못 찾는 것 (연습실·스토리·가격)
   *   그룹 = 방문자가 하려는 일 (만든다 / 낸다 / 함께한다 / 안다)
   */
  it('메뉴 뼈대가 유지된다 — 1탭 셋과 그룹 넷', () => {
    renderHeader();
    act(() => {
      menuToggle().click();
    });
    const nav = mobileNav() as HTMLElement;

    // 모바일 퀵링크는 nav.short.*(가로 배치용 축약)가 아니라 전체 이름을 쓴다.
    // 항목 구성은 데스크톱 1탭과 같아야 한다 — 문의만 모바일에 추가로 둔다.
    for (const [name, href] of [
      ['nav.practiceRoom', '/ko/practice-room'],
      ['nav.stories', '/ko/stories'],
      ['nav.pricing', '/ko/pricing'],
      ['nav.contact', '/ko/contact'],
    ] as const) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    // 아티스트 후원은 퀵링크가 아니라 아티스트 그룹에만 있어야 한다(중복 금지).
    expect(within(nav).queryByRole('link', { name: 'nav.artists' })).toBeNull();

    for (const group of ['production', 'release', 'artist', 'studio']) {
      expect(within(nav).getByRole('button', { name: `nav.groups.${group}` })).toBeTruthy();
    }
    // 가이드 그룹은 해체됐다 — 포트폴리오는 스튜디오로, 스토리는 1탭으로 갔다.
    expect(within(nav).queryByRole('button', { name: 'nav.groups.guide' })).toBeNull();

    // 발매 그룹에는 티어를 넣지 않는다(개요 페이지의 비교표가 그 역할).
    act(() => {
      within(nav).getByRole('button', { name: 'nav.groups.release' }).click();
    });
    expect(within(nav).getByRole('link', { name: 'nav.musicPromotion' })).toBeTruthy();
    expect(within(nav).queryByRole('link', { name: 'nav.releaseSingle' })).toBeNull();
  });
});
