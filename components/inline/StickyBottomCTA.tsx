import React from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Phone, X } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import { CANONICAL_FACTS } from '../../lib/factTokens';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { useKakaoBlockInView } from '../common/kakaoBlockVisibility';

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
  // 본문 카톡 블록(ContactCTA)이 보이는 동안 숨긴다 — 같은 카톡 버튼이 한 화면에 둘이 되지 않게.
  const blockInView = useKakaoBlockInView();
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  // 전화는 로컬 서비스업의 1순위 전환 행동인데, 스토리 상세에서 상시 노출되는 진입점이
  // 카카오뿐이었다. 40~60대 로컬 고객(연습실 월세 문의층)은 오픈채팅보다 전화를 쓴다.
  // href를 국제표기(+82)로 두면 국내·해외 어디서 눌러도 정상 연결된다.
  const telHref = `tel:${CANONICAL_FACTS.phoneIntl.replace(/[^0-9+]/g, '')}`;

  const trackPhoneClick = React.useCallback(() => {
    trackLeadEvent('lead_click_phone', {
      locale,
      component: 'StickyBottomCTA',
      cta_id: 'sticky_bottom_phone',
    });
  }, [locale]);

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

  if (dismissed || !visible || blockInView) return null;

  return (
    <div
      role="region"
      aria-label={t('stories.sticky.label', { defaultValue: '고정 문의 바' })}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      // 흰 면(다크는 gray-900) — 휴대폰 하단 바(KakaoFab bar)와 같은 재질. 예전엔 Notice의 warning(앰버) 톤이었는데
      // 판매 안내에 "주의" 색을 쓴 셈이었다(2026-10-09 스토리 CTA 기준). 카톡만 옐로, 가격은 파랑 링크, 전화는 weak.
      className="fixed inset-x-4 bottom-4 sm:bottom-8 z-50 max-w-2xl sm:mx-auto rounded-xl border border-gray-200 bg-white/95 text-gray-900 shadow-lg backdrop-blur p-4 flex items-center gap-3 dark:border-gray-800 dark:bg-gray-900/95 dark:text-gray-100"
    >
      <div className="flex-shrink-0 inline-flex items-center justify-center p-2 rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
        <MessageCircle className="text-gray-700 dark:text-gray-300" size={18} />
      </div>
      <p className="flex-1 typo-card-body text-sm text-gray-800 dark:text-gray-200 truncate">
        {t('stories.sticky.headline', { defaultValue: '예약·문의는 카카오톡으로' })}
      </p>
      <Button asChild variant="kakao" shape="block" size="md">
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={trackKakaoClick}
          className="hidden sm:inline-flex gap-1 h-auto min-h-[44px] px-4 py-2 text-sm font-bold touch-manipulation focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          {t('stories.sticky.kakao', { defaultValue: '카카오톡' })}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </Button>
      <Link
        href={`/${locale}/pricing`}
        prefetch={false}
        className="hidden sm:inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        {t('nav.pricing')}
      </Link>
      <a
        href={telHref}
        onClick={trackPhoneClick}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 text-primary-dark dark:bg-primary-lighter/15 dark:text-primary-lighter hover:bg-primary/15 dark:hover:bg-primary-lighter/20 active:scale-[0.96] transition-[background-color,transform] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        aria-label={t('stories.sticky.phone', { defaultValue: '전화 문의' })}
      >
        <Phone size={20} aria-hidden="true" />
      </a>
      <Button asChild variant="kakao" shape="pill" size="icon">
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={trackKakaoClick}
          className="sm:hidden touch-manipulation focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          aria-label={t('stories.sticky.kakao', { defaultValue: '카카오톡' })}
        >
          <MessageCircle size={20} aria-hidden="true" />
        </a>
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        aria-label={t('stories.sticky.dismiss', { defaultValue: '닫기' })}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default React.memo(StickyBottomCTA);
