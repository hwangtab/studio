import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * 회귀 방지: /ko/funding·/ko/artists(그리고 슬러그 상세) 같은 ko 전용 SSG 라우트에서
 * 언어 전환기가 만드는 6개 링크가 전부 404였다(2026-09-14 적발). getPathForLocale이
 * 로케일 세그먼트만 치환해 존재하지 않는 /en/funding 등을 만들었기 때문.
 * 지금은 lib/koOnlyRoutes.ts의 KO_ONLY_ROUTE_SEGMENTS를 참조해 대상 로케일 홈으로
 * 탈출시킨다.
 */
const mockAsPath = { current: '/ko/funding' };

jest.mock('next/router', () => ({
  useRouter: () => ({
    asPath: mockAsPath.current,
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

import { LanguageSwitcher } from '../../components/LanguageSwitcher';

describe('LanguageSwitcher — ko 전용 라우트 탈출', () => {
  it('/ko/funding에서 en 링크는 /en/funding이 아니라 /en으로 간다', () => {
    mockAsPath.current = '/ko/funding';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en');
  });

  it('/ko/funding/<slug>에서도 로케일 홈으로 탈출한다', () => {
    mockAsPath.current = '/ko/funding/some-project';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en');
  });

  it('/ko/artists/<slug>에서도 로케일 홈으로 탈출한다', () => {
    mockAsPath.current = '/ko/artists/some-artist';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en');
  });

  it('ko 전용이 아닌 일반 라우트는 그대로 세그먼트만 치환한다(회귀 없음 확인)', () => {
    mockAsPath.current = '/ko/pricing';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en/pricing');
  });
});
