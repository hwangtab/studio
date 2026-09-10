import React from 'react';
import { render } from '@testing-library/react';
import Layout from './Layout';

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
