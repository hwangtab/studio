import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { locales, localeNames, type Locale } from '../lib/i18n';
import { isRoutePatternPath } from '../lib/routePattern';
import { DUR, EASE_STANDARD, TRANSITION_STANDARD } from '../utils/animationUtils';

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
  const localeItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
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

    // `/[locale]/contact` 류의 라우트 패턴 URL(404) 위에서는 어느 세그먼트를 바꿔도
    // 깨진 경로만 나온다. 그대로 두면 404 페이지가 깨진 링크를 클릭 가능한 형태로
    // 재생산해 퍼뜨린다. 해당 로케일 홈으로 탈출시킨다.
    if (isRoutePatternPath(path)) {
      return `/${targetLocale}`;
    }

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
          <span className={`text-xs transition-transform duration-base ease-standard ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <AnimatePresence>
          {isOpen && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION_STANDARD}
              className="pl-4 mt-3 space-y-1 pb-4 overflow-hidden"
            >
              <div className={`grid ${menuGridClass} gap-2`}>
                {locales.map((locale) => (
                  <Link
                    key={locale}
                    href={getPathForLocale(locale)}
                    hrefLang={locale}
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
            </m.div>
          )}
        </AnimatePresence>
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
        // 언어 전환은 로케일 URL로 이동하는 "네비게이션 링크 목록"이므로 ARIA menu가 아닌
        // disclosure 패턴이 맞다(WAI-ARIA APG는 네비게이션에 role=menu 대신 disclosure 권장).
        // 팝업은 <ul>+<Link> 링크 목록이며 roving tabindex 등 menu 키보드 모델이 없다 —
        // aria-haspopup="menu"는 SR에 menu/menuitem을 약속하는 거짓 계약이었다. 제거하고
        // aria-expanded만으로 열림/닫힘을 알린다(화살표 키 이동은 부가 향상으로 유지).
        aria-expanded={isOpen}
        // WCAG 2.5.3 (Label in Name): 접근 가능한 이름은 보이는 텍스트로 시작해야 한다.
        // 기존 aria-label={t('common.languageSelector')}는 보이는 텍스트(localeNames[currentLocale])와
        // 불일치하여 Lighthouse a11y에서 label-content-name-mismatch로 실패.
        aria-label={`${localeNames[currentLocale]} — ${t('common.languageSelector')}`}
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
      <AnimatePresence>
      {isOpen && (
        <m.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: DUR.fast, ease: EASE_STANDARD }}
          onBlur={(e) => {
            if (!menuRef.current?.contains(e.relatedTarget as Node) && !buttonRef.current?.contains(e.relatedTarget as Node)) {
              setIsOpen(false);
            }
          }}
          className={`
            absolute right-0 top-full mt-2 origin-top-right ${menuWidthClass} max-w-[90vw] max-h-[60vh] overflow-y-auto overscroll-contain
            rounded-xl glass-regular py-2 z-[100]
          `}
        >
          <ul className={`grid ${menuGridClass} gap-1 px-2`} aria-label={t('common.languageOptions')}>
            {locales.map((locale, idx) => (
              <li key={locale}>
                <Link
                  ref={(el) => { localeItemRefs.current[idx] = el; }}
                  href={getPathForLocale(locale)}
                  hrefLang={locale}
                  onClick={() => setIsOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      localeItemRefs.current[(idx + 1) % locales.length]?.focus();
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      localeItemRefs.current[(idx - 1 + locales.length) % locales.length]?.focus();
                    } else if (e.key === 'Escape') {
                      setIsOpen(false);
                      buttonRef.current?.focus();
                    }
                  }}
                  className={`
                    px-3 py-2 sm:px-2 sm:py-1.5 min-h-[44px] sm:min-h-[36px] rounded text-sm sm:text-xs font-bold text-left transition-colors duration-200 touch-manipulation
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
                    ${currentLocale === locale
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 hover:bg-white/45 dark:hover:bg-white/10'}
                  `}
                  aria-current={currentLocale === locale ? 'page' : undefined}
                >
                  {localeNames[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </m.div>
      )}
      </AnimatePresence>
    </div>
  );
};
