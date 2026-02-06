import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getSiteConfig } from '../../data/siteConfig';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { type Locale } from '../../lib/i18n';

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
      className={`px-2 py-1.5 rounded-md typo-nav-link text-sm leading-snug whitespace-nowrap transition-colors transition-shadow duration-300 touch-manipulation
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

interface HeaderProps {
  locale: Locale;
  isScrolled: boolean;
  hasHero: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Header = React.forwardRef<HTMLElement, HeaderProps>(({ locale, isScrolled, hasHero, isDarkMode, toggleDarkMode }, ref) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const currentPath = useMemo(() => router.asPath || '/', [router.asPath]);
  const siteConfig = getSiteConfig(locale);

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

  const handleNavigate = React.useCallback(() => setIsMenuOpen(false), []);

  return (
    <header
      ref={ref}
      className={`fixed w-full z-50 transition-colors transition-shadow duration-300 ${isScrolled
        ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md'
        : hasHero
          ? 'bg-transparent'
          : 'bg-gradient-to-r from-primary via-secondary to-accent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/${locale}`}
            className={`${isScrolled || !hasHero ? 'text-primary dark:text-white' : 'text-white'}
              flex-shrink-0 flex items-center text-2xl sm:text-4xl 3xl:text-5xl font-logo tracking-wider hover:opacity-90 transition-opacity duration-300 whitespace-nowrap -translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`}
            onClick={() => setIsMenuOpen(false)}
          >
            {siteConfig.name}
          </Link>

          <nav className="hidden 3xl:flex flex-1 justify-center items-center gap-x-2 3xl:gap-x-4 min-w-0 px-2 3xl:px-4">
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

          <div className="flex-shrink-0 flex items-center space-x-1 sm:space-x-2 md:space-x-4">
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
              className={`3xl:hidden p-2 rounded-full ${isScrolled || !hasHero
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
            className="3xl:hidden z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg overflow-hidden"
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
  );
});

Header.displayName = 'Header';