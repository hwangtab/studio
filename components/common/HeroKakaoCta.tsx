import React from 'react';
import Link from 'next/link';
import { MessageCircle, Mail, Phone } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
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
   * 'onImage'(기본): 어두운 히어로 오버레이 위 — 스크림 아웃라인(scrim) 전화 버튼.
   * 'onSurface': 본문 섹션 배경 위 — 라이트 모드 밝은 배경에서 스크림 버튼이
   * 보이지 않으므로 테두리(outline) 전화 버튼으로 강등한다.
   */
  surface?: 'onImage' | 'onSurface';
  /**
   * 2차 행동 — "그 페이지에서 할 수 있는 가장 구체적인 다음 행동"(docs/hero-cta-audit-2026-10.md).
   * 온라인 예약이 되는 서비스는 예약 화면, 견적형은 같은 페이지 가격 절(#…). href는 로케일 접두를 포함한 경로나 '#앵커'.
   */
  secondary?: { label: string; href: string; ctaId: string };
}

/**
 * 서비스 페이지 히어로용 above-the-fold 카카오 CTA.
 * 히어로는 주목도가 가장 높은 영역인데 lesson·practice-room·wedding·voice·cover는
 * 여기에 행동 버튼이 없어 전환하려면 스크롤해야 했다. 검증된 전환 채널인 카카오
 * 직링크를 히어로에 노출하고 `lead_click_kakao`를 발화한다.
 * (pricing/release 히어로 CTA와 동일한 시각·계측 패턴을 단일 컴포넌트로 통일.)
 */
const HeroKakaoCta = ({ locale, kakaoUrl, component, ctaId, label, contactLabel, phone, phoneCtaId, surface = 'onImage', secondary }: HeroKakaoCtaProps) => {
  const onImage = surface === 'onImage';
  const { t } = useTranslation('common', { lng: locale });
  // 카카오 오픈채팅은 한국어 상담 채널이다. 비-ko 방문자를 여기로 보내면 한국어 채팅방
  // (앱이 없으면 설치 유도)에 떨어지므로, ContactCTA·ReleaseHeroCtas·HeaderActions와
  // 똑같이 /contact 폼으로 가른다. 옐로도 쓰지 않는다 — 노란 버튼 = 카카오톡 규칙.
  const isKorean = locale === 'ko';
  // 레이아웃(가변 높이·전폭·줄바꿈)은 variant가 표현하지 못하므로 className으로 유지한다.
  const ctaLayout = 'w-full sm:w-auto h-auto min-h-[48px] py-4 px-10 text-base sm:text-lg text-center whitespace-normal leading-snug font-bold touch-manipulation';
  // 어두운 히어로 오버레이 위에서는 링/오프셋 색을 흰 계열로 덮는다.
  const onImageRing = 'focus-visible:ring-white/70 focus-visible:ring-offset-black/20 dark:focus-visible:ring-offset-black/20';

  const primaryButton = isKorean ? (
    <Button asChild variant="kakao" shape="block" size="lg">
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
        className={`${ctaLayout} ${onImage ? onImageRing : ''}`}
      >
        <MessageCircle className="w-5 h-5" aria-hidden="true" />
        {label}
      </a>
    </Button>
  ) : (
    <Button asChild variant={onImage ? 'inverse' : 'solid'} shape="block" size="lg">
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
        className={`${ctaLayout} ${onImage ? onImageRing : ''}`}
      >
        <Mail className="w-5 h-5" aria-hidden="true" />
        {contactLabel ?? t('actions.contact')}
      </Link>
    </Button>
  );

  // 2차 버튼은 하나 — 전화는 버튼이 아니라 아래 한 줄 텍스트(전화로도 상담이 들어오는 서비스 페이지가 phone을 넘긴다 — 녹음·연습실·믹싱·음원 홍보·펀딩 설계). 버튼 셋은 TDS(화면당 주 행동
  // 하나)에 어긋나고, 휴대폰은 하단 바에 이미 전화가 있다(2026-10-09 히어로 CTA 전수 점검).
  // 번호를 줄로 남기는 이유: 데스크톱에서 번호를 보고 휴대폰으로 직접 거는 전화는 클릭 이벤트로 안 잡힌다 — GA4 0건이어도
  // 운영자 체감으로는 이 번호가 일한다(2026-10-10 운영자 판단, 믹싱·음원 홍보·펀딩 설계에 되살림).
  const secondaryButton = secondary ? (
    <Button asChild variant={onImage ? 'scrim' : 'weak'} shape="block" size="lg">
      <Link
        href={secondary.href}
        prefetch={false}
        onClick={() =>
          trackMicroEvent('micro_click_service', {
            locale,
            component,
            cta_id: secondary.ctaId,
            cta_target: secondary.href,
          })
        }
        className="w-full sm:w-auto h-auto min-h-[48px] py-4 px-8 font-semibold touch-manipulation"
      >
        {secondary.label}
      </Link>
    </Button>
  ) : null;

  if (!secondaryButton && !phone) return primaryButton;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full flex-col sm:flex-row items-center justify-center gap-3">
        {primaryButton}
        {secondaryButton}
      </div>
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={() =>
            trackLeadEvent('lead_click_phone', {
              locale,
              component,
              cta_id: phoneCtaId ?? `${ctaId}_phone`,
            })
          }
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold underline-offset-4 hover:underline touch-manipulation focus-visible:outline-none focus-visible:ring-2 ${
            onImage
              ? 'text-white/90 focus-visible:ring-white/70 focus-visible:ring-offset-black/20'
              : 'text-gray-700 dark:text-gray-300 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70'
          }`}
        >
          <Phone className="w-4 h-4" aria-hidden="true" />
          {t('actions.callConsult')} {phone}
        </a>
      )}
    </div>
  );
};

export default HeroKakaoCta;
