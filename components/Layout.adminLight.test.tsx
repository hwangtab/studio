import React from 'react';
import { render } from '@testing-library/react';
import Layout from './Layout';

let mockPathname = '/admin';

jest.mock('next/dynamic', () => () => {
  const DynamicNoop = () => null;
  return DynamicNoop;
});

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
  Footer: function MockFooter() {
    return <footer>Footer</footer>;
  },
}));

/**
 * 관리자 화면은 라이트 고정이다. 휴대폰이 다크 모드면 `.dark`가 붙어 제목이 흰 카드 위 흰색이 됐다(2026-10-20).
 * 관리자에서는 `.dark`를 걷되 저장된 선호(localStorage)는 건드리지 않고, 사이트로 돌아오면 복원한다.
 */
describe('Layout — 관리자는 라이트 고정', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = 'dark';
  });
  afterEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
  });

  it('관리자 경로에서는 .dark를 걷고 저장된 선호를 바꾸지 않는다', () => {
    localStorage.setItem('darkMode', 'true');
    mockPathname = '/admin/bookings';
    render(<Layout locale="ko"><p>본문</p></Layout>);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('darkMode')).toBe('true');
  });

  it('사이트로 돌아오면 저장된 선호대로 .dark를 복원한다', () => {
    localStorage.setItem('darkMode', 'true');
    mockPathname = '/admin';
    const view = render(<Layout locale="ko"><p>본문</p></Layout>);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    mockPathname = '/[locale]/contact';
    view.rerender(<Layout locale="ko"><p>본문</p></Layout>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
