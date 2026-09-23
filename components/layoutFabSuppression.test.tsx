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
    React.useEffect(() => { void loader().then((m) => setC(() => m.default ?? (m as unknown as React.ComponentType<Record<string, unknown>>))); }, []);
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
  if (expectFab) await waitFor(() => expect(kakaoFab()).not.toBeNull());
  else await new Promise((r) => setTimeout(r, 20));
  return view;
};

/** 우하단 플로팅 영역의 고정 컨테이너. 행으로 묶인 화면에서는 이게 행 자체다. */
const floatingRoot = () => document.querySelector('div.fixed.right-6') as HTMLElement | null;
/** KakaoFab 본체 — 행 안에서는 자기 고정 위치를 버리므로 링크로 찾는다. */
const kakaoFab = () => document.querySelector('a[aria-label="actions.kakaoFab"]') as HTMLElement | null;
/** KakaoFab의 폭 억제는 링크를 감싼 div가 든다. */
const fabGroup = () => kakaoFab()?.parentElement ?? null;
const scrollToTop = () => document.querySelector('button[aria-label="actions.scrollToTop"]') as HTMLElement | null;

describe('Layout의 카카오 FAB 억제', () => {
  afterEach(() => { document.documentElement.className = ''; });

  it('펀딩 상세에서는 <lg에서 FAB을 숨긴다 — 전폭 하단 바와 겹치는 유일한 화면이다', async () => {
    await renderAt('/[locale]/funding/[slug]', true);
    expect(fabGroup()!.className).toContain('hidden');
    expect(fabGroup()!.className).toContain('lg:flex');
  });

  it('일반 페이지에서는 모든 폭에 FAB이 뜬다', async () => {
    await renderAt('/[locale]/contact', true);
    expect(fabGroup()!.className).not.toContain('hidden');
  });

  it('후원 페이지에서는 FAB 자체를 렌더하지 않는다 — 결제 한 건만 하러 오는 화면', async () => {
    await renderAt('/[locale]/funding/[slug]/pledge', false);
    expect(kakaoFab()).toBeNull();
  });

  /**
   * 「맨 위로」와 FAB이 각자 떠 있으면 고정 영역이 세로로 두 밴드를 차지하고 본문 위에서
   * L자로 흩어져 보인다. 한 행으로 묶어 한 밴드로 줄인다 — 단, 전폭 하단 바가 뜨는
   * 화면에서는 묶으면 「맨 위로」가 바 뒤로 숨으므로 예전 자리(bottom-24)에 홀로 둔다.
   */
  it('일반 페이지에서는 「맨 위로」와 FAB이 같은 고정 행에 들어간다', async () => {
    await renderAt('/[locale]/contact', true);
    const root = floatingRoot()!;
    expect(root.contains(kakaoFab()!)).toBe(true);
    expect(root.contains(scrollToTop()!)).toBe(true);
    // 행이 위치를 한 번만 정한다 — 자식은 자기 고정 좌표를 갖지 않는다.
    expect(document.querySelectorAll('div.fixed.bottom-24')).toHaveLength(0);
  });

  it('스토리 상세에서는 행을 쓰지 않는다 — StickyBottomCTA가 바닥을 채운다', async () => {
    await renderAt('/[locale]/stories/[id]', false);
    expect(kakaoFab()).toBeNull();
    await waitFor(() => expect(scrollToTop()).not.toBeNull());
    expect(scrollToTop()!.closest('div.fixed.bottom-24')).not.toBeNull();
  });

  it('펀딩 상세에서도 행을 쓰지 않는다 — FundingMobileCta가 <lg에서 바닥을 채운다', async () => {
    await renderAt('/[locale]/funding/[slug]', true);
    expect(scrollToTop()!.closest('div.fixed.bottom-24')).not.toBeNull();
  });
});
