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
  isTransparent: boolean;
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

    const scrollYAtOpen = window.scrollY;
    const handleScroll = () => {
      // iOS WebKit sometimes fires window scroll events during internal overflow scroll.
      // Only close if the page itself has scrolled from its position when the menu opened.
      if (Math.abs(window.scrollY - scrollYAtOpen) > 4) onClose();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    if (bodyLockCountRef.current === 0) {
      acquireBodyLock();
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
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
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="xl:hidden z-40 bg-gradient-to-b from-canvas/95 to-canvas-warm/95 dark:from-canvas-deep/95 dark:to-canvas-deep/95 backdrop-blur-xl shadow-card border-t border-hairline dark:border-white/10 origin-top"
        >
          <div className="px-4 py-4 space-y-3 max-h-[80vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Mobile Theme/Language Switcher */}
            <m.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col gap-2 pb-3 border-b border-hairline dark:border-white/10 sm:hidden"
            >
              <button
                type="button"
                className="flex items-center justify-between w-full px-3 py-2 text-left font-bold text-ink dark:text-on-dark focus-visible:ring-2 focus-visible:ring-link-focus rounded-lg"
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
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + (groupIndex * 0.1) }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={expandedGroups.includes(group.id)}
                  className="flex items-center justify-between w-full min-h-[44px] px-3 py-2 text-left font-bold text-ink dark:text-on-dark touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep rounded-lg"
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
                          onClick={onClose}
                          aria-current={currentPath === item.href ? 'page' : undefined}
                          className={`flex items-center min-h-[44px] px-3 py-2 text-sm rounded-lg transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep ${currentPath === item.href
                            ? 'bg-ink/[0.06] text-link dark:text-link-on-dark font-medium'
                            : 'text-ink-muted-60 dark:text-on-dark-soft hover:bg-ink/[0.04] dark:hover:bg-white/[0.06]'
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
