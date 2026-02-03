// Shared type definitions for the project
import type { NextPage } from 'next';
import type { AppProps } from 'next/app';

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
    hasHero?: boolean;
};

export type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout;
};
