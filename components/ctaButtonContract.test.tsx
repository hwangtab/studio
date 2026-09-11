import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import BookingEntryButton from './booking/BookingEntryButton';
import ContactCTA from './common/ContactCTA';
import HeroKakaoCta from './common/HeroKakaoCta';
import KakaoFab from './common/KakaoFab';
import ContactFormCard from './contact/ContactFormCard';
import ContactFormErrorFallback from './contact/ContactFormErrorFallback';
import EnglishFastContactActions from './contact/EnglishFastContactActions';
import KoreanFastContactActions from './contact/KoreanFastContactActions';
import InlineBookingCallout from './inline/InlineBookingCallout';
import InlinePriceCallout from './inline/InlinePriceCallout';
import InlineServiceCallout from './inline/InlineServiceCallout';
import StickyBottomCTA from './inline/StickyBottomCTA';
import HeaderActions from './layout/HeaderActions';
import ReleaseHeroCtas from './release/ReleaseHeroCtas';
import OnlineRequest from './story/OnlineRequest';
import VocalMixBridge from './story/VocalMixBridge';
import PricingCard from './ui/PricingCard';
import NotFoundPage from '../pages/404';
import ServerErrorPage from '../pages/500';
import { getSiteConfig } from '../data/siteConfig';

/**
 * Task 4에서 전환 CTA를 Button 프리미티브로 옮겼다. 이 테스트는 그 전환이 되돌아가거나
 * variant를 잘못 고른 것을 **렌더 결과**에서 잡는다. 지키는 계약 넷:
 *
 *  1) 카카오 목적지(href에 'kakao')인 링크에는 반드시 bg-kakao + text-kakao-ink가 있다.
 *     역방향 규칙이 핵심이다 — 2026-08-13 사고는 카카오 버튼이 "색이 다른" 게 아니라
 *     **스타일이 통째로 빠진 채** 20시간 렌더된 형태였다. 그래서 후보를 반경으로 거르지
 *     않고 `a[href]`·`button` 전체에서 잡는다(반경으로 걸렀다면 스타일이 빠진 링크는
 *     애초에 검사 대상에서 탈락해 이 사고를 못 잡는다).
 *  2) 반대로 bg-kakao가 붙은 것의 목적지는 반드시 카카오톡이어야 한다 — 비-ko는 /contact
 *     폼으로 가므로 옐로가 새면 안 된다(CLAUDE.md 카카오 배색 규칙).
 *  3) 카카오 링크 개수를 케이스마다 고정한다. 형제 버튼이 남아 "하나라도 있으면 통과"로
 *     무성이 되는 것을 막는다.
 *  4) 버튼형(반경 보유) 엘리먼트는 반경이 pill·block 중 하나뿐이고, 모든 링크·버튼에
 *     focus-visible 링이 있다.
 */
jest.mock('react-i18next', () => ({
  // 404·500이 lib/i18n을 타고 들어오므로 initReactI18next도 함께 내줘야 한다.
  initReactI18next: { type: '3rdParty', init: () => {} },
  I18nextProvider: ({ children }: { children?: unknown }) => children,
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => {
      if (typeof options === 'string') return options;
      return options?.defaultValue ?? key;
    },
  }),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ asPath: '/ko/does-not-exist', push: jest.fn(), events: { on: jest.fn(), off: jest.fn() } }),
}));

jest.mock('framer-motion', () => {
  const R = jest.requireActual('react');
  const MOTION_PROPS = /^(initial|animate|exit|whileInView|whileHover|whileTap|whileFocus|viewport|transition|variants|layout|layoutId)$/;
  const pass = (Tag: string) =>
    ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
      R.createElement(Tag, Object.fromEntries(Object.entries(rest).filter(([k]) => !MOTION_PROPS.test(k))), children);
  return {
    m: { div: pass('div'), h1: pass('h1'), p: pass('p'), nav: pass('nav'), span: pass('span'), a: pass('a'), button: pass('button'), create: () => pass('a') },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    LazyMotion: ({ children }: { children?: React.ReactNode }) => children,
    domAnimation: {},
  };
});

