import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Layout이 **어느 라우트에서** 카카오 FAB을 눌러 두는지 고정한다.
 *
 * 이 파일이 있는 이유: 억제 조건이 `/funding/[slug]/pledge`에 걸려 있었는데 전폭 하단
 * 고정 바를 실제로 쓰는 건 `/funding/[slug]`(상세)였다. 조건 옆 주석은 "후원 페이지에
 * 바가 떠 있다"고 적혀 있었지만 그 페이지는 바를 쓰지 않는다 — 틀린 주석이 조건을
 * 엉뚱한 라우트에 붙들어 두는 동안, 정작 겹치는 화면에서는 FAB이 「후원하기」 버튼을
 * 덮고 있었다. 주석은 이걸 못 막으므로 테스트로 고정한다.
 */

let pathname = '/[locale]/contact';

jest.mock('next/router', () => ({ useRouter: () => ({ pathname }) }));

// 전역 KakaoFab은 next/dynamic으로 불러온다. 라우트별 prop 전달을 보려면 실제로 렌더돼야
// 하므로, 넘어온 로더를 그대로 실행하는 대역을 쓴다.
jest.mock('next/dynamic', () => (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
  const Loaded = (props: Record<string, unknown>) => {
    const [C, setC] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
    React.useEffect(() => { void loader().then((m) => setC(() => m.default)); }, []);
    return C ? <C {...props} /> : null;
  };
  return Loaded;
});

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: jest.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../utils/analytics', () => ({ trackLeadEvent: jest.fn() }));

jest.mock('./layout/Header', () => ({
  Header: React.forwardRef<HTMLElement>(function MockHeader(_p, ref) {
    return <header ref={ref}>Header</header>;
  }),
}));
jest.mock('./layout/Footer', () => ({ Footer: () => <footer>Footer</footer> }));

import Layout from './Layout';

const renderAt = async (p: string, expectFab: boolean) => {
  pathname = p;
  const view = render(<Layout locale="ko">본문</Layout>);
  // dynamic 로더는 첫 호출에서 실제 모듈을 읽어 오므로 마이크로태스크 한 번으로는 부족하다.
  if (expectFab) await waitFor(() => expect(fab()).not.toBeNull());
  else await new Promise((r) => setTimeout(r, 20));
  return view;
};

const fab = () => document.querySelector('div.fixed.right-6') as HTMLElement | null;

describe('Layout의 카카오 FAB 억제', () => {
  afterEach(() => { document.documentElement.className = ''; });

  it('펀딩 상세에서는 <lg에서 FAB을 숨긴다 — 전폭 하단 바와 겹치는 유일한 화면이다', async () => {
    await renderAt('/[locale]/funding/[slug]', true);
    expect(fab()).not.toBeNull();
    expect(fab()!.className).toContain('hidden');
    expect(fab()!.className).toContain('lg:flex');
  });

  it('일반 페이지에서는 모든 폭에 FAB이 뜬다', async () => {
    await renderAt('/[locale]/contact', true);
    expect(fab()).not.toBeNull();
    expect(fab()!.className).not.toContain('hidden');
  });

  it('후원 페이지에서는 FAB 자체를 렌더하지 않는다 — 결제 한 건만 하러 오는 화면', async () => {
    await renderAt('/[locale]/funding/[slug]/pledge', false);
    expect(fab()).toBeNull();
  });
});
