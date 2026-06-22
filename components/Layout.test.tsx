import React from 'react';
import { render, screen } from '@testing-library/react';
import Layout from './Layout';

jest.mock('next/dynamic', () => () => {
  const DynamicNoop = () => null;
  return DynamicNoop;
});

jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/[locale]/contact' }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('./layout/Header', () => ({
  Header: React.forwardRef<HTMLElement>(function MockHeader(_props, ref) {
    return (
      <header ref={ref}>Header</header>
    );
  }),
}));

jest.mock('./layout/Footer', () => ({
  Footer: function MockFooter() {
    return <footer>Footer</footer>;
  },
}));

describe('Layout theme persistence', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.documentElement.className = '';
  });

  it('keeps rendering when localStorage writes are blocked', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    render(
      <Layout locale="ko">
        <p>Page body</p>
      </Layout>
    );

    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
