import React from 'react';
import { render } from '@testing-library/react';
import Layout from './Layout';
import { PRIVATE_PAGE_ROUTES } from '../lib/analytics/privatePaths';

// 실제 KakaoFab·ScrollToTop을 식별 가능한 마커로 대체한다 — 기본 next/dynamic mock(Layout.test.tsx)은
// 전부 null을 그려 이 회귀(펀딩 후원 페이지에서 전역 플로팅 버튼을 숨긴다)를 검증할 수 없다.
jest.mock('next/dynamic', () => (loader: () => Promise<unknown>) => {
  const src = loader.toString();
  if (src.includes('KakaoFab')) return function MockKakaoFab() { return <div data-testid="kakao-fab" />; };
  if (src.includes('ScrollToTop')) return function MockScrollToTop() { return <div data-testid="scroll-to-top" />; };
  return function MockDynamic() { return null; };
});

let mockPathname = '/[locale]/funding/[slug]/pledge';
jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: mockPathname }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: jest.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./layout/Header', () => ({
  Header: React.forwardRef<HTMLElement>(function MockHeader(_props, ref) {
    return <header ref={ref}>Header</header>;
  }),
}));

jest.mock('./layout/Footer', () => ({
  Footer: function MockFooter() { return <footer>Footer</footer>; },
}));

describe('Layout — 펀딩 후원 페이지의 전역 플로팅 버튼', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('/pledge에서는 KakaoFab·ScrollToTop을 숨긴다 (FundingMobileCta 전폭 하단 바와 겹치므로)', () => {
    mockPathname = '/[locale]/funding/[slug]/pledge';
    const { queryByTestId } = render(<Layout><div /></Layout>);
    expect(queryByTestId('kakao-fab')).toBeNull();
    expect(queryByTestId('scroll-to-top')).toBeNull();
  });

  it('펀딩 상세 페이지 등 다른 라우트에서는 그대로 뜬다', () => {
    mockPathname = '/[locale]/funding/[slug]';
    const { queryByTestId } = render(<Layout><div /></Layout>);
    expect(queryByTestId('kakao-fab')).not.toBeNull();
    expect(queryByTestId('scroll-to-top')).not.toBeNull();
  });
});

/**
 * 본문 링크만 문서 이동으로 바꾸는 것으로는 부족했다 — 헤더 로고·네비·푸터가 전부
 * next/link라, 로고 한 번이면 관리 토큰이 실린 URL로 돌아오는 page_view 유출이 그대로
 * 재현된다(본문 "홈으로"보다 헤더 로고가 더 자주 눌린다). 그래서 이 라우트들은 계약 화면과
 * 같이 사이트 껍데기를 두르지 않는다 — lib/analytics/privatePaths.ts PRIVATE_PAGE_ROUTES.
 */
describe('Layout — 결제·관리 화면은 사이트 껍데기를 두르지 않는다', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it.each(PRIVATE_PAGE_ROUTES)('%s 는 헤더·푸터·플로팅 버튼 없이 렌더된다', (route) => {
    mockPathname = route;
    const { container, queryByTestId } = render(<Layout><div /></Layout>);
    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
    expect(queryByTestId('kakao-fab')).toBeNull();
    expect(queryByTestId('scroll-to-top')).toBeNull();
  });

  // 결제 **전** 입력 폼이라 URL에 비밀값이 없고, 후원자가 가격·약관을 다시 보러 나갈 수
  // 있어야 한다 — 헤더·푸터는 그대로 두고 우하단 플로팅 버튼만 숨긴다(위 describe).
  it('/pledge는 결제 전 폼이라 헤더·푸터를 그대로 두른다', () => {
    mockPathname = '/[locale]/funding/[slug]/pledge';
    const { container } = render(<Layout><div /></Layout>);
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('footer')).not.toBeNull();
  });
});
