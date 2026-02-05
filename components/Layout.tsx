import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getSiteConfig } from '../data/siteConfig';
import { LanguageSwitcher } from './LanguageSwitcher';
import { type Locale, defaultLocale } from '../lib/i18n';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  isScrolled: boolean;
  currentPath: string;
  onNavigate: () => void;
  hasHero?: boolean;
}

const NavLink = React.memo(({ href, children, isScrolled, currentPath, onNavigate, hasHero }: NavLinkProps) => {
  // Normalize paths to remove trailing slashes for consistent comparison
  const normalizedPath = currentPath.endsWith('/') && currentPath.length > 1 ? currentPath.slice(0, -1) : currentPath;
  const normalizedHref = href.endsWith('/') && href.length > 1 ? href.slice(0, -1) : href;

  // Determine if we should allow prefix matching.
  // We avoid prefix matching for the locale root (e.g. "/ko") so it doesn't highlight for all subpages.
  // href.split('/').filter(Boolean) gives segments. "/ko" -> 1 segment. "/ko/about" -> 2 segments.
  const hrefSegments = normalizedHref.split('/').filter(Boolean).length;
  
  const isExactMatch = normalizedPath === normalizedHref;
  const isPrefixMatch = hrefSegments > 1 && 
    normalizedPath.startsWith(normalizedHref) && 
    normalizedPath[normalizedHref.length] === '/';

  const isActive = isExactMatch || isPrefixMatch;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`px-2.5 py-1.5 rounded-md typo-nav-link text-sm leading-snug whitespace-normal transition-colors transition-shadow duration-300 touch-manipulation
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${isActive
        ? 'bg-white/90 text-primary-dark shadow-sm'
        : `${isScrolled || !hasHero ? 'text-gray-800 dark:text-white' : 'text-white'} hover:bg-white/20`
        }`}
    >
      {children}
    </Link>
  );
});

NavLink.displayName = 'NavLink';

interface LayoutProps {
  children: React.ReactNode;
  hasHero?: boolean;
  locale?: Locale;
}

const Layout = ({ children, hasHero, locale = defaultLocale }: LayoutProps) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasThemeLoaded, setHasThemeLoaded] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(80);
  const headerRef = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const currentPath = useMemo(() => router.asPath || '/', [router.asPath]);
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';
  const skipLabel = locale === 'ko' ? '본문 바로가기' : 'Skip to content';
  const navItems = useMemo(() => {
    const prefix = `/${locale}`;
    return [
      { href: prefix, label: t('nav.home') },
      { href: `${prefix}/about`, label: t('nav.about') },
      { href: `${prefix}/pricing`, label: t('nav.pricing') },
      { href: `${prefix}/portfolio`, label: t('nav.portfolio') },
      { href: `${prefix}/studio-info`, label: t('nav.equipment') },
      { href: `${prefix}/practice-room`, label: t('nav.practiceRoom') },
      { href: `${prefix}/lesson`, label: t('nav.lesson') },
      { href: `${prefix}/stories`, label: t('nav.stories') },
      { href: `${prefix}/contact`, label: t('nav.contact') },
    ];
  }, [locale, t]);

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

  const handleNavigate = React.useCallback(() => setIsMenuOpen(false), []);

  const isHome = router.pathname === '/[locale]';
  const isFullBleed = [].includes(router.pathname as never);
  const siteConfig = getSiteConfig(locale);

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
      <header
        ref={headerRef}
        className={`fixed w-full z-50 transition-colors transition-shadow duration-300 ${isScrolled
          ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md'
          : hasHero
            ? 'bg-transparent'
            : 'bg-gradient-to-r from-primary via-secondary to-accent'
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/${locale}`}
              className={`${isScrolled || !hasHero ? 'text-primary dark:text-white' : 'text-white'}
                flex items-center text-4xl sm:text-5xl font-logo tracking-wider hover:opacity-90 transition-opacity duration-300 whitespace-nowrap -translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`}
              onClick={(event) => {
                // If needed, custom logic here. Default Link behavior handles navigation.
                setIsMenuOpen(false);
              }}
            >
              {siteConfig.name}
            </Link>

            <div className="flex items-center space-x-2 md:space-x-4">
              <nav className="hidden 2xl:flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 max-w-[70vw]">
                {navItems.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    isScrolled={isScrolled}
                    currentPath={currentPath}
                    onNavigate={handleNavigate}
                    hasHero={hasHero}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <button
                className={`p-2 rounded-full ${isScrolled || !hasHero
                  ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'text-white hover:bg-white/20'
                  } min-h-[44px] min-w-[44px] transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`}
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
              </button>

              <LanguageSwitcher
                currentLocale={locale}
                isScrolled={isScrolled}
                hasHero={hasHero || false}
              />

              <button
                className={`2xl:hidden p-2 rounded-full ${isScrolled || !hasHero
                  ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'text-white hover:bg-white/20'
                  } min-h-[44px] min-w-[44px] transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.3,
                ease: 'easeInOut'
              }}
              className="2xl:hidden z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg overflow-hidden"
            >
              <div className="px-4 py-3 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-2 min-h-[44px] rounded-md typo-nav-link text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300 touch-manipulation"
                    aria-current={currentPath === item.href ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main
        id="main-content"
        className={`page-main flex-grow ${isHome || hasHero ? 'pt-0' : ''} ${isFullBleed ? 'pb-0' : 'pb-12'}`}
        style={isHome || hasHero ? undefined : { paddingTop: headerHeight }}
      >
        {children}
      </main>

      <footer className="bg-gradient-to-r from-primary via-secondary to-accent text-white p-8 font-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="typo-footer-heading mb-4">
                {siteConfig.name}
              </h3>
              <p className="typo-footer-body text-gray-200/90 mb-4 leading-relaxed">
                {t('footer.tagline')}
              </p>
              <p className="typo-footer-meta">
                2024 {siteConfig.name}. {t('footer.rights')}
              </p>
            </div>

            <div>
              <h3 className="typo-footer-heading mb-4">{t('footer.linksTitle')}</h3>
              <ul className="space-y-2">
                {/* Simplified footer links for now - can use navItems but filtered */}
                <li><Link href={`/${locale}`} className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">{t('nav.home')}</Link></li>
                <li><Link href={`/${locale}/about`} className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">{t('nav.about')}</Link></li>
                <li><Link href={`/${locale}/contact`} className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300">{t('nav.contact')}</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="typo-footer-heading mb-4">{t('footer.contactTitle')}</h3>
              <a
                href={siteConfig.contact.naverMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-center mb-2"
              >
                <span className="inline-block w-4 mr-2">📍</span>
                <span className="leading-relaxed">{siteConfig.contact.address}</span>
              </a>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-center mb-2"
              >
                <span className="inline-block w-4 mr-2">📧</span>
                <span className="leading-relaxed">{t('footer.emailLabel')}: {siteConfig.contact.email}</span>
              </a>
              <a
                href={`tel:${siteConfig.contact.phone}`}
                className="typo-footer-body text-gray-200/80 hover:text-white transition-colors duration-300 flex items-center"
              >
                <span className="inline-block w-4 mr-2">📞</span>
                <span className="leading-relaxed">{t('footer.phoneLabel')}: {siteConfig.contact.phone}</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
