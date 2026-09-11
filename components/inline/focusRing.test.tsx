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

// 배열에 엘리먼트를 그대로 담으면 react/jsx-key에 걸린다. 팩토리로 담고 테스트 안에서
// 호출하면 규칙을 끄지 않고 해소되고, 케이스마다 새 엘리먼트를 쓰게 되는 이점도 있다.
const cases: [string, () => React.ReactElement][] = [
  ['BookingEntryButton', () => <BookingEntryButton service="recording" locale="ko" />],
  ['InlineBookingCallout', () => <InlineBookingCallout message="EP 제작·발매 일정 상담" locale="ko" />],
  ['InlinePriceCallout', () => <InlinePriceCallout id="recording-pro" locale="ko" />],
  ['InlineServiceCallout', () => <InlineServiceCallout type="lesson" locale="ko" />],
];

describe('전환 CTA 포커스 링', () => {
  it.each(cases)('%s의 모든 링크·버튼에 focus-visible 링이 있다', (label, makeElement) => {
    const { container } = render(makeElement());
    const targets = container.querySelectorAll('a, button');
    expect(targets.length).toBeGreaterThan(0);
    targets.forEach((el) => {
      expect(`${label} > ${el.textContent?.trim()}: ${el.className}`).toMatch(/focus-visible:ring-2/);
      expect(`${label} > ${el.textContent?.trim()}: ${el.className}`).toMatch(/focus-visible:outline-none/);
    });
  });
});
