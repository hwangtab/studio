import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnglishFastContactActions from './EnglishFastContactActions';
import { trackLeadEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
}));

describe('EnglishFastContactActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('puts direct Kakao, email, and phone actions before the English form path', () => {
    render(
      <EnglishFastContactActions
        locale="en"
        kakaoUrl="https://open.kakao.com/me/nol"
        email="hwangtab@gmail.com"
        phone="010-4255-7893"
      />
    );

    const kakao = screen.getByRole('link', { name: /message on kakaotalk/i });
    expect(kakao).toHaveAttribute('href', 'https://open.kakao.com/me/nol');
    expect(screen.getByRole('link', { name: /email studio nol/i })).toHaveAttribute(
      'href',
      'mailto:hwangtab@gmail.com'
    );
    expect(screen.getByRole('link', { name: /call studio nol/i })).toHaveAttribute(
      'href',
      'tel:010-4255-7893'
    );

    fireEvent.click(kakao);
    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'en',
      component: 'EnglishFastContactActions',
      cta_id: 'en_contact_fast_kakao',
    });
  });

  it('shows a pricing anchor linking to the localized pricing page', () => {
    render(
      <EnglishFastContactActions
        locale="en"
        kakaoUrl="https://open.kakao.com/me/nol"
        email="hwangtab@gmail.com"
        phone="010-4255-7893"
      />
    );

    expect(screen.getByRole('link', { name: /see transparent pricing/i })).toHaveAttribute(
      'href',
      '/en/pricing'
    );
  });
});
