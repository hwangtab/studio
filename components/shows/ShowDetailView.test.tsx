import { render, screen } from '@testing-library/react';

import type { PublicShow } from '../../lib/shows/queries';
import ShowDetailView, { showCtaLabel } from './ShowDetailView';

jest.mock('../booking/useTossPaymentWidgets', () => ({
  useTossPaymentWidgets: () => ({ methodsId: 'm', agreementId: 'a', ready: true, error: null, retry: jest.fn(), requestPayment: jest.fn(), agreedRequiredTerms: null }),
}));
jest.mock('../../utils/reportPaymentFailure', () => ({ reportPaymentWindowOpen: jest.fn() }));
jest.mock('../../lib/navigationState', () => ({ hasNavigatedSinceLoad: () => false }));

const show: PublicShow = {
  slug: 's', title: '공연 제목', subtitle: '부제', presenterName: '주최측',
  performers: [{ name: '출연자', bio: '소개', photo: null, sns: null }],
  ageRating: '전체 관람가', runningMinutes: 100, venueName: '장소', venueAddress: '주소 1',
  description: '첫 문단\n\n둘째 문단', coverImage: '/images/shows/x.webp', ogImage: null,
  scheduleNote: '18:00 식사', onSitePriceNote: '현장 판매 안내', notices: ['안내 하나'], mapUrl: 'https://naver.me/x',
  cancelled: false,
  ticketTypes: [{ id: 'tt1', name: '사전 예매', price: 25000, zoneLabel: '비지정석' }],
  showtimes: [{ id: 'st1', startsAt: 2000000000, label: '10.24(토) 18:30', saleState: 'open', remaining: { tt1: 10 } }],
};

describe('ShowDetailView', () => {
  it('히어로·핵심 정보·소개·출연·예매·FAQ가 공연 데이터만으로 채워진다', () => {
    render(<ShowDetailView show={show} />);
    expect(screen.getByRole('heading', { level: 1, name: '공연 제목' })).toBeTruthy();
    expect(screen.getByText('부제')).toBeTruthy();
    expect(screen.getByText('18:00 식사')).toBeTruthy();
    expect(screen.getByText('현장 판매 안내')).toBeTruthy();
    expect(screen.getByText('안내 하나')).toBeTruthy();
    expect(screen.getByText('첫 문단')).toBeTruthy();
    expect(screen.getByText('출연자')).toBeTruthy();
    expect(screen.getByRole('link', { name: '네이버 지도에서 보기' }).getAttribute('href')).toBe('https://naver.me/x');
    expect(screen.getByRole('heading', { level: 2, name: '티켓 예매' })).toBeTruthy();
    expect(screen.getByText('티켓은 어떻게 받나요?')).toBeTruthy();
    // 예매 버튼은 히어로(데스크톱)·핵심 정보 패널·모바일 바 — 전부 #book 앵커다.
    const ctas = screen.getAllByRole('link', { name: '티켓 예매하기 · 25,000원' });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach((a) => expect(a.getAttribute('href')).toBe('#book'));
  });

  it('취소된 공연은 안내가 뜨고 예매 버튼이 없다', () => {
    render(<ShowDetailView show={{ ...show, cancelled: true, showtimes: [{ ...show.showtimes[0], saleState: 'cancelled' }] }} />);
    expect(showCtaLabel({ ...show, cancelled: true })).toEqual({ label: '취소된 공연입니다', bookable: false });
    expect(screen.getByRole('status')).toHaveTextContent('이 공연은 취소되었습니다');
    expect(screen.queryByRole('link', { name: /티켓 예매하기/ })).toBeNull();
  });
});
