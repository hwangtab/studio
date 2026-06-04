import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InlineBookingCallout from './InlineBookingCallout';
import InlineServiceCallout from './InlineServiceCallout';
import { trackLeadEvent } from '../../utils/analytics';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || _key,
  }),
}));

jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
}));

describe('inline CTA tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks Kakao clicks from service callouts with service context', () => {
    render(<InlineServiceCallout type="lesson" locale="ko" />);

    fireEvent.click(screen.getByRole('link', { name: /카카오톡으로 문의/ }));

    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'ko',
      component: 'InlineServiceCallout',
      cta_id: 'inline_service_lesson_kakao',
      service_type: 'lesson',
    });
  });

  it('tracks Kakao clicks from booking callouts with booking context', () => {
    render(<InlineBookingCallout message="EP 제작·발매 일정 상담" locale="ko" />);

    fireEvent.click(screen.getByRole('link', { name: /카카오톡으로 문의/ }));

    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'ko',
      component: 'InlineBookingCallout',
      cta_id: 'inline_booking_kakao',
      booking_message: 'EP 제작·발매 일정 상담',
    });
  });
});
