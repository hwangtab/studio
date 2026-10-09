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

/** 휴대폰 하단 전폭 바(KakaoFab bar) — 링크에 aria-label 대신 보이는 글자가 이름이다. */
const mobileBar = () => document.querySelector('div.fixed.inset-x-0.bottom-0.lg\\:hidden') as HTMLElement | null;

beforeAll(() => {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('Layout의 카카오 FAB 억제', () => {
  afterEach(() => { document.documentElement.className = ''; });

  it('펀딩 상세에서는 <lg에서 FAB을 숨긴다 — 전폭 하단 바와 겹치는 유일한 화면이다', async () => {
    await renderAt('/[locale]/funding/[slug]', true);
    expect(fabGroup()!.className).toContain('hidden');
    expect(fabGroup()!.className).toContain('lg:flex');
  });

  it('일반 페이지: 데스크톱은 우하단 행, 휴대폰은 하단 전폭 바(전화·카톡)', async () => {
    await renderAt('/[locale]/contact', true);
    expect(floatingRoot()!.className).toContain('hidden');
    expect(floatingRoot()!.className).toContain('lg:flex');
    const bar = mobileBar();
    expect(bar).not.toBeNull();
    // 보이는 글자가 곧 이름이다(aria-label로 다른 이름을 덮지 않는다 — WCAG 2.5.3).
    expect(bar!.querySelector('a[aria-label]')).toBeNull();
    expect(bar!.textContent).toContain('actions.call');
    expect(bar!.textContent).toContain('actions.kakaoFab');
    // 휴대폰 바에는 「맨 위로」를 두지 않는다.
    expect(bar!.querySelector('button[aria-label="actions.scrollToTop"]')).toBeNull();
    // 휴대폰 메뉴(z-40)보다 아래 층 — 메뉴를 열면 메뉴가 바를 덮는다.
    expect(bar!.className).toContain('z-30');
  });

  it('본문 카톡 블록(ContactCTA·노란 띠)이 보이는 동안 떠 있는 카톡 바를 숨긴다 — 한 화면에 카톡 버튼 하나', async () => {
    await renderAt('/[locale]/contact', true);
    Object.defineProperty(window, 'scrollY', { value: 1000, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(mobileBar()!.getAttribute('aria-hidden')).toBe('false'));
    window.dispatchEvent(new CustomEvent('studio:kakao-block-visibility', { detail: true }));
    await waitFor(() => expect(mobileBar()!.getAttribute('aria-hidden')).toBe('true'));
    window.dispatchEvent(new CustomEvent('studio:kakao-block-visibility', { detail: false }));
    await waitFor(() => expect(mobileBar()!.getAttribute('aria-hidden')).toBe('false'));
  });

  it('입력칸에 커서가 있는 동안 하단 바를 숨긴다 — 키보드 위로 떠서 입력칸을 가리지 않게', async () => {
    await renderAt('/[locale]/contact', true);
    Object.defineProperty(window, 'scrollY', { value: 1000, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    const input = document.createElement('input');
    document.body.appendChild(input);
    await waitFor(() => expect(mobileBar()!.getAttribute('aria-hidden')).toBe('false'));
    input.focus();
    await waitFor(() => expect(mobileBar()!.getAttribute('aria-hidden')).toBe('true'));
    input.blur();
    await waitFor(() => expect(mobileBar()!.getAttribute('aria-hidden')).toBe('false'));
    input.remove();
  });

  it('하단 바가 있는 화면(스토리·펀딩·공연 상세)에는 이 전폭 바를 띄우지 않는다', async () => {
    await renderAt('/[locale]/funding/[slug]', true);
    expect(mobileBar()).toBeNull();
  });

  it('후원 페이지에서는 FAB 자체를 렌더하지 않는다 — 결제 한 건만 하러 오는 화면', async () => {
    await renderAt('/[locale]/funding/[slug]/pledge', false);
    expect(kakaoFab()).toBeNull();
  });

  it('예약·주문 마법사에서도 FAB을 렌더하지 않는다 — 곡 수 select 위에 겹쳤다', async () => {
    await renderAt('/[locale]/booking/[service]', false);
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

  it('펀딩 상세에서도 행을 쓰지 않는다 — MobileStickyCta가 <lg에서 바닥을 채운다', async () => {
    await renderAt('/[locale]/funding/[slug]', true);
    expect(scrollToTop()!.closest('div.fixed.bottom-24')).not.toBeNull();
  });
});