const KAKAO_URL = 'https://open.kakao.com/o/test';

/** StickyBottomCTA는 marker가 viewport 위로 올라가야 렌더된다 — 그 트리거를 재현한다. */
const renderStickyBottomCTA = (): HTMLElement => {
  let trigger: ((entries: Partial<IntersectionObserverEntry>[]) => void) | null = null;
  const original = global.IntersectionObserver;
  // @ts-expect-error 테스트용 전역 mock
  global.IntersectionObserver = function (cb: IntersectionObserverCallback) {
    trigger = (entries) => cb(entries as IntersectionObserverEntry[], {} as IntersectionObserver);
    return { observe: () => {}, unobserve: () => {}, disconnect: () => {} };
  };
  const Harness = () => {
    const ref = React.useRef<HTMLDivElement>(null);
    return (
      <>
        <div ref={ref} />
        <StickyBottomCTA markerRef={ref} locale="ko" />
      </>
    );
  };
  const { container } = render(<Harness />);
  act(() => {
    trigger!([{ isIntersecting: false, boundingClientRect: { top: -100 } as DOMRectReadOnly }]);
  });
  global.IntersectionObserver = original;
  return container;
};

const renderOf = (element: React.ReactElement) => (): HTMLElement => render(element).container;

const tStub = ((key: string, options?: string | { defaultValue?: string }) => {
  if (typeof options === 'string') return options;
  return options?.defaultValue ?? key;
}) as never;

