import type { AppPropsWithLayout } from '../types';
import { Analytics } from '@vercel/analytics/react';
import '../styles/globals.css';

import Head from 'next/head';
import { Montserrat } from 'next/font/google';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import i18n, { defaultLocale } from '../lib/i18n';
import { I18nextProvider } from 'react-i18next';
import { AnimatePresence, MotionConfig, m, useReducedMotion, LazyMotion, domAnimation } from 'framer-motion';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

function StudioNoriApp({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  // 페이지 컴포넌트의 static property에서 hasHero 값을 읽음
  const hasHero = Component.hasHero || false;
  const locale = pageProps?.locale || defaultLocale;
  const i18nResources = pageProps?.i18nResources;

  // Merge i18n resources from server-side props. Always merge to override empty bundles
  // initialized on client. The overwrite flags (true, true) ensure server resources take precedence.
  useMemo(() => {
    if (!i18nResources) return;
    Object.entries(i18nResources).forEach(([lng, namespaces]) => {
      Object.entries((namespaces ?? {}) as Record<string, unknown>).forEach(([ns, data]) => {
        if (!data) return;
        // Always merge: empty bundle ({}) from client init is overwritten by actual server resources
        i18n.addResourceBundle(lng, ns, data, true, true);
      });
    });
  }, [i18nResources]);

  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

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
          <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user">
              <Layout hasHero={hasHero} locale={locale}>
                <AnimatePresence mode="wait" initial={!shouldReduceMotion}>
                  <m.div
                    key={router.asPath.split('?')[0]}
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.1, ease: 'easeInOut' }}
                  >
                    <Component {...pageProps} />
                  </m.div>
                </AnimatePresence>
                <Analytics />
              </Layout>
            </MotionConfig>
          </LazyMotion>
        </ErrorBoundary>
      </I18nextProvider>
    </div>
  );
}

export default StudioNoriApp;
