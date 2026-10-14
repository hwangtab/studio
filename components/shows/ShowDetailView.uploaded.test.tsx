import { render, screen } from '@testing-library/react';

import { fitsDisplayFont } from '../../lib/fonts/displayCoverage';
import type { PublicShow } from '../../lib/shows/queries';
import ShowDetailView from './ShowDetailView';

jest.mock('../payments/usePaymentCheckout', () => ({
  usePaymentCheckout: () => ({
    choice: 'card', setChoice: jest.fn(), applePaySupported: false, ready: true, error: null, requestPayment: jest.fn(),
  }),
}));
jest.mock('../../utils/reportPaymentFailure', () => ({ reportPaymentWindowOpen: jest.fn() }));
jest.mock('../../lib/navigationState', () => ({ hasNavigatedSinceLoad: () => false }));

const UPLOADED = '/api/funding/media/12-abc.webp?w=900&h=1260';
const base: PublicShow = {
  slug: 's', title: '공연 제목', subtitle: null, presenterName: '주최측',
  performers: [{ name: '출연자', bio: '소개', photo: UPLOADED, sns: null }],
  ageRating: '전체 관람가', runningMinutes: 100, venueName: '장소', venueAddress: '주소 1',
  description: '소개', coverImage: UPLOADED, ogImage: null, scheduleNote: null, onSitePriceNote: null, notices: [], mapLinks: {},
  cancelled: false,
  ticketTypes: [{ id: 'tt1', name: '사전 예매', price: 25000, zoneLabel: '비지정석' }],
  showtimes: [{ id: 'st1', startsAt: 2000000000, label: '10.24(토) 18:30', saleState: 'open', remaining: { tt1: 10 } }],
};

describe('ShowDetailView — 업로드 이미지와 DB 제목', () => {
  it('히어로·포스터·출연진 사진이 모두 /_next/image를 거치지 않는다', () => {
    const { container } = render(<ShowDetailView show={base} />);
    const srcs = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('src') ?? '');
    expect(srcs.length).toBeGreaterThanOrEqual(3);
    srcs.forEach((s) => expect(s).not.toContain('/_next/image'));
  });

  it('제목 서체에 없는 글자가 있으면 히어로 제목이 본문 서체로 그려진다', () => {
    const odd = '뷁🂡ǅ'; // 서브셋 밖 글자
    expect(fitsDisplayFont(odd)).toBe(false);
    render(<ShowDetailView show={{ ...base, title: `공연 ${odd}` }} />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('font-sans');
  });
});
