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
    useRouterMock.mockReturnValue({
      asPath: '/en/stories/sample-story?from=test',
    });
  });

  it('renders canonical and alternate tags by default', () => {
    const { container } = render(
      <SEO title="Sample Title" description="Sample Description" keywords="sample,seo" />
    );

    expect(container.querySelector('link[rel="canonical"]')).toBeTruthy();
    expect(container.querySelectorAll('link[rel="alternate"]').length).toBeGreaterThan(0);
    expect(container).toMatchSnapshot();
  });

  it('disables alternate tags while keeping canonical when requested', () => {
    const { container } = render(
      <SEO
        title="Fallback Story"
        description="Fallback story should not advertise alternates"
        robots="noindex, follow"
        disableAlternates
      />
    );

    expect(container.querySelector('link[rel="canonical"]')).toBeTruthy();
    expect(container.querySelector('link[rel="alternate"]')).toBeNull();
  });
});
