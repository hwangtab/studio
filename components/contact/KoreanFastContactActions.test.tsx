import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import KoreanFastContactActions from './KoreanFastContactActions';
import { trackLeadEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
}));

describe('KoreanFastContactActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('surfaces Naver Map, KakaoTalk, and phone actions for local visitors', () => {
    render(
      <KoreanFastContactActions
        locale="ko"
        naverMapUrl="https://naver.me/5gFZhS3X"
        kakaoUrl="https://open.kakao.com/me/nol"
        phone="0507-1384-3144"
      />
    );

    const naver = screen.getByRole('link', { name: /네이버 지도/i });
    expect(naver).toHaveAttribute('href', 'https://naver.me/5gFZhS3X');
    expect(screen.getByRole('link', { name: /카카오톡/i })).toHaveAttribute(
      'href',
      'https://open.kakao.com/me/nol'
    );
    expect(screen.getByRole('link', { name: /전화/i })).toHaveAttribute('href', 'tel:0507-1384-3144');

    fireEvent.click(naver);
    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_naver_map', {
      locale: 'ko',
      component: 'KoreanFastContactActions',
      cta_id: 'ko_contact_fast_naver_map',
    });
  });
});
