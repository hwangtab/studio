import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import BookingEntryButton from '../booking/BookingEntryButton';
import InlineBookingCallout from './InlineBookingCallout';
import InlinePriceCallout from './InlinePriceCallout';
import InlineServiceCallout from './InlineServiceCallout';

/**
 * 전환 CTA에 키보드 포커스 링이 있는지 지킨다. 2026-09-11 감사에서 네 곳이
 * focus-visible 링 없이 배포돼 있었다 — 마우스로는 드러나지 않는 결함이라
 * 테스트로 고정한다. Task 4의 Button 전환 때 이 테스트가 안전망이 된다.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || _key,
  }),
}));

const cases: [string, React.ReactElement][] = [
  ['BookingEntryButton', <BookingEntryButton service="recording" locale="ko" />],
  ['InlineBookingCallout', <InlineBookingCallout message="EP 제작·발매 일정 상담" locale="ko" />],
  ['InlinePriceCallout', <InlinePriceCallout id="recording-pro" locale="ko" />],
  ['InlineServiceCallout', <InlineServiceCallout type="lesson" locale="ko" />],
];

describe('전환 CTA 포커스 링', () => {
  it.each(cases)('%s의 모든 링크·버튼에 focus-visible 링이 있다', (label, element) => {
    const { container } = render(element);
    const targets = container.querySelectorAll('a, button');
    expect(targets.length).toBeGreaterThan(0);
    targets.forEach((el) => {
      expect(`${label} > ${el.textContent?.trim()}: ${el.className}`).toMatch(/focus-visible:ring-2/);
      expect(`${label} > ${el.textContent?.trim()}: ${el.className}`).toMatch(/focus-visible:outline-none/);
    });
  });
});
