import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactInfoCard from './ContactInfoCard';
import { trackLeadEvent } from '../../utils/analytics';
import type { SiteConfig } from '../../types/data';

jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
}));

const siteConfig: SiteConfig = {
  name: '스튜디오 놀',
  url: 'https://studionol.co.kr',
  logo: '/logo.png',
  description: '연신내 녹음실',
  vatNotice: '',
  contact: {
    address: '서울특별시 은평구 대조동 84-3',
    phone: '010-4255-7893',
    email: 'hwangtab@gmail.com',
    kakaoUrl: 'https://open.kakao.com/me/nol',
    naverMapUrl: 'https://naver.me/5gFZhS3X',
  },
};

const t = (key: string) => {
  const values: Record<string, string> = {
    'contact.info.title': '문의 정보',
    'contact.info.location': '위치',
    'contact.info.hours': '운영 시간',
    'contact.info.parking': '주차',
    'contact.info.parkingDetail': '인근 공영주차장',
    'contact.info.transport': '대중교통',
    'contact.info.transportDetail': '연신내역 도보 5분',
    'contact.hours.weekdaysLabel': '평일',
    'contact.hours.weekdaysTime': '10:00-23:59',
    'contact.hours.satLabel': '토요일',
    'contact.hours.satTime': '10:00-23:59',
    'contact.hours.sunLabel': '일요일',
    'contact.hours.sunTime': '10:00-23:59',
    'contact.directions.title': '오시는 길',
    'contact.directions.description': '연신내역에서 도보로 이동하세요.',
    'actions.kakao': '카카오톡',
  };
  return values[key] || key;
};

describe('ContactInfoCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders contact channels and tracks direct phone and Kakao clicks', () => {
    render(<ContactInfoCard locale="ko" siteConfig={siteConfig} t={t} />);

    expect(screen.getByRole('link', { name: /서울특별시 은평구/i })).toHaveAttribute(
      'href',
      siteConfig.contact.naverMapUrl
    );
    const phone = screen.getByRole('link', { name: /010-4255-7893/i });
    expect(phone).toHaveAttribute('href', 'tel:010-4255-7893');
    expect(screen.getByRole('link', { name: /hwangtab@gmail.com/i })).toHaveAttribute(
      'href',
      'mailto:hwangtab@gmail.com'
    );

    fireEvent.click(phone);
    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_phone', {
      locale: 'ko',
      component: 'ContactPage',
      cta_id: 'contact_info_phone',
    });

    fireEvent.click(screen.getByRole('link', { name: /카카오톡/i }));
    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'ko',
      component: 'ContactPage',
      cta_id: 'contact_info_kakao',
    });
  });

  it('uses locale-specific Google Maps language parameters', () => {
    render(<ContactInfoCard locale="zh" siteConfig={siteConfig} t={t} />);

    expect(screen.getByTitle('위치')).toHaveAttribute('src', expect.stringContaining('hl=zh-CN'));
  });
});
