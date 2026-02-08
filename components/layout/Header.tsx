import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { m, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSiteConfig } from '../../data/siteConfig';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { type Locale } from '../../lib/i18n';
import { DropdownMenu } from './DropdownMenu';

interface HeaderProps {
  locale: Locale;
  isScrolled: boolean;
  hasHero: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Header = React.forwardRef<HTMLElement, HeaderProps>(({ locale, isScrolled, hasHero, isDarkMode, toggleDarkMode }, ref) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const currentPath = router.asPath;
  const siteConfig = getSiteConfig(locale);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleScroll = () => setIsMenuOpen(false);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = document.querySelectorAll(
        'nav.xl\\:hidden button, nav.xl\\:hidden a'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('keydown', handleFocusTrap);

    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('keydown', handleFocusTrap);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  }, []);

  const navGroups = useMemo(() => [
    {
      id: 'recording',
      label: t('nav.groups.recording'),
      items: [
        { label: t('nav.about'), href: `/${locale}/about` },
        { label: t('nav.pricing'), href: `/${locale}/pricing` },
        { label: t('nav.equipment'), href: `/${locale}/studio-info` },
      ]
    },
    {
      id: 'practice',
      label: t('nav.groups.practice'),
      items: [
        { label: t('nav.practiceRoom'), href: `/${locale}/practice-room` },
        { label: t('nav.lesson'), href: `/${locale}/lesson` },
      ]
    },
    {
      id: 'explore',
      label: t('nav.groups.explore'),
      items: [
        { label: t('nav.portfolio'), href: `/${locale}/portfolio` },
        { label: t('nav.stories'), href: `/${locale}/stories` },
        { label: t('nav.contact'), href: `/${locale}/contact` },
      ]
    }
  ], [locale, t]);

  const handleNavigate = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const isTransparent = hasHero && !isScrolled;

  return (
    <header
      ref={ref}
      className={`fixed w-full z-50 transition-[background-color,backdrop-filter,box-shadow] duration-300 py-4 transform-gpu ${!isTransparent
        ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl backdrop-saturate-150 shadow-lg shadow-gray-200/50 dark:shadow-gray-950/50'
        : 'bg-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-12">
          <Link
            href={`/${locale}`}
            className="flex-shrink-0 flex items-center hover:opacity-90 transition-opacity duration-300 focus-visible:outline-none"
            onClick={() => setIsMenuOpen(false)}
          >
            <div className="relative h-8 sm:h-10 w-auto flex items-center">
              {/* NOL Part - Always original color */}
              <Image
                src={siteConfig.logo}
                alt={siteConfig.name}
                height={40}
                width={200}
                className="h-full w-auto object-contain"
                style={{
                  clipPath: 'inset(0 0 0 52.3%)', // Show only the right part (NOL)
                }}
                priority
              />
              {/* Studio Part - Turns white on dark/transparent backgrounds */}
              <Image
                src={siteConfig.logo}
                alt=""
                aria-hidden="true"
                height={40}
                width={200}
                className="h-full w-auto object-contain absolute top-0 left-0 transition-[filter] duration-300"
                style={{
                  clipPath: 'inset(0 47.7% 0 0)', // Show only the left part (studio)
                  filter: (isTransparent || isDarkMode)
                    ? 'brightness(0) invert(1) brightness(1.2)' // Make it white
                    : 'none'
                }}
                priority
              />
            </div>
          </Link>

          <nav className="hidden xl:flex items-center gap-x-2">
            {navGroups.map((group) => (
              <DropdownMenu
                key={group.id}
                label={group.label}
                items={group.items}
                isTransparent={isTransparent}
                currentPath={currentPath}
                onNavigate={handleNavigate}
              />
            ))}
          </nav>

          <div className="flex-shrink-0 flex items-center space-x-2 sm:space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <button
                className={`p-2 rounded-full transition-colors duration-300 ${!isTransparent
                  ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'text-white hover:bg-white/20'
                  }`}
                onClick={toggleDarkMode}
                aria-label={isDarkMode ? t('actions.toggleThemeLight') : t('actions.toggleThemeDark')}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <LanguageSwitcher
                currentLocale={locale}
                isFloating={isTransparent}
              />
            </div>

            <a
              href={siteConfig.contact.kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('actions.kakaoExternal')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 whitespace-nowrap border ${!isTransparent
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:shadow-lg border-transparent'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm'
                }`}
            >
              {t('actions.kakao')}
            </a>

            <button
              className={`xl:hidden p-2 rounded-full transition-colors duration-300 ${!isTransparent
                ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'text-white hover:bg-white/20'
                }`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label={isMenuOpen ? t('actions.closeMenu') : t('actions.openMenu')}
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <m.nav
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="xl:hidden z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl border-t border-gray-100 dark:border-gray-800 origin-top"
          >
            <div className="px-4 py-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* 모바일 테마/언어 스위처 */}
              <div className="flex flex-col gap-4 pb-4 border-b border-gray-100 dark:border-gray-800 sm:hidden">
                <button
                  className="flex items-center justify-between w-full px-3 py-2 text-left font-bold text-gray-900 dark:text-white focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                  onClick={toggleDarkMode}
                  aria-label={isDarkMode ? t('actions.toggleThemeLight') : t('actions.toggleThemeDark')}
                >
                  <div className="flex items-center gap-2">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span>{isDarkMode ? t('theme.light') : t('theme.dark')}</span>
                  </div>
                </button>
                <LanguageSwitcher
                  currentLocale={locale}
                  isFloating={false}
                  variant="inline"
                />
              </div>

              {navGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={expandedGroups.includes(group.id)}
                    className="flex items-center justify-between w-full px-3 py-2 text-left font-bold text-gray-900 dark:text-white focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                  >
                    {group.label}
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-200 ${expandedGroups.includes(group.id) ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence>
                    {expandedGroups.includes(group.id) && (
                      <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="pl-4 space-y-1 overflow-hidden"
                      >
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={`block px-3 py-2 text-sm rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary ${currentPath === item.href
                              ? 'bg-primary/10 text-primary dark:text-accent font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
});

Header.displayName = 'Header';