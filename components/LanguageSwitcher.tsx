import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { locales, localeNames, type Locale } from '../lib/i18n';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  isFloating: boolean; // Whether it's on a transparent/hero background
  variant?: 'dropdown' | 'inline';
}

export const LanguageSwitcher = ({
  currentLocale,
  isFloating,
  variant = 'dropdown'
}: LanguageSwitcherProps) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: currentLocale });
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (variant === 'inline') return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  }, [variant]);

  const handleMouseLeave = useCallback(() => {
    if (variant === 'inline') return;
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [variant]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getPathForLocale = useCallback((targetLocale: Locale) => {
    const path = router.asPath;
    const segments = path.split('/');

    if (locales.includes(segments[1] as Locale)) {
      segments[1] = targetLocale;
      return segments.join('/') || '/';
    }

    return `/${targetLocale}${path === '/' ? '' : path}`;
  }, [router.asPath]);

  useEffect(() => {
    if (!router?.events) return undefined;
    const handleRouteChange = () => setIsOpen(false);
    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router?.events]);

  useEffect(() => {
    if (!isOpen || variant === 'inline') return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [isOpen, variant]);

  const menuCols = useMemo(() => {
    if (locales.length >= 10) return 3;
    if (locales.length >= 6) return 2;
    return 1;
  }, []);

  const menuWidthClass = menuCols === 1 ? 'w-44' : menuCols === 2 ? 'w-60' : 'w-80';
  const menuGridClass = menuCols === 1
    ? 'grid-cols-1'
    : menuCols === 2
      ? 'grid-cols-2'
      : 'grid-cols-2 sm:grid-cols-3';

  if (variant === 'inline') {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center justify-between w-full min-h-[44px] px-3 py-2 text-left font-bold text-gray-900 dark:text-white touch-manipulation rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          <div className="flex items-center gap-2">
            <span>🌐</span>
            <span>{localeNames[currentLocale]}</span>
          </div>
          <span className={`text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {isOpen && (
          <div className="pl-4 mt-3 space-y-1 pb-4">
            <div className={`grid ${menuGridClass} gap-2`}>
              {locales.map((locale) => (
                <Link
                  key={locale}
                  href={getPathForLocale(locale)}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center min-h-[44px] px-3 py-2 rounded-lg text-sm transition-colors text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
                    ${currentLocale === locale
                      ? 'bg-primary/10 text-primary dark:text-accent font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  {localeNames[locale]}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('common.languageSelector')}
        className={`
          inline-flex items-center gap-1 px-2 py-2 sm:px-3 sm:py-2 min-h-[44px] sm:min-h-[36px] rounded-md text-sm sm:text-xs font-bold tracking-normal transition-colors duration-200 touch-manipulation
          max-w-[120px] sm:max-w-[160px]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
          ${isOpen
            ? !isFloating
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white/20 text-white shadow-sm'
            : ''}
          ${!isOpen && !isFloating
            ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            : !isOpen
              ? 'text-white/90 hover:text-white hover:bg-white/10'
              : ''}
        `}
      >
        <span className="truncate max-w-[72px] sm:max-w-[120px]">{localeNames[currentLocale]}</span>
        <span className="text-[10px] opacity-80 flex-shrink-0">▾</span>
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className={`
            absolute right-0 top-full mt-2 ${menuWidthClass} max-w-[90vw] max-h-[60vh] overflow-y-auto overscroll-contain
            rounded-xl border border-gray-200/70 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl
            shadow-2xl py-2 z-[100]
          `}
        >
          <ul className={`grid ${menuGridClass} gap-1 px-2`} aria-label={t('common.languageOptions')}>
            {locales.map((locale) => (
              <li key={locale}>
                <Link
                  href={getPathForLocale(locale)}
                  onClick={() => setIsOpen(false)}
                  className={`
                    px-3 py-2 sm:px-2 sm:py-1.5 min-h-[44px] sm:min-h-[36px] rounded text-sm sm:text-xs font-bold text-left transition-colors duration-200 touch-manipulation
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
                    ${currentLocale === locale
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'}
                  `}
                  aria-current={currentLocale === locale ? 'page' : undefined}
                >
                  {localeNames[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
