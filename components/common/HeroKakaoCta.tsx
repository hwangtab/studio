import React from 'react';
import { MessageCircle } from '@/lib/lucide-icons';
import { trackLeadEvent } from '../../utils/analytics';
import type { Locale } from '../../lib/i18n';

interface HeroKakaoCtaProps {
  locale: Locale;
  kakaoUrl: string;
  /** GA4 component 라벨 — 어느 서비스 페이지 히어로에서 눌렀는지 구분. */
  component: string;
  /** GA4 cta_id — 페이지·위치 단위로 고유하게. */
  ctaId: string;
  label: string;
}

/**
 * 서비스 페이지 히어로용 above-the-fold 카카오 CTA.
 * 히어로는 주목도가 가장 높은 영역인데 lesson·practice-room·wedding·voice·cover는
 * 여기에 행동 버튼이 없어 전환하려면 스크롤해야 했다. 검증된 전환 채널인 카카오
 * 직링크를 히어로에 노출하고 `lead_click_kakao`를 발화한다.
 * (pricing/release 히어로 CTA와 동일한 시각·계측 패턴을 단일 컴포넌트로 통일.)
 */
const HeroKakaoCta = ({ locale, kakaoUrl, component, ctaId, label }: HeroKakaoCtaProps) => (
  <a
    href={kakaoUrl}
    target="_blank"
    rel="noopener noreferrer"
    onClick={() =>
      trackLeadEvent('lead_click_kakao', {
        locale,
        component,
        cta_id: ctaId,
      })
    }
    className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
  >
    <MessageCircle className="w-5 h-5" aria-hidden="true" />
    {label}
  </a>
);

export default HeroKakaoCta;
