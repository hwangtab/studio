import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { type Locale, defaultLocale } from '../lib/i18n';

// 스크롤 인터랙션 보조 컴포넌트들은 첫 paint에 시각적 영향이 없어 hydration 후 lazy load.
// LCP/FCP 측정 창에서 빠지면서 _app/Layout 청크에서 분리.
const ScrollToTop = dynamic(() => import('./ui/ScrollToTop').then(m => m.ScrollToTop), { ssr: false });
// 전 페이지 상시 카카오 진입점. 검증된 유일 전환 채널을 모든 페이지에 노출.
const KakaoFab = dynamic(() => import('./common/KakaoFab'), { ssr: false });

interface LayoutProps {
  children: React.ReactNode;
  hasHero?: boolean;
  locale?: Locale;
}

// 헤더 높이는 80px 정적 처리(Tailwind pt-20). 이전엔 ResizeObserver로 실측 후
// setState했지만 hydration·re-render 비용이 PSI 데스크톱 TBT 1680ms·강제 리플로우
// 920ms의 잠재 원인이었다. 헤더 높이 변동 빈도가 낮고 첫 paint 후 발생이라 LCP
// 영향 없어 정적 처리로 충분. 헤더 스타일이 바뀌면 styles/globals.css의 page-main
// 또는 이 className을 같이 조정.

const Layout = ({ children, hasHero, locale = defaultLocale }: LayoutProps) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasThemeLoaded, setHasThemeLoaded] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);


  // Consolidated Theme Management
  useEffect(() => {
    if (typeof document === 'undefined') return;
    setIsDarkMode(document.documentElement.classList.contains('dark'));
    setHasThemeLoaded(true);
  }, []);

  // Theme 적용 및 theme-color 동적 갱신
  useEffect(() => {
    if (!hasThemeLoaded || typeof document === 'undefined') return;

    // 2. Apply Theme
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      localStorage.setItem('darkMode', String(isDarkMode));
    } catch {
      // Storage can be blocked in private browsing or hardened browser modes.
    }

    // 3. Update theme-color meta tag
    const themeColor = isDarkMode ? '#5b21b6' : '#6d28d9';
    const metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }

    // 4. Sync Lang
    document.documentElement.lang = locale;
  }, [isDarkMode, hasThemeLoaded, locale]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (!ticking) {
        rafId = window.requestAnimationFrame(() => {
          const y = window.scrollY;
          setIsScrolled((prev) => {
            const next = y > 10;
            return prev !== next ? next : prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const isHome = router.pathname === '/[locale]';
  // 스토리 상세는 스크롤 시 StickyBottomCTA(하단 바)가 상시 카카오 CTA 역할을 하므로
  // 전역 KakaoFab을 숨겨 우하단 요소 중복·시각 충돌을 제거한다.
  const isStoryDetail = router.pathname === '/[locale]/stories/[id]';
  /**
   * 계약 화면에서는 떠 있는 버튼을 전부 치운다.
   *
   * 서명 캔버스와 [계약서 서명 완료] 버튼이 화면 아래쪽에 있어, 우하단에 떠 있는 카카오
   * 버튼과 손가락이 닿는 자리가 겹친다. 서명하려다 카카오톡이 열리면 그리던 서명이 날아간다.
   * 계약 화면은 서명 하나만 하러 오는 곳이라 다른 데로 새게 할 이유도 없다.
   */
  const isContractPage = router.pathname.startsWith('/[locale]/contracts/');
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';
  const skipLabel = t('actions.skipToContent');

  return (
    <div
      className={`flex flex-col min-h-screen bg-white dark:bg-gray-900 ${textBreakClass} overflow-x-hidden w-full`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-md focus:bg-white focus:text-gray-900 focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {skipLabel}
      </a>

      {/*
        계약 화면에는 사이트 헤더를 붙이지 않는다.

        서명하러 온 사람에게 필요한 것은 계약서와 서명란뿐이다. 네비게이션은 다른 데로
        새게 만들고, 언어 전환기는 눌러도 계약서가 한국어 그대로인 채 입력만 초기화되며,
        다크 모드 토글은 계약 화면이 라이트 고정이라 아무 일도 하지 않는다.
        브랜드는 계약 화면이 자기 상단에 직접 밝힌다 — 피싱과 구별되어야 하는 화면이라
        "어디서 온 문서인가"는 남아 있어야 한다.
      */}
      {!isContractPage && (
        <Header
          ref={headerRef}
          locale={locale}
          isScrolled={isScrolled}
          hasHero={hasHero || false}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}

      {/* paddingTop을 inline style 동적 변경(setHeaderHeight setState)에서 정적 Tailwind
          'pt-20' (=80px, INITIAL_HEADER_HEIGHT_PX와 일치)로 변경. React re-render 시
          자식 컴포넌트 layout 재계산 비용 0 + main thread block 감소. ResizeObserver
          제거(헤더 실측 갱신 미사용) — 헤더 높이가 변동되는 경우는 거의 없고(다크모드
          toggle·hover 등), 첫 paint 후 변동도 사용자 인터랙션 시에만 발생해 LCP 무관. */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`page-main flex-grow outline-none ${
          isHome || hasHero || isContractPage ? 'pt-0' : 'pt-20'
        }`}
      >
        {children}
      </main>

      <Footer locale={locale} />
      {!isStoryDetail && !isContractPage && <KakaoFab locale={locale} />}
      {!isContractPage && <ScrollToTop locale={locale} />}
    </div>
  );
};

export default Layout;
