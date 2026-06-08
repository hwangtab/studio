import React from 'react';
import { render } from '@testing-library/react';

const useRouterMock = jest.fn();

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/router', () => ({
  useRouter: () => useRouterMock(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'seo.geoPlacename') return 'Eunpyeong-gu, Seoul';
      return key;
    },
  }),
}));

jest.mock('../lib/i18n', () => ({
  locales: ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'],
  defaultLocale: 'ko',
}));

import SEO from './SEO';

describe('SEO alternates', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    useRouterMock.mockReturnValue({
      asPath: '/en/stories/sample-story?from=test',
    });
  });

  it('renders canonical and alternate tags by default', () => {
    render(
      <SEO title="Sample Title" description="Sample Description" keywords="sample,seo" />
    );

    expect(document.head.querySelector('link[rel="canonical"]')).toBeTruthy();
    expect(document.head.querySelectorAll('link[rel="alternate"]').length).toBeGreaterThan(0);
    expect(document.head.innerHTML).toMatchSnapshot();
  });

  it('disables alternate tags while keeping canonical when requested', () => {
    render(
      <SEO
        title="Fallback Story"
        description="Fallback story should not advertise alternates"
        robots="noindex, follow"
        disableAlternates
      />
    );

    expect(document.head.querySelector('link[rel="canonical"]')).toBeTruthy();
    expect(document.head.querySelector('link[rel="alternate"]')).toBeNull();
  });

  it('keeps canonical query params in alternate URLs', () => {
    useRouterMock.mockReturnValue({
      asPath: '/ko/stories?page=2',
    });

    render(
      <SEO
        locale="ko"
        title="Stories Page 2"
        description="Paginated story list"
        canonical="/ko/stories?page=2"
      />
    );

    expect(document.head.querySelector('link[hreflang="ko"]')?.getAttribute('href'))
      .toBe('https://studionol.co.kr/ko/stories?page=2');
    expect(document.head.querySelector('link[hreflang="x-default"]')?.getAttribute('href'))
      .toBe('https://studionol.co.kr/ko/stories?page=2');
  });

  it('does not emit hreflang alternates when no indexable locale is available', () => {
    useRouterMock.mockReturnValue({
      asPath: '/en/stories/en-only',
    });

    render(
      <SEO
        locale="en"
        title="English Only"
        description="English only noindex page"
        canonical="/en/stories/en-only"
        availableLocales={['en'] as const}
      />
    );

    expect(document.head.querySelector('link[rel="alternate"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:locale:alternate"]')).toBeNull();
  });
});
