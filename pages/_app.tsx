import type { AppPropsWithLayout } from '../types';
import { Analytics } from '@vercel/analytics/react';
import '../styles/globals.css';

import Head from 'next/head';
import { Montserrat } from 'next/font/google';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import i18n, { defaultLocale, locales, loadCommonResourceClient, type Locale } from '../lib/i18n';
import { I18nextProvider } from 'react-i18next';
import { AnimatePresence, MotionConfig, m, useReducedMotion, LazyMotion, domAnimation } from 'framer-motion';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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
  const routeLocale = router.asPath.split('?')[0].split('/')[1];
  const detectedRouteLocale = locales.includes(routeLocale as Locale)
    ? (routeLocale as Locale)
    : defaultLocale;
  const locale = (pageProps?.locale as Locale) || detectedRouteLocale;
  const i18nResources = pageProps?.i18nResources;
  const hasServerResourceForLocale = Boolean(
    i18nResources &&
    typeof i18nResources === 'object' &&
    locale in (i18nResources as Record<string, unknown>)
  );
  const [isLocaleReady, setIsLocaleReady] = useState(() => i18n.hasResourceBundle(locale, 'common'));

  // Merge i18n resources from server-side props synchronously before rendering children.
  // This prevents raw translation keys from flashing on first paint.
  if (i18nResources) {
    Object.entries(i18nResources as Record<string, unknown>).forEach(([lng, namespaces]) => {
      Object.entries((namespaces ?? {}) as Record<string, unknown>).forEach(([ns, data]) => {
        if (!data) return;
        i18n.addResourceBundle(lng, ns, data, true, true);
      });
    });
  }

  useEffect(() => {
    let isCancelled = false;

    const ensureLocaleReady = async () => {
      if (!i18n.hasResourceBundle(locale, 'common')) {
        try {
          const commonResource = await loadCommonResourceClient(locale);
          i18n.addResourceBundle(locale, 'common', commonResource, true, true);
        } catch {
          // Keep fallback behavior: default locale resources are initialized by i18n config.
        }
      }

      if (!isCancelled) {
        setIsLocaleReady(i18n.hasResourceBundle(locale, 'common'));
      }

      if (i18n.language !== locale) {
        await i18n.changeLanguage(locale);
      }
    };

    void ensureLocaleReady();

    return () => {
      isCancelled = true;
    };
  }, [locale]);

  if (!hasServerResourceForLocale && !isLocaleReady && !i18n.hasResourceBundle(locale, 'common')) {
    return null;
  }

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