/** HeaderActions는 LanguageSwitcher를 품는다 — 그쪽 반경·포커스는 이 계약의 관심사가 아니다. */
jest.mock('./LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}));

const renderHeaderActions = (locale: 'ko' | 'en', isTransparent: boolean) =>
  renderOf(
    <HeaderActions
      isTransparent={isTransparent}
      isDarkMode={false}
      toggleDarkMode={() => {}}
      locale={locale}
      t={tStub}
      siteConfig={getSiteConfig(locale)}
      isMenuOpen={false}
      setIsMenuOpen={() => {}}
      mobileNavId="nav"
    />,
  );

/** /contact 폼 카드. ko는 KoreanFastContactActions, en은 EnglishFastContactActions를 함께 렌더한다. */
const renderContactFormCard = (locale: 'ko' | 'en') =>
  renderOf(
    <ContactFormCard
      locale={locale}
      siteConfig={getSiteConfig(locale)}
      t={tStub}
      validationCopy={{ errorsFound: 'errors' }}
      formData={{ name: '', email: '', phone: '', message: '', company: '' }}
      errors={{ name: '', email: '', phone: '', message: '' }}
      submitMessage=""
      isSubmitSuccess={false}
      isSubmitting={false}
      canRetrySubmit={false}
      retryLabel="다시 시도"
      errorCount={0}
      noticeItems={null}
      onChange={() => {}}
      onBlur={() => {}}
      onSubmit={async () => {}}
      onRetrySubmit={() => {}}
    />,
  );

/** [라벨, 렌더 팩토리, 이 화면에 있어야 할 카카오 목적지 링크 수] */
const cases: Array<[string, () => HTMLElement, number]> = [
  ['HeroKakaoCta ko onImage', renderOf(<HeroKakaoCta locale="ko" kakaoUrl={KAKAO_URL} component="c" ctaId="hero" label="카톡 상담" phone="010-4255-7893" />), 1],
  ['HeroKakaoCta ko onSurface', renderOf(<HeroKakaoCta locale="ko" kakaoUrl={KAKAO_URL} component="c" ctaId="hero" label="카톡 상담" phone="010-4255-7893" surface="onSurface" />), 1],
  ['HeroKakaoCta en (옐로 금지)', renderOf(<HeroKakaoCta locale="en" kakaoUrl={KAKAO_URL} component="c" ctaId="hero" label="L" contactLabel="Contact" />), 0],
  // 사진 패널 링크도 카카오로 가지만 버튼이 아니라 계약 대상이 아니다(isImageLink 참조).
  ['ContactCTA ko', renderOf(<ContactCTA locale="ko" title="t" subtitle="s" imageSrc="/i.webp" imageAlt="a" />), 1],
  ['ContactCTA en (옐로 금지)', renderOf(<ContactCTA locale="en" title="t" subtitle="s" imageSrc="/i.webp" imageAlt="a" />), 0],
  ['BookingEntryButton', renderOf(<BookingEntryButton service="recording" locale="ko" />), 0],
  ['InlinePriceCallout', renderOf(<InlinePriceCallout id="recording-pro" locale="ko" />), 1],
  ['InlineServiceCallout', renderOf(<InlineServiceCallout type="lesson" locale="ko" />), 1],
  ['InlineBookingCallout', renderOf(<InlineBookingCallout message="EP 제작 상담" locale="ko" />), 1],
  // 전 스토리 페이지에 뜨는 최대 노출 표면 — 데스크톱 라벨 + 모바일 아이콘 2개.
  ['StickyBottomCTA', renderStickyBottomCTA, 2],
  ['PricingCard kakao+2차', renderOf(<PricingCard id="p" title="t" price="10" description="d" features={['f']} ctaLabel="카톡 문의" ctaHref={KAKAO_URL} trackingComponent="X" locale="ko" secondaryCtaLabel="온라인 예약" secondaryCtaHref="/ko/booking/recording" />), 1],
  ['PricingCard 비-kakao (옐로 금지)', renderOf(<PricingCard id="p" title="t" price="10" description="d" features={['f']} ctaLabel="Contact" ctaHref="/en/contact" trackingComponent="X" locale="en" />), 0],
  ['404', renderOf(<NotFoundPage />), 0],
  ['500', renderOf(<ServerErrorPage />), 0],

  // 아래는 2026-09-11 최종 리뷰에서 "손으로 짠 카카오 버튼이라 계약 밖에 있었다"고
  // 지목된 표면들이다. 헤더는 전 페이지에 뜨는 최고 노출 자리라 누락 비용이 가장 컸다.
  ['HeaderActions ko (solid)', renderHeaderActions('ko', false), 1],
  ['HeaderActions ko (transparent)', renderHeaderActions('ko', true), 1],
  ['HeaderActions en (옐로 금지)', renderHeaderActions('en', false), 0],
  ['ReleaseHeroCtas ko', renderOf(<ReleaseHeroCtas locale="ko" kakaoUrl={KAKAO_URL} consultLabel="상담" secondaryHref="/ko/portfolio" secondaryLabel="포트폴리오" />), 1],
  ['ReleaseHeroCtas en (옐로 금지)', renderOf(<ReleaseHeroCtas locale="en" kakaoUrl={KAKAO_URL} consultLabel="Consult" secondaryHref="/en/portfolio" secondaryLabel="Portfolio" />), 0],
  // 폼 카드는 제출 버튼 옆 카카오 + 상단 빠른 연락 블록의 카카오, 둘 다 노란색이어야 한다.
  ['ContactFormCard ko', renderContactFormCard('ko'), 2],
  ['ContactFormCard en', renderContactFormCard('en'), 2],
  ['KoreanFastContactActions', renderOf(<KoreanFastContactActions locale="ko" naverMapUrl="https://map.naver.com/x" kakaoUrl={KAKAO_URL} phone="010-4255-7893" />), 1],
  ['EnglishFastContactActions', renderOf(<EnglishFastContactActions locale="en" kakaoUrl={KAKAO_URL} email="hello@studionol.co.kr" phone="010-4255-7893" />), 1],
  ['ContactFormErrorFallback', renderOf(<ContactFormErrorFallback locale="ko" kakaoUrl={KAKAO_URL} phone="010-4255-7893" email="hello@studionol.co.kr" t={tStub} />), 1],
  ['OnlineRequest', renderOf(<OnlineRequest locale="ko" />), 1],
  ['VocalMixBridge', renderOf(<VocalMixBridge locale="ko" />), 1],
  // FAB은 로케일과 무관하게 카카오 오픈채팅으로 간다(분기가 없다) — 양쪽 모두 옐로가 정답.
  ['KakaoFab ko', renderOf(<KakaoFab locale="ko" />), 1],
  ['KakaoFab en', renderOf(<KakaoFab locale="en" />), 1],
];

const hasKakaoStyle = (cls: string) => /\bbg-kakao\b/.test(cls);
/**
 * 이미지 전체를 감싼 링크(ContactCTA의 사진 패널)는 목적지가 카카오톡이어도 버튼이 아니다 —
 * 배경색을 칠하면 사진을 덮는다. 버튼 계약에서 제외하되, 판정 근거를 "img/picture를 품고
 * 있다"는 구조로 좁혀 둔다(라벨이나 클래스 이름 같은 느슨한 기준을 쓰지 않는다).
 */
const isImageLink = (el: Element) => el.querySelector('img, picture') !== null;
const isKakaoDestination = (el: Element) =>
  (el.getAttribute('href') ?? '').includes('kakao') && !isImageLink(el);

describe('전환 CTA의 Button 계약', () => {
  it.each(cases)('%s', (label, renderCase, expectedKakaoLinks) => {
    const container = renderCase();

    // 후보를 반경으로 거르지 않는다 — 스타일이 통째로 빠진 링크도 반드시 검사에 들어와야 한다.
    const candidates = Array.from(container.querySelectorAll('a[href], button'));
    expect(candidates.length).toBeGreaterThan(0);

    const kakaoDestinations = candidates.filter(isKakaoDestination);
    const kakaoStyled = candidates.filter((el) => hasKakaoStyle(el.className));

    // (3) 개수 고정 — 형제 버튼이 남아 무성이 되는 것을 막는다.
    expect(
      `${label}: 카카오 목적지 링크 ${kakaoDestinations.length}개 (기대 ${expectedKakaoLinks})`
    ).toBe(`${label}: 카카오 목적지 링크 ${expectedKakaoLinks}개 (기대 ${expectedKakaoLinks})`);

    // (2) 옐로는 카카오톡 목적지 전용 — 비-ko /contact 폼에 새면 안 된다.
    kakaoStyled.forEach((el) => {
      expect(`${label} > bg-kakao인데 href=${el.getAttribute('href')}`).toMatch(/kakao/);
    });

    // (1) 역방향 — 카카오 목적지인데 옐로가 빠지면 2026-08-13 사고 재발.
    kakaoDestinations.forEach((el) => {
      const where = `${label} > "${el.textContent?.trim()}": ${el.className}`;
      if (!hasKakaoStyle(el.className)) {
        throw new Error(`카카오 목적지인데 bg-kakao가 없다 — ${where}`);
      }
      // 옐로 위 글씨는 항상 kakao-ink(흰 글씨는 대비 1.3:1로 WCAG 미달).
      expect(where).toMatch(/\btext-kakao-ink\b/);
      expect(where.replace(/dark:\S+/g, '')).not.toMatch(/\btext-white\b/);
    });

    // (4) 반경 단일성 + 포커스 링
    candidates.forEach((el) => {
      const cls = el.className;
      const where = `${label} > "${el.textContent?.trim()}": ${cls}`;
      const radii = new Set(cls.match(/\brounded-(?:full|xl|2xl|lg)\b/g) ?? []);
      expect(`${where} | radii=${[...radii].join(',')}`).toMatch(/radii=(rounded-(?:full|xl))?$/);
      expect(where).toMatch(/focus-visible:ring-2/);
      expect(where).toMatch(/focus-visible:outline-none/);
    });
  });
});
