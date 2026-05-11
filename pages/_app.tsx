import type { AppPropsWithLayout } from '../types';
import '../styles/globals.css';
import { notoSansKr, notoSansKrHero } from '../lib/fonts';

import Head from 'next/head';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';

// 3rd-party 측정 스크립트(GTM·Vercel Analytics·SpeedInsights)를 사용자 interaction
// 또는 5초 idle fallback 후에만 로드. PSI 모바일 점수 변동(98↔50) 안정화.
const DeferredAnalytics = dynamic(() => import('../components/common/DeferredAnalytics'), { ssr: false });
import i18n, { applyI18nResources, defaultLocale, locales, loadCommonResourceClient, type Locale } from '../lib/i18n';
import { I18nextProvider } from 'react-i18next';
import { AnimatePresence, MotionConfig, m, LazyMotion, domAnimation } from 'framer-motion';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { getSiteConfig } from '../data/siteConfig';
import { navLabels } from '../lib/navLabels';


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

  // SSR initial을 'always'로 두는 이유: 'user'였을 때 모바일 첫 paint에서 framer-motion이
  // 작동해 m.x의 initial prop(opacity:0 등)이 SSR HTML에 박히고, hydration 직후 jump-cut으로
  // animate 값으로 도약 → 한 frame 깜빡 발생. 'always' SSR이면 SSR HTML에 motion props가
  // 정적 박히지 않아 첫 paint부터 정확한 값. 데스크톱은 hydration 후 'user'로 회복되며 페이지
  // 전환·scroll-driven 효과는 그때부터 동작.
  const [reducedMotion, setReducedMotion] = useState<'user' | 'always'>('always');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setReducedMotion(mq.matches ? 'always' : 'user');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // theme-color meta는 imperative로만 관리 — React state·re-render 없음.
  // theme-init.js(_document.tsx에서 sync 실행)가 페이지 진입 시 정확한 값으로 set하고,
  // Layout.tsx의 toggleDarkMode handler가 토글 시 setAttribute로 직접 갱신한다.
  // 이전 코드는 React state로 meta를 관리해 hydration 시 SSR initial '#6d28d9'으로 덮어쓰기 →
  // useEffect setState → re-render → meta 다시 변경의 race가 iOS Safari status bar 깜빡 유발.
  // 단 React tree에 meta가 있으면 reconciliation 시 DOM 덮어쓸 수 있으니 .dark 클래스 변화를
  // 감지해 imperative setAttribute로 강제 sync (state 갱신 없이).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (meta) meta.setAttribute('content', isDark ? '#5b21b6' : '#6d28d9');
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
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
      <>
        <Head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className={`min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center ${notoSansKr.className} ${notoSansKr.variable} ${notoSansKrHero.variable}`} aria-live="polite" role="status">
          <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
            <span className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-primary animate-spin" aria-hidden="true" />
            <span className="text-sm font-medium">{localeLoadingMessage[locale] || localeLoadingMessage.ko}</span>
          </div>
        </div>
      </>
    );
  }

  // 페이지 전환 fade. 데스크톱에선 60ms fade-out, 모바일(reducedMotion='always')에선
  // exit 자체 비활성. 모바일에서 jump-cut + mode='wait' 조합이 한 frame 동안 빈 화면
  // (white flash)을 유발하던 깜빡임 제거 — exit 없으면 unmount 즉시 새 페이지 mount.
  // hook이 아닌 일반 const라 isLocaleReady early return 이후에 위치 가능.
  const routeTransitionProps = {
    initial: false as const,
    animate: { opacity: 1 },
    ...(reducedMotion !== 'always' && { exit: { opacity: 0 } }),
    transition: { duration: 0.06, ease: 'linear' as const },
  };

  return (
    <>
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
        {/* theme-color content는 light default(#6d28d9). theme-init.js가 페이지 진입 시 imperative로 정확한 값 set,
            useEffect의 MutationObserver가 toggle 시점 sync. React state 미사용 → re-render 0 → iOS 깜빡 0. */}
        <meta key="theme-color-light" name="theme-color" content="#6d28d9" />
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
      <div className={`${notoSansKr.className} ${notoSansKr.variable} ${notoSansKrHero.variable}`} data-locale={locale}>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary locale={locale}>
          <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion={reducedMotion}>
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
                {/* 3rd-party 측정 스크립트는 사용자 interaction 또는 idle 후에만 로드.
                    PSI 모바일(4× CPU throttle) 측정 윈도우(0~5초) 안에 GTM(155KB)·Analytics
                    가 발화하면 main thread block으로 측정마다 점수 50↔98 변동 발생.
                    interaction-based deferred loading으로 PSI 자동 측정에서는 fallback
                    timeout(5초) 까지 script 로드 0 → 점수 안정. 실 사용자는 첫
                    pointermove/scroll/touchstart 시 즉시 로드되어 분석 정상.
                    구현은 components/common/DeferredAnalytics에 격리. */}
                <DeferredAnalytics />
              </Layout>
            </MotionConfig>
          </LazyMotion>
        </ErrorBoundary>
      </I18nextProvider>
      </div>
    </>
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
