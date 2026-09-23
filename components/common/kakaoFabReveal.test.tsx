import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import KakaoFab from './KakaoFab';

/**
 * 히어로 CTA ↔ 전역 카카오 FAB 겹침을 고정한다.
 *
 * 홈·pricing·recording 히어로는 CTA 블록이 뷰포트 하단에 놓이는데 FAB 자리가 정확히
 * 거기라, 모바일에서 히어로 CTA 두 개를 통째로 덮고 있었다. 히어로 1차 버튼이 이미
 * 카카오 목적지라 같은 목적지 버튼이 자기 자신을 가리는 상태였다.
 *
 * 고친 방식 둘:
 * 1. 스크롤 임계(300px)를 넘어야 FAB이 뜬다 — 첫 화면 진입점은 헤더 옐로 CTA가 맡는다.
 * 2. <sm에서는 라벨을 떼고 원형으로 줄인다 — 알약 폭이 화면 절반을 먹어 본문을 가렸다.
 *
 * 둘 다 눈으로만 확인되던 것이라 여기서 고정한다. 억제 prop(suppressBelowLg)과
 * z-40 규약은 mobileCtaFabCollision.test.tsx가 따로 지킨다.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../utils/analytics', () => ({ trackLeadEvent: jest.fn() }));

const fabRoot = () => document.querySelector('div.fixed.right-6') as HTMLElement;

/** rAF 스로틀을 동기로 흘려보낸 뒤 scrollY를 바꿔 스크롤을 재현한다. */
const scrollTo = (y: number) => {
  act(() => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  });
};

beforeEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('히어로 CTA ↔ 카카오 FAB 겹침', () => {
  it('첫 화면에서는 FAB이 보이지 않는다 — 히어로 CTA를 덮던 자리다', () => {
    render(<KakaoFab locale="ko" />);
    const cls = fabRoot().className;
    expect(cls).toContain('opacity-0');
    expect(cls).toContain('pointer-events-none');
    expect(fabRoot()).toHaveAttribute('aria-hidden', 'true');
  });

  it('보이지 않는 동안에는 탭 순서에서도 빠진다', () => {
    render(<KakaoFab locale="ko" />);
    const links = fabRoot().querySelectorAll('a');
    expect(links).toHaveLength(2);
    links.forEach((a) => expect(a).toHaveAttribute('tabindex', '-1'));
  });

  it('임계를 넘겨 스크롤하면 뜬다', () => {
    render(<KakaoFab locale="ko" />);
    scrollTo(400);
    const cls = fabRoot().className;
    expect(cls).toContain('opacity-100');
    expect(cls).not.toContain('pointer-events-none');
    expect(fabRoot()).toHaveAttribute('aria-hidden', 'false');
    fabRoot().querySelectorAll('a').forEach((a) => expect(a).toHaveAttribute('tabindex', '0'));
  });

  it('임계 아래로 되돌아오면 다시 숨는다', () => {
    render(<KakaoFab locale="ko" />);
    scrollTo(400);
    scrollTo(10);
    expect(fabRoot().className).toContain('opacity-0');
  });

  it('<sm에서는 카카오 라벨을 감춰 폭을 원형으로 줄인다', () => {
    render(<KakaoFab locale="ko" />);
    const kakao = fabRoot().querySelectorAll('a')[1];
    const label = kakao.querySelector('span') as HTMLElement;
    expect(label.className).toContain('hidden');
    expect(label.className).toContain('sm:inline');
    // 라벨이 빠져도 읽어 줄 이름은 남아야 한다.
    expect(kakao).toHaveAttribute('aria-label');
    expect(kakao.className).toContain('w-[52px]');
    expect(kakao.className).toContain('sm:w-auto');
  });
});
