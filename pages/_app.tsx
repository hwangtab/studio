import type { AppPropsWithLayout } from '../types';
import { Analytics } from '@vercel/analytics/react';
import '../styles/globals.css';

import Head from 'next/head';
import { Montserrat } from 'next/font/google';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import i18n, { defaultLocale, type Locale } from '../lib/i18n';
import { I18nextProvider } from 'react-i18next';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';

function StudioNoriApp({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  // 페이지 컴포넌트의 static property에서 hasHero 값을 읽음
  const hasHero = Component.hasHero || false;
  const locale = (pageProps?.locale as Locale | undefined) || defaultLocale;

  return (
    <div className={montserrat.variable}>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1a56db" />
        <meta name="theme-color" content="#1e3a8a" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary locale={locale}>
          <Layout hasHero={hasHero} locale={locale}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={router.asPath.split('?')[0]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <Component {...pageProps} />
              </motion.div>
            </AnimatePresence>
            <Analytics />
          </Layout>
        </ErrorBoundary>
      </I18nextProvider>
    </div>
  );
}

export default StudioNoriApp;
