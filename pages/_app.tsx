import type { AppPropsWithLayout } from '../types';
import { Analytics } from '@vercel/analytics/react';
import '../styles/globals.css';

import Head from 'next/head';
import { Montserrat } from 'next/font/google';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import i18n, { applyI18nResources, defaultLocale, locales, loadCommonResourceClient, type Locale } from '../lib/i18n';
import { I18nextProvider } from 'react-i18next';
import { AnimatePresence, MotionConfig, m, LazyMotion, domAnimation } from 'framer-motion';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

const localeLoadingMessage: Record<Locale, string> = {
  ko: '콘텐츠를 불러오는 중입니다...',
  en: 'Loading content...',
  zh: '正在加载内容...',
  es: 'Cargando contenido...',
  vi: 'Dang tai noi dung...',
  th: 'กําลังโหลดเนื้อหา...',
  uz: 'Kontent yuklanmoqda...',
};

function StudioNoriApp({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
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

  const [isLocaleReady, setIsLocaleReady] = useState(() => hasServerResourceForLocale || i18n.hasResourceBundle(locale, 'common'));

  useEffect(() => {
    if (typeof document === 'undefined') return;
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const ensureLocaleReady = async () => {
      let renderLocale: Locale = locale;
      applyI18nResources(i18nResources);

      const hasLocaleBundle = i18n.hasResourceBundle(locale, 'common');
      if (!hasServerResourceForLocale && !hasLocaleBundle) {
        setIsLocaleReady(false);
      }

      if (!hasLocaleBundle) {
        try {
          const commonResource = await loadCommonResourceClient(locale);
          i18n.addResourceBundle(locale, 'common', commonResource, true, true);
        } catch {
          renderLocale = defaultLocale;

          if (!i18n.hasResourceBundle(defaultLocale, 'common')) {
            try {
              const fallbackCommonResource = await loadCommonResourceClient(defaultLocale);
              i18n.addResourceBundle(defaultLocale, 'common', fallbackCommonResource, true, true);
            } catch {
              // Keep fallback behavior with loading UI when both locale and default loading fail.
            }
          }
        }
      }

      const hasRenderableResource = i18n.hasResourceBundle(renderLocale, 'common');

      if (!isCancelled) {
        setIsLocaleReady(hasRenderableResource);
      }

      if (hasRenderableResource && i18n.language !== renderLocale) {
        await i18n.changeLanguage(renderLocale);
      }
    };

    void ensureLocaleReady();

    return () => {
      isCancelled = true;
    };
  }, [hasServerResourceForLocale, i18nResources, locale]);

  if (!hasServerResourceForLocale && !isLocaleReady && !i18n.hasResourceBundle(locale, 'common')) {
    return (
      <div className={montserrat.variable}>
        <Head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center" aria-live="polite" role="status">
          <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
            <span className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-primary animate-spin" aria-hidden="true" />
            <span className="text-sm font-medium">{localeLoadingMessage[locale] || localeLoadingMessage.ko}</span>
          </div>
        </div>
      </div>
    );
  }

  const routeTransitionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.06, ease: 'linear' as const },
  };

  return (
    <div className={montserrat.variable}>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#6d28d9" />
        <meta name="theme-color" content="#5b21b6" media="(prefers-color-scheme: dark)" />
        <meta name="msapplication-TileColor" content="#6d28d9" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="alternate" type="application/rss+xml" title="Studio NOL Stories" href={`/api/rss?locale=${locale}`} />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
      </Head>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary locale={locale}>
          <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user">
              <Layout hasHero={hasHero} locale={locale}>
                <AnimatePresence mode="wait" initial={true} onExitComplete={() => { window.scrollTo({ top: 0, behavior: 'auto' }); document.getElementById('main-content')?.focus({ preventScroll: true }); }}>
                  <m.div
                    key={router.asPath.split('?')[0]}
                    {...routeTransitionProps}
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
