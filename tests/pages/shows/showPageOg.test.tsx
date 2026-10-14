import { render } from '@testing-library/react';
import React from 'react';

jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ko/shows/s', locale: 'ko', pathname: '/[locale]/shows/[slug]', query: {} }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ko' } }) }));
jest.mock('../../../components/shows/ShowDetailView', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../lib/getStatic', () => ({ withI18nServerProps: jest.fn() }));
jest.mock('../../../lib/shows/queries', () => ({ getPublicShowBySlug: jest.fn() }));

import ShowPage from '../../../pages/[locale]/shows/[slug]';

const UPLOADED = '/api/funding/media/12-abc.webp?w=900&h=1260';

it('업로드 포스터는 절대 주소·크기 힌트로 og:image에 나간다', () => {
  const show = {
    slug: 's', title: '제목', subtitle: null, presenterName: 'p', performers: [], description: '소개', coverImage: UPLOADED, ogImage: null,
    venueName: 'v', venueAddress: 'a', ticketTypes: [], showtimes: [],
  } as never;
  render(<ShowPage show={show} locale="ko" />);
  const meta = (p: string) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content');
  expect(meta('og:image')).toBe(`https://studionol.co.kr${UPLOADED}`);
  expect(meta('og:image:width')).toBe('900');
  expect(meta('og:image:height')).toBe('1260');
});
