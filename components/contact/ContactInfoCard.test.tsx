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
  mailOrderSalesNumber: '',
  businessRegistrationNumber: '753-74-00653',
  contact: {
    address: '서울특별시 은평구 대조동 84-3',
    phone: '010-4255-7893',
    email: 'hello@studionol.co.kr',
    kakaoUrl: 'https://open.kakao.com/me/nol',
    naverMapUrl: 'https://naver.me/5gFZhS3X',
    naverPlaceUrl: 'https://map.naver.com/p/entry/place/1527843821',
    googleBusinessUrl: 'https://www.google.com/maps?cid=17692560696856302422',
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
    'contact.hours.everydayLabel': '매일',
    'contact.hours.weekdaysTime': '24시간 영업',
    'contact.hours.satLabel': '토요일',
    'contact.hours.satTime': '24시간 영업',
    'contact.hours.sunLabel': '일요일',
    'contact.hours.sunTime': '24시간 영업',
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
    expect(screen.getByRole('link', { name: /hello@studionol.co.kr/i })).toHaveAttribute(
      'href',
      'mailto:hello@studionol.co.kr'
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

  // 연중무휴 24시간이라 요일 셋이 같은 문구를 갖는다. 그대로 세 줄을 내면 같은 말이
  // 반복되므로 한 줄로 접는다. 요일별로 갈리면 다시 세 줄이어야 한다.
  it('collapses opening hours into one row when every day shares the same value', () => {
    render(<ContactInfoCard locale="ko" siteConfig={siteConfig} t={t} />);

    expect(screen.getByText('매일')).toBeInTheDocument();
    expect(screen.getAllByText('24시간 영업')).toHaveLength(1);
    expect(screen.queryByText('평일')).not.toBeInTheDocument();
  });

  it('keeps one row per day group when the hours differ', () => {
    const perDay = (key: string) => {
      const overrides: Record<string, string> = {
        'contact.hours.weekdaysTime': '10:00 - 24:00',
        'contact.hours.satTime': '12:00 - 22:00',
        'contact.hours.sunTime': '휴무',
      };
      return overrides[key] ?? t(key);
    };
    render(<ContactInfoCard locale="ko" siteConfig={siteConfig} t={perDay} />);

    expect(screen.getByText('평일')).toBeInTheDocument();
    expect(screen.getByText('12:00 - 22:00')).toBeInTheDocument();
    expect(screen.queryByText('매일')).not.toBeInTheDocument();
  });
});
