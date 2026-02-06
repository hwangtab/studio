import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  const { t } = useTranslation('common');
  const currentPath = router.asPath;
  const siteConfig = getSiteConfig(locale);

  useEffect(() => {
    const handleScroll = () => {
      if (isMenuOpen) setIsMenuOpen(false);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMenuOpen]);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const navGroups = useMemo(() => [
    {
      id: 'services',
      label: t('nav.groups.services'),
      items: [
        { label: t('nav.about'), href: `/${locale}/about` },
        { label: t('nav.pricing'), href: `/${locale}/pricing` },
        { label: t('nav.equipment'), href: `/${locale}/studio-info` },
      ]
    },
    {
      id: 'space',
      label: t('nav.groups.space'),
      items: [
        { label: t('nav.practiceRoom'), href: `/${locale}/practice-room` },
        { label: t('nav.lesson'), href: `/${locale}/lesson` },
      ]
    },
    {
      id: 'contents',
      label: t('nav.groups.contents'),
      items: [
        { label: t('nav.portfolio'), href: `/${locale}/portfolio` },
        { label: t('nav.stories'), href: `/${locale}/stories` },
      ]
    }
  ], [t, locale]);

  const handleNavigate = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <header
      ref={ref}
      className={`fixed w-full z-50 transition-[background-color,box-shadow] duration-300 py-4 backdrop-blur-xl ${isScrolled
        ? 'bg-white/80 dark:bg-gray-900/80 shadow-lg shadow-gray-200/50 dark:shadow-gray-950/50'
        : hasHero
          ? 'bg-transparent shadow-lg shadow-transparent'
          : 'bg-gradient-to-r from-primary via-secondary to-accent shadow-lg shadow-primary/20'
        }`}
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/${locale}`}
            className={`${isScrolled || !hasHero ? 'text-primary dark:text-white' : 'text-white'}
              flex-shrink-0 flex items-center text-2xl sm:text-3xl font-logo leading-none tracking-tight hover:opacity-90 transition-opacity duration-300 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`}
            onClick={() => setIsMenuOpen(false)}
          >
            {siteConfig.name}
          </Link>

          <nav className="hidden xl:flex items-center gap-x-2">
            {navGroups.map((group) => (
              <DropdownMenu
                key={group.id}
                label={group.label}
                items={group.items}
                isScrolled={isScrolled}
                hasHero={hasHero}
                currentPath={currentPath}
                onNavigate={handleNavigate}
              />
            ))}
          </nav>

          <div className="flex-shrink-0 flex items-center space-x-2 sm:space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <button
                className={`p-2 rounded-full transition-colors duration-300 ${isScrolled || !hasHero
                  ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'text-white hover:bg-white/20'
                  }`}
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <LanguageSwitcher
                currentLocale={locale}
                isScrolled={isScrolled}
                hasHero={hasHero || false}
              />
            </div>

            <Link
              href={`/${locale}/contact`}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 whitespace-nowrap ${isScrolled || !hasHero
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:shadow-lg'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-sm'
                }`}
            >
              {t('nav.contact')}
            </Link>

            <button
              className={`xl:hidden p-2 rounded-full transition-colors duration-300 ${isScrolled || !hasHero
                ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'text-white hover:bg-white/20'
                }`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.nav
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
                  className="flex items-center justify-between w-full px-3 py-2 text-left font-bold text-gray-900 dark:text-white"
                  onClick={toggleDarkMode}
                >
                  <div className="flex items-center gap-2">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span>{isDarkMode ? 'Light' : 'Dark'} Mode</span>
                  </div>
                </button>
                <LanguageSwitcher
                  currentLocale={locale}
                  isScrolled={true}
                  hasHero={false}
                  variant="inline"
                />
              </div>

              {navGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center justify-between w-full px-3 py-2 text-left font-bold text-gray-900 dark:text-white"
                  >
                    {group.label}
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-200 ${expandedGroups.includes(group.id) ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence>
                    {expandedGroups.includes(group.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="pl-4 space-y-1 overflow-hidden"
                      >
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={`block px-3 py-2 text-sm rounded-lg transition-colors ${currentPath === item.href
                              ? 'bg-primary/10 text-primary dark:text-accent font-medium'
                              : 'text-gray-600 dark:text-gray-400'
                              }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
});

Header.displayName = 'Header';