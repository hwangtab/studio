import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
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

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [router.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const initialDarkMode = sessionStorage.getItem('initialDarkMode') === 'true';
      setIsDarkMode(initialDarkMode);
      setHasThemeLoaded(true);
    } catch (error) {
      console.warn('Failed to read dark mode preference', error);
      setHasThemeLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !headerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const nextHeight = Math.ceil(entries[0]?.contentRect?.height || 0);
      if (nextHeight > 0) {
        setHeaderHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

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
          const isOverThreshold = window.scrollY > 10;
          setIsScrolled((prev) => {
            if (prev !== isOverThreshold) return isOverThreshold;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasThemeLoaded || typeof document === 'undefined') return;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode, hasThemeLoaded]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
  }, [locale]);

  const isHome = router.pathname === '/[locale]';
  const isFullBleed = [].includes(router.pathname as never);
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';
  const skipLabel = locale === 'ko' ? '본문 바로가기' : 'Skip to content';

  return (
    <div
      className={`flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 ease-in-out ${textBreakClass} overflow-x-hidden w-full`}
      suppressHydrationWarning
    >
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
      />

      <main
        id="main-content"
        className={`page-main flex-grow ${isHome || hasHero ? 'pt-0' : ''} ${isFullBleed ? 'pb-0' : 'pb-12'}`}
        style={isHome || hasHero ? undefined : { paddingTop: headerHeight }}
      >
        {children}
      </main>

      <Footer locale={locale} />
    </div>
  );
};

export default Layout;