import React from 'react';
import { MessageCircle } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface KakaoFabProps {
  locale: Locale;
}

/**
 * 전 페이지 상시 노출 카카오톡 플로팅 버튼.
 *
 * 배경: GA4 90일 분석상 실질 전환은 lead_click_kakao 17건이 전부인데,
 * 상시 카카오 진입점이 stories 페이지(StickyBottomCTA)에만 있어 홈·연습실·
 * 가격 등 핵심 전환 페이지에서 진입점이 비어 있었다. 검증된 유일 전환 채널을
 * 모든 페이지·항상 노출해 전환 누수를 막는다.
 *
 * 위치: 우하단. ScrollToTop(bottom-24로 상향 조정됨)과 stack. z-40으로 두어
 * 스토리 페이지의 StickyBottomCTA(z-50 하단 바)가 뜰 때 그 아래에 위치.
 */
const KakaoFab = ({ locale }: KakaoFabProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const label = locale === 'ko' ? '카톡 문의' : t('actions.kakao', { defaultValue: 'KakaoTalk' });

  const handleClick = React.useCallback(() => {
    trackLeadEvent('lead_click_kakao', {
      locale,
      component: 'KakaoFab',
      cta_id: 'global_fab',
    });
  }, [locale]);

  return (
    <a
      href={siteConfig.contact.kakaoUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label={label}
      style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      className="fixed right-6 z-40 inline-flex items-center gap-2 rounded-full bg-kakao hover:bg-kakao-dark text-kakao-ink shadow-lg shadow-black/20 pl-4 pr-5 py-3 min-h-[52px] font-bold touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink focus-visible:ring-offset-2"
    >
      <MessageCircle size={22} aria-hidden="true" className="flex-shrink-0" />
      <span className="text-sm whitespace-nowrap">{label}</span>
    </a>
  );
};

export default React.memo(KakaoFab);
