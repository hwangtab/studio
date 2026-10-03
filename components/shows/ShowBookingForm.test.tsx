import { render, screen } from '@testing-library/react';

import type { PublicShow } from '../../lib/shows/queries';
import ShowBookingForm from './ShowBookingForm';

jest.mock('../booking/useTossPaymentWidgets', () => ({
  useTossPaymentWidgets: () => ({
    methodsId: 'm', agreementId: 'a', ready: true, error: null, retry: jest.fn(), requestPayment: jest.fn(), agreedRequiredTerms: null,
  }),
}));
jest.mock('../../utils/reportPaymentFailure', () => ({ reportPaymentWindowOpen: jest.fn() }));

const showtime = (id: string, label: string) => ({ id, startsAt: 2000000000, label, saleState: 'open' as const, remaining: { tt1: 30, tt2: 30 } });
const ticket = (id: string, name: string, price: number) => ({ id, name, price, zoneLabel: '비지정석' });

const base: PublicShow = {
  slug: 's', title: '공연', presenterName: '주최', performers: '출연', ageRating: '전체', runningMinutes: 100,
  venueName: '장소', venueAddress: '주소', description: '소개', coverImage: null, cancelled: false,
  ticketTypes: [ticket('tt1', '사전 예매', 25000)],
  showtimes: [showtime('st1', '10.24(토) 18:30')],
};

describe('ShowBookingForm — 동의·선택 최소화', () => {
  it('체크박스를 두지 않고, 결제하기를 누르면 동의하는 것으로 본다는 고지 한 줄만 둔다', () => {
    render(<ShowBookingForm show={base} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(/결제하기를 누르면 취소·환불 규정과/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '개인정보 처리방침' }).getAttribute('href')).toBe('/ko/privacy-policy');
    // 취소·환불 규정은 접혀 있다 — 열어야 표가 보인다.
    expect(screen.getByText('취소·환불 규정 보기')).toBeTruthy();
  });

  it('회차와 티켓이 하나뿐이면 라디오 대신 요약 한 줄을 보여 준다', () => {
    render(<ShowBookingForm show={base} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('10.24(토) 18:30')).toBeTruthy();
    expect(screen.getByText(/사전 예매 25,000원/)).toBeTruthy();
  });

  it('회차나 티켓이 여럿이면 고르게 한다', () => {
    render(
      <ShowBookingForm
        show={{ ...base, ticketTypes: [ticket('tt1', '일반', 20000), ticket('tt2', '후원', 30000)], showtimes: [showtime('st1', '10.24(토) 18:30'), showtime('st2', '10.25(일) 18:30')] }}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });
});
