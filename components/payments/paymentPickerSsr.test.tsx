/** @jest-environment node */
import { renderToString } from 'react-dom/server';

import ShowBookingForm from '../shows/ShowBookingForm';
import type { PublicShow } from '../../lib/shows/queries';

/**
 * 판정 전(서버 렌더·하이드레이션 첫 패스)에는 결제수단 구획을 같은 높이의 빈 자리로 둔다 —
 * 옛 선택지(카드·간편결제/계좌)가 한 프레임 보였다가 목록으로 바뀌는 깜빡임을 막는다.
 */
const show: PublicShow = {
  slug: 's', title: '공연', subtitle: null, presenterName: '주최', performers: [{ name: '출연' }], ageRating: '전체', runningMinutes: 100,
  venueName: '장소', venueAddress: '주소', description: '소개', coverImage: null, ogImage: null, scheduleNote: null, onSitePriceNote: null,
  notices: [], mapLinks: {}, cancelled: false,
  ticketTypes: [{ id: 'tt1', name: '사전 예매', price: 25000, zoneLabel: '비지정석' }],
  showtimes: [{ id: 'st1', startsAt: 2000000000, label: '10.24(토) 18:30', saleState: 'open', remaining: { tt1: 30 } }],
};

it('서버 HTML에는 옛 선택지도 목록도 없이 빈 자리만 있다', () => {
  const html = renderToString(<ShowBookingForm show={show} />);
  expect(html).toContain('payment-method-skeleton');
  expect(html).not.toContain('카드·간편결제');
  expect(html).not.toContain('신용·체크카드');
});
