import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * 회귀 방지: /ko/funding·/ko/artists·/ko/guides/<slug>(그리고 슬러그 상세) 같은
 * ko 전용 SSG 라우트에서 언어 전환기가 만드는 링크가 전부 404였다(2026-09-14
 * 적발, guides는 배포 사이트 /en/guides/home-recording-survival 404로 같은 날
 * 추가 적발). getPathForLocale이 로케일 세그먼트만 치환해 존재하지 않는
 * /en/funding 등을 만들었기 때문. 지금은 lib/koOnlyRoutes.ts의 KO_ONLY_ROUTE_RULES를
 * 참조해 대상 로케일 홈으로 탈출시킨다.
 *
 * funding은 세그먼트 전체가 ko 전용이 아니다 — terms·success 등은 SSR + 런타임
 * 리다이렉트라 404가 아니므로, 그런 경로까지 홈으로 탈출시키면 오히려 회귀다
 * (아래 '/ko/funding/terms' 케이스).
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

  it('/ko/guides/<slug>에서도 로케일 홈으로 탈출한다', () => {
    mockAsPath.current = '/ko/guides/home-recording-survival';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en');
  });

  // 회귀 방지: /ko/funding/terms는 SSR 페이지(getServerSideProps)가 모든 로케일
  // 경로를 받아 런타임에 /ko/funding/terms로 307 리다이렉트한다 — 404가 아니다.
  // funding 세그먼트 전체를 ko 전용으로 취급해 홈으로 탈출시키면, 정상적으로
  // 리다이렉트됐을 경로를 홈으로 잘못 보내는 새 회귀가 된다.
  it('/ko/funding/terms는 ko 전용 탈출 대상이 아니다 — 세그먼트만 치환(SSR 리다이렉트로 정상 처리됨)', () => {
    mockAsPath.current = '/ko/funding/terms';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en/funding/terms');
  });

  // 회귀 방지(적대적 재검토, 2026-09-14): asPath를 그대로 split('/')에 넣으면 쿼리·
  // 해시가 마지막 세그먼트에 눌러붙어 판정이 asPath에 쿼리 유무로 양방향 뒤집혔다.
  //   - /ko/funding/success?orderNo=A1 → 세그먼트가 'success?orderNo=A1'이라
  //     리터럴 형제('success') 매칭 실패 → 과잉 탈출(홈으로 튕겨 맥락 상실)
  //   - /ko/artists?utm_source=x → pathWithoutLocale이 '/artists?utm_source=x'라
  //     ko 전용 판정 자체가 실패 → 부족(이 PR이 고치려던 404가 그대로 남음)
  // utm은 예외가 아니라 유입의 기본값이라 실사용 영향이 크다. 판정은 쿼리·해시를
  // 뺀 경로로 하되, 생성하는 링크에는 쿼리·해시를 그대로 보존해야 한다(주문번호·
  // utm 모두 잃으면 안 되는 정보다) — 아래 각 케이스가 이 두 가지를 함께 본다.
  it('쿼리스트링이 있어도 ko 전용 판정이 과잉 탈출하지 않는다(/ko/funding/success?orderNo=A1)', () => {
    mockAsPath.current = '/ko/funding/success?orderNo=A1';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en/funding/success?orderNo=A1');
  });

  it('쿼리스트링이 있어도 ko 전용 판정이 빠지지 않는다(/ko/artists?utm_source=x)', () => {
    mockAsPath.current = '/ko/artists?utm_source=x';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en');
  });

  it('해시가 있어도 ko 전용 판정이 빠지지 않는다(/ko/funding#sec)', () => {
    mockAsPath.current = '/ko/funding#sec';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en');
  });

  it('쿼리스트링이 있어도 ko 전용이 아닌 라우트는 그대로 세그먼트 치환 + 쿼리 보존', () => {
    mockAsPath.current = '/ko/pricing?utm_source=x';
    render(<LanguageSwitcher currentLocale="ko" isFloating={false} variant="inline" />);
    fireEvent.click(screen.getByRole('button'));
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).toHaveAttribute('href', '/en/pricing?utm_source=x');
  });
});
