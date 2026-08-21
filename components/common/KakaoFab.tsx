import React from 'react';
import { MessageCircle, Phone } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import { CANONICAL_FACTS } from '../../lib/factTokens';
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
 *
 * 전화 버튼을 카카오 왼쪽에 함께 둔다(2026-08). 리드의 90%가 카카오 단일 채널에 몰린 건
 * 고객 선호가 아니라 상시 노출이 카카오뿐이었기 때문일 가능성이 크다 — 40~60대 로컬
 * 고객은 오픈채팅보다 전화를 쓴다. 세로로 쌓지 않고 가로로 붙이는 이유는 ScrollToTop과의
 * 수직 stack을 건드리지 않기 위해서다. 두 버튼 모두 솔리드라 blur 예산(상시 고정 레이어
 * ≤2)에도 영향이 없다.
 */
const KakaoFab = ({ locale }: KakaoFabProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const label = locale === 'ko' ? '카톡 문의' : t('actions.kakao', { defaultValue: 'KakaoTalk' });

  const phoneLabel = locale === 'ko' ? '전화 문의' : t('actions.call', { defaultValue: 'Call' });
  // 국제표기(+82)로 두면 국내·해외 어디서 눌러도 정상 연결된다.
  const telHref = `tel:${CANONICAL_FACTS.phoneIntl.replace(/[^0-9+]/g, '')}`;

  const handleClick = React.useCallback(() => {
    trackLeadEvent('lead_click_kakao', {
      locale,
      component: 'KakaoFab',
      cta_id: 'global_fab',
    });
  }, [locale]);

  const handlePhoneClick = React.useCallback(() => {
    trackLeadEvent('lead_click_phone', {
      locale,
      component: 'KakaoFab',
      cta_id: 'global_fab_phone',
    });
  }, [locale]);

  return (
    <div
      style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      className="fixed right-6 z-40 flex items-center gap-2"
    >
      <a
        href={telHref}
        onClick={handlePhoneClick}
        aria-label={phoneLabel}
        className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-full bg-white dark:bg-gray-800 text-primary dark:text-primary-light border border-gray-200 dark:border-gray-700 shadow-lg shadow-black/20 touch-manipulation transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Phone size={22} aria-hidden="true" />
      </a>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-label={label}
        className="inline-flex items-center gap-2 rounded-full bg-kakao hover:bg-kakao-dark text-kakao-ink shadow-lg shadow-black/20 pl-4 pr-5 py-3 min-h-[52px] font-bold touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink focus-visible:ring-offset-2"
      >
        <MessageCircle size={22} aria-hidden="true" className="flex-shrink-0" />
        <span className="text-sm whitespace-nowrap">{label}</span>
      </a>
    </div>
  );
};

export default React.memo(KakaoFab);
