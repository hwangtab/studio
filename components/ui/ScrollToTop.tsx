import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface ScrollToTopProps {
  locale?: Locale;
}

// iOS Safari 잔존 깜빡 fix:
// - framer-motion AnimatePresence + m.div 제거 → mount/unmount 시 paint frame jank 차단
// - 항상 DOM에 mount + opacity·pointer-events CSS toggle만 — paint 비용 거의 0
// - backdrop-blur-md 제거 → solid bg, iOS GPU 부담 감소
// - rAF throttle로 scroll listener thrashing 방지 (300px 경계 빠른 toggle 차단)
export const ScrollToTop = ({ locale = defaultLocale }: ScrollToTopProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let rafId = 0;
    let pending = false;
    const update = () => {
      pending = false;
      const next = window.scrollY > 300;
      setIsVisible((prev) => (prev !== next ? next : prev));
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`fixed bottom-8 right-8 z-50 transition-opacity duration-200 ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!isVisible}
    >
      <Button
        variant="secondary"
        size="icon"
        onClick={scrollToTop}
        className="rounded-full shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        aria-label={t('actions.scrollToTop')}
        tabIndex={isVisible ? 0 : -1}
      >
        <ArrowUp size={20} className="text-gray-600 dark:text-gray-300" />
      </Button>
    </div>
  );
};
