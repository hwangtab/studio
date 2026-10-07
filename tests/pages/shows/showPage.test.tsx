import { render } from '@testing-library/react';

import ShowPage from '../../../pages/[locale]/shows/[slug]';
import type { PublicShow } from '../../../lib/shows/queries';

jest.mock('../../../components/SEO', () => () => null);
jest.mock('../../../components/shows/ShowBookingForm', () => () => null);
jest.mock('../../../components/shows/ShowLineup', () => () => null);
jest.mock('../../../components/common/MobileStickyCta', () => () => null);
jest.mock('../../../lib/shows/queries', () => ({ getPublicShowBySlug: jest.fn() }));

const show = {
  slug: 'demo-show',
  title: '데모 공연',
  subtitle: null,
  presenterName: '스튜디오 놀',
  performers: [{ name: '출연자' }],
  ageRating: '전체관람가',
  runningMinutes: 90,
  venueName: '공연장',
  venueAddress: '서울',
  description: '소개 문단입니다.',
  coverImage: null,
  ogImage: null,
  scheduleNote: null,
  onSitePriceNote: null,
  notices: [],
  mapUrl: null,
  cancelled: false,
  ticketTypes: [{ id: 't1', name: '일반', price: 20000 }],
  showtimes: [{ id: 's1', startsAt: 1791600000, label: '10월 10일', saleState: 'open', remaining: { t1: 10 } }],
} as unknown as PublicShow;

// 2026-10-03: 출연진 변수를 schema보다 뒤에 선언해 서버 렌더가 TDZ ReferenceError로 500이 됐다.
it('공연 상세가 렌더에서 던지지 않는다', () => {
  expect(() => render(<ShowPage show={show} locale="ko" />)).not.toThrow();
});

it('영어 공연 상세도 렌더에서 던지지 않는다', () => {
  expect(() => render(<ShowPage show={show} locale="en" />)).not.toThrow();
});
