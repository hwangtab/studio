import React from 'react';
import { MessageCircle, Phone } from '@/lib/lucide-icons';
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
  /**
   * 선택: 2차 전화 CTA. 지정하면 카카오(1차) 옆에 tel: 링크를 노출한다.
   * 네이버·지역검색으로 유입되는 로컬 고객(전화 선호층)의 리드를 포착하기 위한 것 —
   * 전화 리드가 구조적으로 과소집계(90일 6건)되던 로컬 의도 페이지(연습실·녹음)에만 켠다.
   * 미지정 시 기존과 동일하게 카카오 단일 버튼만 렌더(하위호환).
   */
  phone?: string;
  phoneCtaId?: string;
}

/**
 * 서비스 페이지 히어로용 above-the-fold 카카오 CTA.
 * 히어로는 주목도가 가장 높은 영역인데 lesson·practice-room·wedding·voice·cover는
 * 여기에 행동 버튼이 없어 전환하려면 스크롤해야 했다. 검증된 전환 채널인 카카오
 * 직링크를 히어로에 노출하고 `lead_click_kakao`를 발화한다.
 * (pricing/release 히어로 CTA와 동일한 시각·계측 패턴을 단일 컴포넌트로 통일.)
 */
const HeroKakaoCta = ({ locale, kakaoUrl, component, ctaId, label, phone, phoneCtaId }: HeroKakaoCtaProps) => {
  const kakaoButton = (
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

  if (!phone) return kakaoButton;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      {kakaoButton}
      {/* 2차 전화 CTA. 히어로 오버레이 위 흰 글씨 가독성을 위해 glass 토큰이 아닌
          고정 반투명 bg-white/15 + text-white를 쓴다(CLAUDE.md 히어로 CTA 규칙). */}
      <a
        href={`tel:${phone}`}
        onClick={() =>
          trackLeadEvent('lead_click_phone', {
            locale,
            component,
            cta_id: phoneCtaId ?? `${ctaId}_phone`,
          })
        }
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[48px] py-4 px-8 rounded-full border border-white/40 bg-white/15 text-white font-semibold text-base sm:text-lg hover:bg-white/25 transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
      >
        <Phone className="w-5 h-5" aria-hidden="true" />
        {phone}
      </a>
    </div>
  );
};

export default HeroKakaoCta;
