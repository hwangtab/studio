import React from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle, X } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface StickyBottomCTAProps {
  /** article 시작 직전 invisible marker ref */
  markerRef: React.RefObject<HTMLElement | null>;
  locale: Locale;
}

const DISMISS_KEY = 'sticky-cta-dismissed-until';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

const isDismissedNow = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
};

const StickyBottomCTA = ({ markerRef, locale }: StickyBottomCTAProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const trackKakaoClick = React.useCallback(() => {
    trackLeadEvent('lead_click_kakao', {
      locale,
      component: 'StickyBottomCTA',
      cta_id: 'sticky_bottom_kakao',
    });
  }, [locale]);

  const [visible, setVisible] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    setDismissed(isDismissedNow());
  }, []);

  React.useEffect(() => {
    if (dismissed) return;
    const target = markerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const movedAbove = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setVisible(movedAbove);
      },
      { rootMargin: '0px', threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [markerRef, dismissed]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
    } catch {
      // localStorage 차단 환경 silent ignore
    }
    setDismissed(true);
  };

  if (dismissed || !visible) return null;

  return (
    <div
      role="region"
      aria-label={t('stories.sticky.label', { defaultValue: '고정 문의 바' })}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      className="fixed inset-x-4 bottom-4 sm:bottom-8 z-50 max-w-2xl sm:mx-auto rounded-xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/30 shadow-lg p-4 flex items-center gap-3"
    >
      <div className="flex-shrink-0 inline-flex items-center justify-center p-2 rounded-full bg-amber-300/40 dark:bg-amber-500/30" aria-hidden="true">
        <MessageCircle className="text-amber-700 dark:text-amber-300" size={18} />
      </div>
      <p className="flex-1 typo-card-body text-sm text-gray-800 dark:text-gray-200 truncate">
        {t('stories.sticky.headline', { defaultValue: '예약·문의는 카카오톡으로' })}
      </p>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackKakaoClick}
        className="hidden sm:inline-flex items-center gap-1 px-4 py-2 rounded-full bg-kakao hover:bg-kakao-dark text-kakao-ink text-sm font-bold min-h-[44px] touch-manipulation"
      >
        {t('stories.sticky.kakao', { defaultValue: '카카오톡' })}
        <ArrowRight size={14} aria-hidden="true" />
      </a>
      <Link
        href={`/${locale}/pricing`}
        prefetch={false}
        className="hidden sm:inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline min-h-[44px] touch-manipulation"
      >
        {t('nav.pricing')}
      </Link>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackKakaoClick}
        className="sm:hidden inline-flex items-center justify-center w-11 h-11 rounded-full bg-kakao hover:bg-kakao-dark text-kakao-ink touch-manipulation"
        aria-label={t('stories.sticky.kakao', { defaultValue: '카카오톡' })}
      >
        <MessageCircle size={20} aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-amber-200 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 touch-manipulation"
        aria-label={t('stories.sticky.dismiss', { defaultValue: '닫기' })}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default React.memo(StickyBottomCTA);
