// Shared type definitions for the project
import type { NextPage } from 'next';
import type { AppProps } from 'next/app';
import type { Resource } from 'i18next';
import type { Locale } from '../lib/i18n';

export interface BaseProps {
  className?: string;
  children?: React.ReactNode;
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
    hasHero?: boolean;
};

export interface I18nPageProps {
    locale?: Locale;
    i18nResources?: Resource;
}

export type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout;
    pageProps: I18nPageProps & Record<string, unknown>;
};
