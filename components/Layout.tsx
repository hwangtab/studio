import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { ScrollProgress } from './common/ScrollProgress';
import { useIsIOSSafari } from '../utils/deviceUtils';
import { type Locale, defaultLocale } from '../lib/i18n';

interface LayoutProps {
  children: React.ReactNode;
  hasHero?: boolean;
  locale?: Locale;
}

const Layout = ({ children, hasHero, locale = defaultLocale }: LayoutProps) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasThemeLoaded, setHasThemeLoaded] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(80);
  const headerRef = useRef<HTMLElement | null>(null);
  const isIOSSafari = useIsIOSSafari();

  // Consolidated Theme Management
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initial Load - localStorage만 사용
    try {
      const savedTheme = localStorage.getItem('darkMode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = savedTheme === 'true' || (savedTheme === null && prefersDark);
      setIsDarkMode(isDark);
    } catch (error) {
      console.warn('Failed to read dark mode preference', error);
    } finally {
      setHasThemeLoaded(true);
    }
  }, []);

  // Theme 적용 및 theme-color 동적 갱신
  useEffect(() => {
    if (!hasThemeLoaded || typeof document === 'undefined') return;

    // 2. Apply Theme
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
    
    // 3. Update theme-color meta tag
    const themeColor = isDarkMode ? '#1e3a8a' : '#1a56db';
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
    if (typeof window === 'undefined' || !headerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const nextHeight = Math.ceil(entries[0]?.contentRect?.height || 0);
      if (nextHeight > 0) {
        setHeaderHeight((prev) => {
          const threshold = isIOSSafari ? 2 : 0;
          return Math.abs(prev - nextHeight) > threshold ? nextHeight : prev;
        });
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [isIOSSafari]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (!ticking) {
        rafId = window.requestAnimationFrame(() => {
          const y = window.scrollY;
          const enterThreshold = isIOSSafari ? 24 : 10;
          const exitThreshold = isIOSSafari ? 8 : 10;
          setIsScrolled((prev) => {
            const next = prev ? y > exitThreshold : y > enterThreshold;
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
  }, [isIOSSafari]);

  const isHome = router.pathname === '/[locale]';
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';
  const skipLabel = t('actions.skipToContent');

  return (
    <div
      className={`flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 ease-in-out ${textBreakClass} overflow-x-hidden w-full`}
    >
      <ScrollProgress disabled={isIOSSafari} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-md focus:bg-white focus:text-gray-900 focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {skipLabel}
      </a>

      <Header
        ref={headerRef}
        locale={locale}
        isScrolled={isScrolled}
        hasHero={hasHero || false}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        disableEffects={isIOSSafari}
      />

      <main
        id="main-content"
        className={`page-main flex-grow ${isHome || hasHero ? 'pt-0' : ''}`}
        style={isHome || hasHero ? undefined : { paddingTop: headerHeight }}
      >
        {children}
      </main>

      <Footer locale={locale} />
    </div>
  );
};

export default Layout;
