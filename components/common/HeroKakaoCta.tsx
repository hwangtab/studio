import React from 'react';
import Link from 'next/link';
import { MessageCircle, Mail, Phone } from '@/lib/lucide-icons';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
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
   * 비-ko에서 쓸 라벨. 목적지가 카카오 오픈채팅이 아니라 /contact 폼이므로 라벨도 달라야
   * 한다. 미지정 시 `label`을 그대로 쓴다.
   */
  contactLabel?: string;
  /**
   * 선택: 2차 전화 CTA. 지정하면 카카오(1차) 옆에 tel: 링크를 노출한다.
   * 네이버·지역검색으로 유입되는 로컬 고객(전화 선호층)의 리드를 포착하기 위한 것 —
   * 전화 리드가 구조적으로 과소집계(90일 6건)되던 로컬 의도 페이지(연습실·녹음)에만 켠다.
   * 미지정 시 기존과 동일하게 카카오 단일 버튼만 렌더(하위호환).
   */
  phone?: string;
  phoneCtaId?: string;
  /**
   * 카카오 버튼 자체는 두 경우 모두 카카오 옐로로 동일하다(사이트 전역 규칙:
   * 노란 버튼 = 카카오톡). surface는 옆에 붙는 2차 전화 버튼과 focus ring만 가른다.
   * 'onImage'(기본): 어두운 히어로 오버레이 위 — 반투명 흰 전화 버튼.
   * 'onSurface': 본문 섹션 배경 위 — 라이트 모드 밝은 배경에서 전화 버튼
   * (text-white/bg-white/15)이 보이지 않으므로 테두리 전화 버튼으로 강등한다.
   */
  surface?: 'onImage' | 'onSurface';
}

/**
 * 서비스 페이지 히어로용 above-the-fold 카카오 CTA.
 * 히어로는 주목도가 가장 높은 영역인데 lesson·practice-room·wedding·voice·cover는
 * 여기에 행동 버튼이 없어 전환하려면 스크롤해야 했다. 검증된 전환 채널인 카카오
 * 직링크를 히어로에 노출하고 `lead_click_kakao`를 발화한다.
 * (pricing/release 히어로 CTA와 동일한 시각·계측 패턴을 단일 컴포넌트로 통일.)
 */
const HeroKakaoCta = ({ locale, kakaoUrl, component, ctaId, label, contactLabel, phone, phoneCtaId, surface = 'onImage' }: HeroKakaoCtaProps) => {
  const onImage = surface === 'onImage';
  // 카카오 오픈채팅은 한국어 상담 채널이다. 비-ko 방문자를 여기로 보내면 한국어 채팅방
  // (앱이 없으면 설치 유도)에 떨어지므로, ContactCTA·ReleaseHeroCtas·HeaderActions와
  // 똑같이 /contact 폼으로 가른다. 옐로도 쓰지 않는다 — 노란 버튼 = 카카오톡 규칙.
  const isKorean = locale === 'ko';
  const primaryButton = isKorean ? (
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
      className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] font-bold text-base sm:text-lg py-4 px-10 rounded-full bg-kakao text-kakao-ink hover:bg-kakao-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        onImage
          ? 'focus-visible:ring-white/70 focus-visible:ring-offset-black/20'
          : 'focus-visible:ring-kakao-ink focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900'
      }`}
    >
      <MessageCircle className="w-5 h-5" aria-hidden="true" />
      {label}
    </a>
  ) : (
    <Link
      href={`/${locale}/contact`}
      prefetch={false}
      onClick={() =>
        trackMicroEvent('micro_click_contact', {
          locale,
          component,
          cta_id: `${ctaId}_contact`,
        })
      }
      className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] font-bold text-base sm:text-lg py-4 px-10 rounded-full bg-primary text-white hover:bg-primary-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        onImage
          ? 'focus-visible:ring-white/70 focus-visible:ring-offset-black/20'
          : 'focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900'
      }`}
    >
      <Mail className="w-5 h-5" aria-hidden="true" />
      {contactLabel ?? label}
    </Link>
  );

  if (!phone) return primaryButton;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      {primaryButton}
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
        className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[48px] py-4 px-8 rounded-full border font-semibold text-base sm:text-lg transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          onImage
            ? 'border-white/40 bg-white/15 text-white hover:bg-white/25 focus-visible:ring-white/70 focus-visible:ring-offset-black/20'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900'
        }`}
      >
        <Phone className="w-5 h-5" aria-hidden="true" />
        {phone}
      </a>
    </div>
  );
};

export default HeroKakaoCta;
