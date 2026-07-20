import React, { useEffect, useState } from 'react';
import { ArrowUp } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { defaultLocale, type Locale } from '../../lib/i18n';
import { getScrollBehavior } from '../../utils/scrollUtils';

interface ScrollToTopProps {
  locale?: Locale;
}

// iOS Safari 잔존 깜빡 fix:
// - framer-motion AnimatePresence + m.div 제거 → mount/unmount 시 paint frame jank 차단
// - 항상 DOM에 mount + opacity·pointer-events CSS toggle만 — paint 비용 거의 0
// - rAF throttle로 scroll listener thrashing 방지 (300px 경계 빠른 toggle 차단)
// 재질: variant="glass" (리퀴드 글래스 리뉴얼). 과거 "backdrop-blur-md 제거(iOS GPU)"
// 결정은 글래스 토큰의 모바일 자동 솔리드 폴백(styles/globals.css)이 대체한다 —
// 터치 기기에서는 filter 비용 0인 솔리드로 강등되므로 당시 우려가 재발하지 않는다.
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
    window.scrollTo({ top: 0, behavior: getScrollBehavior() });
  };

  return (
    <div
      className={`fixed bottom-24 right-6 sm:right-8 z-40 transition-opacity duration-200 ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!isVisible}
    >
      <Button
        variant="glass"
        size="icon"
        onClick={scrollToTop}
        className="rounded-full"
        aria-label={t('actions.scrollToTop')}
        tabIndex={isVisible ? 0 : -1}
      >
        <ArrowUp size={20} className="text-gray-600 dark:text-gray-300" />
      </Button>
    </div>
  );
};
