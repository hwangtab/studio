import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { m, AnimatePresence } from 'framer-motion';
import { Sun, Moon, ChevronDown } from 'lucide-react';
import { type TFunction } from 'i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { type Locale } from '../../lib/i18n';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollLock';
import { useFocusTrapDialog } from '../../utils/useFocusTrapDialog';

interface NavGroup {
  id: string;
  label: string;
  items: { label: string; href: string; }[];
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  currentPath: string;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  locale: Locale;
  navId: string;
  t: TFunction;
}

export const MobileNav = ({
  isOpen,
  onClose,
  navGroups,
  currentPath,
  isDarkMode,
  toggleDarkMode,
  locale,
  navId,
  t
}: MobileNavProps) => {
  const navRef = useRef<HTMLElement>(null);
  const bodyLockCountRef = useRef(0);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  }, []);


  const acquireBodyLock = useCallback(() => {
    lockBodyScroll();
    bodyLockCountRef.current += 1;
  }, []);

  const releaseBodyLock = useCallback(() => {
    if (bodyLockCountRef.current === 0) return;
    unlockBodyScroll();
    bodyLockCountRef.current -= 1;
  }, []);

  const { restoreFocus } = useFocusTrapDialog({
    isOpen,
    containerRef: navRef,
    onClose,
    eventTarget: 'window',
    restoreOnCleanup: false,
  });

  useEffect(() => {
    if (!isOpen) return;

    // body overflow:hidden은 데스크톱·일부 환경만 차단. iOS Safari·Android Chrome은
    // touch scroll이 그대로 통과하므로 메뉴 외부 touchmove를 preventDefault로 차단한다.
    // body position:fixed 패턴은 stacking context를 새로 만들어 메뉴를 가리는 회귀가 있어
    // 사용하지 않는다. handleScroll 자동 닫기도 모바일 UX와 충돌해 제거 — 메뉴 닫기는
    // X 버튼·외부 클릭·focus trap의 esc로만.
    const handleTouchMove = (event: TouchEvent) => {
      const target = event.target as Node | null;
      if (target && navRef.current && navRef.current.contains(target)) return;
      event.preventDefault();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    if (bodyLockCountRef.current === 0) {
      acquireBodyLock();
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [acquireBodyLock, isOpen]);

  useEffect(() => {
    return () => {
      while (bodyLockCountRef.current > 0) {
        releaseBodyLock();
      }
    };
  }, [releaseBodyLock]);

  const handleExitComplete = () => {
    releaseBodyLock();
    restoreFocus();
  };

  return (
    <AnimatePresence initial={false} onExitComplete={handleExitComplete}>
      {isOpen && (
        <m.nav
          id={navId}
          ref={navRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.mobileMenu')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="xl:hidden z-40 bg-gradient-to-b from-white/95 to-gray-50/95 dark:from-gray-900/95 dark:to-black/95 backdrop-blur-xl shadow-2xl border-t border-gray-100 dark:border-gray-800 origin-top"
        >
          <div className="px-4 py-4 space-y-3 max-h-[80vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Mobile Theme/Language Switcher */}
            <m.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col gap-2 pb-3 border-b border-gray-100 dark:border-gray-800 sm:hidden"
            >
              <button
                type="button"
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
            </m.div>

            {navGroups.map((group, groupIndex) => (
              <m.div 
                key={group.id} 
                className="space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 + (groupIndex * 0.05) }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={expandedGroups.includes(group.id)}
                  className="flex items-center justify-between w-full min-h-[44px] px-3 py-2 text-left font-bold text-gray-900 dark:text-white touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-lg"
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
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pl-4 space-y-1 overflow-hidden"
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          aria-current={currentPath === item.href ? 'page' : undefined}
                          className={`flex items-center min-h-[44px] px-3 py-2 text-sm rounded-lg transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${currentPath === item.href
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
              </m.div>
            ))}
          </div>
        </m.nav>
      )}
    </AnimatePresence>
  );
};
