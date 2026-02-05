import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { locales, localeNames, type Locale } from '../lib/i18n';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  isScrolled: boolean;
  hasHero: boolean;
}

export const LanguageSwitcher = ({ currentLocale, isScrolled, hasHero }: LanguageSwitcherProps) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const getPathForLocale = (targetLocale: Locale) => {
    const path = router.asPath;
    const segments = path.split('/');
    // segments[0] is empty
    // segments[1] is usually the locale in our new structure
    
    if (locales.includes(segments[1] as Locale)) {
       segments[1] = targetLocale;
       return segments.join('/') || '/';
    }
    
    // Fallback for root or other paths
    return `/${targetLocale}${path === '/' ? '' : path}`;
  };

  useEffect(() => {
    if (!router?.events) return undefined;
    const handleRouteChange = () => setIsOpen(false);
    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router?.events]);

  useEffect(() => {
    if (!isOpen) return undefined;
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
  }, [isOpen]);

  const menuCols = useMemo(() => {
    if (locales.length >= 10) return 3;
    if (locales.length >= 6) return 2;
    return 1;
  }, []);

  const menuWidthClass = menuCols === 1 ? 'w-40' : menuCols === 2 ? 'w-56' : 'w-72';
  const menuGridClass = menuCols === 1 ? 'grid-cols-1' : menuCols === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="relative flex items-center ml-2">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Language selector"
        className={`
          inline-flex items-center gap-2 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-md text-sm sm:text-xs font-bold uppercase tracking-wide transition-colors duration-200
          ${isOpen ? 'bg-primary text-white shadow-sm' : ''}
          ${!isOpen && (isScrolled || !hasHero)
            ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            : !isOpen
              ? 'text-gray-300 hover:text-white hover:bg-white/10'
              : ''}
        `}
      >
        <span>{localeNames[currentLocale]}</span>
        <span className="text-[10px] opacity-80">▾</span>
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={`
            absolute right-0 top-full mt-2 ${menuWidthClass} max-h-[60vh] overflow-y-auto overscroll-contain
            rounded-lg border border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-900
            shadow-lg py-2 z-50
          `}
        >
          <div className={`grid ${menuGridClass} gap-1 px-2`}>
            {locales.map((locale) => (
              <Link
                key={locale}
                href={getPathForLocale(locale)}
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className={`
                  px-3 py-2 sm:px-2 sm:py-1.5 rounded text-sm sm:text-xs font-bold text-left transition-colors duration-200
                  ${currentLocale === locale
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'}
                `}
                aria-current={currentLocale === locale ? 'page' : undefined}
              >
                {localeNames[locale]}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
