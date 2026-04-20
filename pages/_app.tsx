import type { AppPropsWithLayout } from '../types';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '../styles/globals.css';

import Head from 'next/head';
import Script from 'next/script';
import { Montserrat } from 'next/font/google';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import i18n, { applyI18nResources, defaultLocale, locales, loadCommonResourceClient, type Locale } from '../lib/i18n';
import { I18nextProvider } from 'react-i18next';
import { AnimatePresence, MotionConfig, m, LazyMotion, domAnimation } from 'framer-motion';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { getSiteConfig } from '../data/siteConfig';
import { navLabels } from '../lib/navLabels';

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
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
      });
    }
  }, []);

  // Pretendard 폰트 지연 로드 — window.load 이후 @font-face를 주입하여
  // 크리티컬 패스에서 폰트 다운로드가 JS/CSS 대역폭을 잠식하지 않도록 함.
  // 주입 후 브라우저는 자동으로 Pretendard를 발견하고 font-display: swap으로 적용.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('pretendard-deferred')) return;

    const injectFonts = () => {
      if (document.getElementById('pretendard-deferred')) return;
      const style = document.createElement('style');
      style.id = 'pretendard-deferred';
      const weights: Array<[string, string]> = [
        ['Regular', '400'],
        ['SemiBold', '600'],
        ['Bold', '700'],
      ];
      style.textContent = weights
        .map(
          ([name, weight]) => `@font-face{font-family:'Pretendard';font-weight:${weight};font-display:swap;src:local('Pretendard ${name}'),local('Pretendard-${name}'),url('/fonts/Pretendard-${name}.woff2') format('woff2'),url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2-subset/Pretendard-${name}.subset.woff2') format('woff2');}`
        )
        .join('');
      document.head.appendChild(style);
    };

    const schedule = () => {
      const ric = (window as typeof window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
      if (ric) ric(injectFonts);
      else setTimeout(injectFonts, 0);
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
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

  // 정적 nav 라벨 매핑을 사용해 SSR/SSG에서도 JSON-LD가 보장되도록 한다.
  // i18n.t()는 useEffect 내 applyI18nResources 이후에만 안정적이라 SSR 시 빈 값 위험.
  const siteNavSchema = useMemo(() => {
    const sc = getSiteConfig(locale);
    const base = `${sc.url}/${locale}`;
    const labels = navLabels[locale] || navLabels[defaultLocale];
    return {
      '@context': 'https://schema.org',
      '@type': 'SiteNavigationElement',
      name: labels.home,
      hasPart: [
        { '@type': 'SiteNavigationElement', name: sc.name, url: base },
        { '@type': 'SiteNavigationElement', name: labels.pricing, url: `${base}/pricing` },
        { '@type': 'SiteNavigationElement', name: labels.equipment, url: `${base}/studio-info` },
        { '@type': 'SiteNavigationElement', name: labels.practiceRoom, url: `${base}/practice-room` },
        { '@type': 'SiteNavigationElement', name: labels.lesson, url: `${base}/lesson` },
        { '@type': 'SiteNavigationElement', name: labels.weddingSong, url: `${base}/wedding-song` },
        { '@type': 'SiteNavigationElement', name: labels.voiceActing, url: `${base}/voice-acting` },
        { '@type': 'SiteNavigationElement', name: labels.portfolio, url: `${base}/portfolio` },
        { '@type': 'SiteNavigationElement', name: labels.stories, url: `${base}/stories` },
        { '@type': 'SiteNavigationElement', name: labels.contact, url: `${base}/contact` },
      ],
    };
  }, [locale]);

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
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#6d28d9" />
        <meta name="theme-color" content="#5b21b6" media="(prefers-color-scheme: dark)" />
        <meta name="msapplication-TileColor" content="#6d28d9" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="스튜디오 놀" />
        <link rel="manifest" href={`/api/manifest?locale=${locale}`} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="alternate" type="application/rss+xml" title={locale === 'ko' ? '스튜디오 놀 스토리' : locale === 'zh' ? 'Studio NOL 故事' : locale === 'es' ? 'Studio NOL Historias' : locale === 'vi' ? 'Studio NOL Câu chuyện' : locale === 'th' ? 'Studio NOL เรื่องราว' : locale === 'uz' ? 'Studio NOL Hikoyalar' : 'Studio NOL Stories'} href={`/api/rss?locale=${locale}`} />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavSchema) }}
        />
      </Head>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary locale={locale}>
          <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user">
              <Layout hasHero={hasHero} locale={locale}>
                {/* initial={false}: 첫 방문 시 opacity:0 스타일이 SSR에 박히는 것을 막아 FCP/LCP를 즉시 페인트.
                    페이지 전환(route change) 때만 페이드 애니메이션이 작동한다. */}
                <AnimatePresence mode="wait" initial={false} onExitComplete={() => { window.scrollTo({ top: 0, behavior: 'auto' }); document.getElementById('main-content')?.focus({ preventScroll: true }); }}>
                  <m.div
                    key={router.asPath.split('?')[0]}
                    {...routeTransitionProps}
                  >
                    <Component {...pageProps} />
                  </m.div>
                </AnimatePresence>
                <Analytics />
                <SpeedInsights />
                {/* Google Analytics 4 — lazyOnload: window.onload 이후 유휴 시 로드.
                    gtag.js 154KB가 초기 대역폭/메인스레드 경쟁에서 빠져 FCP/TBT 개선.
                    측정 정확도: 대부분의 방문자는 onload 전 이탈하지 않으므로 영향 미미. */}
                <Script
                  src="https://www.googletagmanager.com/gtag/js?id=G-KYGP18G36J"
                  strategy="lazyOnload"
                />
                <Script id="ga4-init" strategy="lazyOnload">
                  {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', 'G-KYGP18G36J');
                  `}
                </Script>
              </Layout>
            </MotionConfig>
          </LazyMotion>
        </ErrorBoundary>
      </I18nextProvider>
    </div>
  );
}

export default StudioNoriApp;

import type { NextWebVitalsMetric } from 'next/app';

export function reportWebVitals({ name, value }: NextWebVitalsMetric) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`[Web Vital] ${name}:`, Math.round(name === 'CLS' ? value * 1000 : value));
  }
}
