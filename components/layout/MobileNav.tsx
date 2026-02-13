import React, { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { m, AnimatePresence } from 'framer-motion';
import { Sun, Moon, ChevronDown } from 'lucide-react';
import { type TFunction } from 'i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { type Locale } from '../../lib/i18n';
import { useIsIOSSafari } from '../../utils/deviceUtils';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollLock';

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
  isTransparent: boolean;
  navId: string;
  disableEffects?: boolean;
  expandedGroups: string[];
  toggleGroup: (group: string) => void;
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
  disableEffects = false,
  expandedGroups,
  toggleGroup,
  t
}: MobileNavProps) => {
  const navRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const bodyLockCountRef = useRef(0);
  const isIOSSafari = useIsIOSSafari();
  const shouldAnimate = !disableEffects;
  const navInitial = shouldAnimate
    ? (isIOSSafari ? { opacity: 0 } : { opacity: 0, scaleY: 0 })
    : false;
  const navAnimate = isIOSSafari ? { opacity: 1 } : { opacity: 1, scaleY: 1 };
  const navExit = shouldAnimate
    ? (isIOSSafari ? { opacity: 0 } : { opacity: 0, scaleY: 0 })
    : navAnimate;
  const shouldAnimateGroups = shouldAnimate && !isIOSSafari;

  const acquireBodyLock = useCallback(() => {
    lockBodyScroll();
    bodyLockCountRef.current += 1;
  }, []);

  const releaseBodyLock = useCallback(() => {
    if (bodyLockCountRef.current === 0) return;
    unlockBodyScroll();
    bodyLockCountRef.current -= 1;
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Capture the trigger element (previously focused element) when nav opens
    triggerRef.current = document.activeElement as HTMLElement;

    const handleScroll = () => onClose();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = navRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

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

    if (bodyLockCountRef.current === 0) {
      acquireBodyLock();
    }

    // Set initial focus to first focusable element in nav
    const focusableElements = navRef.current?.querySelectorAll<HTMLElement>(
      'button, a[href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('keydown', handleFocusTrap);
    };
  }, [acquireBodyLock, isOpen, onClose]);

  useEffect(() => {
    return () => {
      while (bodyLockCountRef.current > 0) {
        releaseBodyLock();
      }
    };
  }, [releaseBodyLock]);

  const handleExitComplete = () => {
    releaseBodyLock();
    if (triggerRef.current && triggerRef.current.focus) {
      triggerRef.current.focus();
    }
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
           initial={navInitial}
           animate={navAnimate}
           exit={navExit}
           transition={shouldAnimate ? (isIOSSafari ? { duration: 0, ease: 'linear' as const } : { duration: 0.2, ease: 'easeOut' as const }) : { duration: 0 }}
           className={`xl:hidden z-40 bg-white/95 dark:bg-gray-900/95 ${disableEffects ? '' : 'backdrop-blur-xl'} shadow-2xl border-t border-gray-100 dark:border-gray-800 origin-top ${isIOSSafari ? 'ios-stable-layer' : ''}`}
         >
          <div className="px-4 py-6 space-y-4 max-h-[80vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Mobile Theme/Language Switcher */}
            <div className="flex flex-col gap-4 pb-4 border-b border-gray-100 dark:border-gray-800 sm:hidden">
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
            </div>

            {navGroups.map((group) => (
              <div key={group.id} className="space-y-2">
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
                      initial={shouldAnimateGroups ? { height: 0, opacity: 0 } : false}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={shouldAnimateGroups ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
                      transition={shouldAnimateGroups ? { duration: 0.2, ease: 'easeInOut' } : { duration: 0 }}
                      className="pl-4 space-y-1 overflow-hidden"
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={`block min-h-[44px] px-3 py-2 text-sm rounded-lg transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${currentPath === item.href
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
  );
};
