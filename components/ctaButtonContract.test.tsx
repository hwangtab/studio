import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import BookingEntryButton from './booking/BookingEntryButton';
import ContactCTA from './common/ContactCTA';
import HeroKakaoCta from './common/HeroKakaoCta';
import InlineBookingCallout from './inline/InlineBookingCallout';
import InlinePriceCallout from './inline/InlinePriceCallout';
import InlineServiceCallout from './inline/InlineServiceCallout';
import PricingCard from './ui/PricingCard';

/**
 * Task 4에서 전환 CTA 10종을 Button 프리미티브로 옮겼다. 이 테스트는 그 전환이
 * 되돌아가거나 variant를 잘못 고른 것을 렌더 결과에서 잡는다. 지키는 계약 셋:
 *  1) 옐로 버튼에는 반드시 text-kakao-ink가 따라온다 — 흰 글씨는 대비 1.3:1로 WCAG 미달이고,
 *     2026-08-13에 카카오 버튼이 색 없이 20시간 렌더된 사고가 있었다.
 *  2) 반경은 pill(rounded-full) 또는 block(rounded-xl) 하나만 — 둘이 섞이면 shape 충돌이다.
 *  3) 모든 버튼에 focus-visible:ring-2 — 마우스로는 드러나지 않는 결함이라 테스트로 고정.
 *  4) 목적지가 카카오톡이 아닌 링크에는 절대 bg-kakao가 붙지 않는다(비-ko는 /contact 폼).
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

jest.mock('framer-motion', () => {
  const R = jest.requireActual('react');
  const pass = (Tag: string) =>
    ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => {
      const dom = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !/^(initial|animate|whileInView|whileHover|whileTap|viewport|transition|variants)$/.test(k))
      );
      return R.createElement(Tag, dom, children);
    };
  return { m: { div: pass('div'), create: () => pass('a') } };
});

const KAKAO_URL = 'https://open.kakao.com/o/test';

// 팩토리로 두면 jsx-key 규칙에 걸리지 않고 케이스마다 새 엘리먼트를 쓴다.
const cases: Array<[string, () => React.ReactElement]> = [
  ['HeroKakaoCta ko', () => <HeroKakaoCta locale="ko" kakaoUrl={KAKAO_URL} component="c" ctaId="hero" label="카톡 상담" phone="010-4255-7893" />],
  ['HeroKakaoCta ko onSurface', () => <HeroKakaoCta locale="ko" kakaoUrl={KAKAO_URL} component="c" ctaId="hero" label="카톡 상담" phone="010-4255-7893" surface="onSurface" />],
  ['HeroKakaoCta en', () => <HeroKakaoCta locale="en" kakaoUrl={KAKAO_URL} component="c" ctaId="hero" label="L" contactLabel="Contact" />],
  ['ContactCTA ko', () => <ContactCTA locale="ko" title="t" subtitle="s" imageSrc="/i.webp" imageAlt="a" />],
  ['ContactCTA en', () => <ContactCTA locale="en" title="t" subtitle="s" imageSrc="/i.webp" imageAlt="a" />],
  ['BookingEntryButton', () => <BookingEntryButton service="recording" locale="ko" />],
  ['InlinePriceCallout', () => <InlinePriceCallout id="recording-pro" locale="ko" />],
  ['InlineServiceCallout', () => <InlineServiceCallout type="lesson" locale="ko" />],
  ['InlineBookingCallout', () => <InlineBookingCallout message="EP 제작 상담" locale="ko" />],
  ['PricingCard kakao', () => <PricingCard id="p" title="t" price="10" description="d" features={['f']} ctaLabel="카톡 문의" ctaHref={KAKAO_URL} trackingComponent="X" locale="ko" secondaryCtaLabel="온라인 예약" secondaryCtaHref="/ko/booking/recording" />],
  ['PricingCard non-kakao', () => <PricingCard id="p" title="t" price="10" description="d" features={['f']} ctaLabel="Contact" ctaHref="/en/contact" trackingComponent="X" locale="en" />],
];

describe('전환 CTA의 Button 계약', () => {
  it.each(cases)('%s', (label, makeElement) => {
    const { container } = render(makeElement());
    const buttons = Array.from(container.querySelectorAll('a, button')).filter((el) =>
      /\brounded-(full|xl)\b/.test(el.className)
    );
    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach((el) => {
      const cls = el.className;
      const where = `${label} > "${el.textContent?.trim()}": ${cls}`;

      // 반경은 한 종류만
      const radii = new Set(cls.match(/\brounded-(full|xl)\b/g));
      expect(`${where} | radii=${[...radii]}`).toMatch(/radii=rounded-(full|xl)$/);

      expect(where).toMatch(/focus-visible:ring-2/);
      expect(where).toMatch(/focus-visible:outline-none/);

      const href = el.getAttribute('href') ?? '';
      if (/\bbg-kakao\b/.test(cls)) {
        // 옐로 위 글씨는 항상 kakao-ink
        expect(where).toMatch(/\btext-kakao-ink\b/);
        expect(cls.replace(/dark:\S+/g, '')).not.toMatch(/\btext-white\b/);
        // 옐로는 카카오톡 목적지 전용
        expect(`${label} kakao href=${href}`).toMatch(/kakao/);
      } else if (href.includes('kakao')) {
        // 역방향: 카카오 목적지인데 옐로가 빠지면 2026-08-13 사고 재발
        throw new Error(`카카오 목적지인데 bg-kakao가 없다 — ${where}`);
      }
    });
  });
});
