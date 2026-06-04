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
        phone="0507-1384-3144"
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
      'tel:0507-1384-3144'
    );

    fireEvent.click(kakao);
    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'en',
      component: 'EnglishFastContactActions',
      cta_id: 'en_contact_fast_kakao',
    });
  });
});
