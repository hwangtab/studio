import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { m, AnimatePresence } from 'framer-motion';
import { Sun, Moon, ChevronDown } from '@/lib/lucide-icons';
import { TRANSITION_STANDARD } from '../../utils/animationUtils';
import { type TFunction } from 'i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { type Locale } from '../../lib/i18n';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollLock';
import { useFocusTrapDialog } from '../../utils/useFocusTrapDialog';

// iOS Safari 메뉴 깜빡 잔존 fix(2026-05-11):
// AnimatePresence + m.nav 조합이 mount/unmount lifecycle 한 frame 동안 paint job 유발.
// reducedMotion='always'로 transition.duration=0 처리해도 lifecycle 자체가 비용.
// → AnimatePresence·m.nav 제거. plain <nav>를 항상 mount하고 CSS opacity·visibility로만
//   토글. iOS GPU 부담 0, lifecycle paint frame 0.
// 메뉴 그룹 expand는 그대로 framer-motion 유지 (사용자 클릭 시점 단발 동작).

interface NavGroup {
  id: string;
  label: string;
  items: { label: string; href: string; }[];
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  quickLinks: { label: string; href: string; }[];
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
  quickLinks,
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
    // 사용하지 않는다. 메뉴 닫기는 X 버튼·외부 클릭·focus trap의 esc로만.
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
      // isOpen=false 또는 unmount 시 cleanup — body lock 해제 + focus 복원.
      // (이전 AnimatePresence onExitComplete가 처리하던 일을 effect cleanup으로 이동.)
      while (bodyLockCountRef.current > 0) {
        releaseBodyLock();
      }
      restoreFocus();
    };
  }, [acquireBodyLock, isOpen, releaseBodyLock, restoreFocus]);

  return (
    <nav
      id={navId}
      ref={navRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('nav.mobileMenu')}
      aria-hidden={!isOpen}
      className={`lg:hidden fixed inset-x-0 top-16 z-40 bg-white dark:bg-gray-900 shadow-2xl border-t border-gray-100 dark:border-gray-800 origin-top transition-opacity duration-base ease-standard ${isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'}`}
    >
      <div className="px-4 py-4 space-y-3 max-h-[80vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex flex-col gap-2 pb-3 border-b border-gray-100 dark:border-gray-800 sm:hidden">
          <button
            type="button"
            className="flex items-center justify-between w-full px-3 py-2 text-left font-bold text-gray-900 dark:text-white focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? t('actions.toggleThemeLight') : t('actions.toggleThemeDark')}
            tabIndex={isOpen ? 0 : -1}
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

        {/* 그룹 밖 고정 퀵링크 — 가격·문의·포트폴리오. 아코디언을 펼치지 않아도 1탭 도달.
            prefetch={false}: 이 <nav>는 메뉴 열림 여부와 무관하게 모든 페이지에서 항상
            mount되어 있어(CSS opacity/visibility 토글) 기본 prefetch=true면 사이트 전역에서
            pricing/contact 등 청크를 상시 선다운로드해 폰트 등 critical 리소스와 대역폭을
            경쟁한다. hover/focus 시 prefetch는 유지. */}
        <div className="grid grid-cols-3 gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              onClick={onClose}
              aria-current={currentPath === link.href ? 'page' : undefined}
              tabIndex={isOpen ? 0 : -1}
              className={`flex items-center justify-center min-h-[44px] px-2 py-2 text-sm font-bold rounded-lg text-center transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${currentPath === link.href
                ? 'bg-primary text-white'
                : 'bg-primary/10 text-primary dark:text-accent hover:bg-primary/20'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {navGroups.map((group) => (
          <div key={group.id} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={expandedGroups.includes(group.id)}
              tabIndex={isOpen ? 0 : -1}
              className="flex items-center justify-between w-full min-h-[44px] px-3 py-2 text-left font-bold text-gray-900 dark:text-white touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-lg"
            >
              {group.label}
              <ChevronDown
                size={18}
                className={`transition-transform duration-base ease-standard ${expandedGroups.includes(group.id) ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {expandedGroups.includes(group.id) && (
                <m.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={TRANSITION_STANDARD}
                  className="pl-4 space-y-1 overflow-hidden"
                >
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={currentPath === item.href ? 'page' : undefined}
                      tabIndex={isOpen ? 0 : -1}
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
          </div>
        ))}
      </div>
    </nav>
  );
};
