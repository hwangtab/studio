import type { AppPropsWithLayout } from '../types';
import '../styles/globals.css';

import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';
import { Montserrat } from 'next/font/google';
import localFont from 'next/font/local';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';

// Vercel Analytics·SpeedInsights는 client-only이고 hydration 후에 발화하면 충분.
// 동적 import로 _app 초기 청크에서 분리해 사용하지 않는 JS 100KB 감축에 기여.
const Analytics = dynamic(() => import('@vercel/analytics/react').then(m => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import('@vercel/speed-insights/next').then(m => m.SpeedInsights), { ssr: false });
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

// Pretendard — 사이트 전반의 통합 한글 폰트 (자가 호스팅 subset).
// next/font/local이 빌드 시 .next/static/media에 복사 + 자동 preload + size-adjust 처리.
// Noto Sans KR variable이 한글 unicode-range chunk로 분할되며 LCP를 악화시킨 사례
// 학습 후 더 가벼운 Pretendard subset으로 복귀. 히어로는 Black(900)로 임팩트 유지.
const pretendard = localFont({
  src: [
    { path: '../public/fonts/Pretendard-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/Pretendard-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../public/fonts/Pretendard-Black.woff2', weight: '900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-pretendard',
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

  // light용 theme-color는 React state로 관리한다 — setAttribute로 직접 갱신해도
  // next/head가 hydration·reconcile 시 component tree의 content prop 값으로 attribute를
  // 다시 set하기 때문이다. .dark 클래스 변경을 MutationObserver로 추적해 state를
  // 갱신하면 React re-render가 meta content를 일관되게 유지한다.
  const [themeColorLight, setThemeColorLight] = useState('#6d28d9');
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeColorLight(isDark ? '#5b21b6' : '#6d28d9');
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  // 폰트 지연 로딩 useEffect 제거: 사이트 전반을 next/font/google의 Noto Sans KR로
  // 통일하면서 더 이상 Pretendard @font-face 주입이 필요 없음. next/font가 빌드 시
  // self-hosted + preload + size-adjust를 자동 처리.

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
      <div className={`${montserrat.variable} ${pretendard.variable}`}>
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
    <div className={`${montserrat.variable} ${pretendard.variable}`}>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="color-scheme" content="light dark" />
        {/* theme-color 두 meta는 next/head dedupe를 우회하도록 명시 key가 필요하다 —
            key 없이 같은 name="theme-color"를 두 번 두면 next/head가 한 개만 SSR에
            출력해 progressive enhancement가 깨진다.
            동작:
            1) light용(media 없음): /scripts/theme-init.js와 components/Layout.tsx
               토글 핸들러가 사용자 결정값으로 content 갱신.
            2) dark용(media query 매치 시): 스크립트 실패·차단 환경 폴백. 시스템이
               dark 선호면 브라우저가 자동 매치.
            HTML 스펙은 두 meta 중 environment 매치되는 것을 사용. */}
        <meta key="theme-color-light" name="theme-color" content={themeColorLight} />
        <meta key="theme-color-dark" name="theme-color" content="#5b21b6" media="(prefers-color-scheme: dark)" />
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
