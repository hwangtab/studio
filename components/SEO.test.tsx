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
});
