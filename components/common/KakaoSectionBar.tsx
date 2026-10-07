import React from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Mail } from '@/lib/lucide-icons';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import type { Locale } from '../../lib/i18n';

interface KakaoSectionBarProps {
  locale: Locale;
  kakaoUrl: string;
  /** GA4 component — 어느 페이지의 어느 절인지. */
  component: string;
  /** GA4 cta_id — 절 단위로 고유하게(예: `mixing_tier_bar`). */
  ctaId: string;
  /** 카드가 못 하는 말 — "어디에 해당하는지 모르겠다면 세션 화면을 보내 주세요" 같은 문장. */
  message: string;
  /** 띠 오른쪽 짧은 행동 라벨 — "카톡으로 보내기". */
  actionLabel: string;
  /** 비-ko용 라벨. 목적지가 카카오가 아니라 /contact 폼이라 옐로도 "카톡"도 쓰지 않는다. */
  contactLabel: string;
  className?: string;
}

/**
 * 티어 카드 행 아래의 **노란 띠 하나** (라이너 노트 §3-4, docs/design-liner-notes-plan-2026-10.md).
 *
 * 카드마다 솔리드 옐로를 두면 한 행에 노랑이 셋이라 신호가 소음이 된다. 카드는 온라인 주문·예약(브랜드색)만
 * 맡고, 카카오 상담은 행 아래 이 띠 하나로 모은다 — 노랑은 한 화면에 하나. 띠 전체가 링크 하나다
 * (`components/ctaButtonContract.test.tsx`: 카카오 목적지 = bg-kakao + text-kakao-ink + rounded-full + 포커스 링).
 *
 * 문구는 카드가 못 하는 말을 한다: 어디에 해당하는지 모르는 사람에게 "무엇을 보내면 되는지"를 알려 준다.
 * 비-ko는 HeroKakaoCta·ContactCTA와 같은 규칙으로 /contact 폼 + 브랜드색이다.
 */
const KakaoSectionBar = ({ locale, kakaoUrl, component, ctaId, message, actionLabel, contactLabel, className = '' }: KakaoSectionBarProps) => {
  const isKorean = locale === 'ko';
  // 띠는 한 줄(데스크톱)·두 줄(모바일)로 접힌다. 반경은 pill — 자유 배치 CTA(design-system §3).
  const layout = `h-auto min-h-[56px] w-full justify-between gap-4 px-6 py-4 text-left whitespace-normal leading-snug ${className}`;
  const body = (label: string, Icon: typeof MessageCircle) => (
    <>
      <span className="flex items-start gap-3 text-base font-medium">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="break-keep">{message}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold sm:text-base">
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </>
  );

  if (isKorean) {
    return (
      <div className="mt-8 max-w-5xl mx-auto">
        <Button asChild variant="kakao" shape="pill" size="lg" fullWidth>
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLeadEvent('lead_click_kakao', { locale, component, cta_id: ctaId })}
            className={layout}
          >
            {body(actionLabel, MessageCircle)}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-5xl mx-auto">
      <Button asChild variant="solid" shape="pill" size="lg" fullWidth>
        <Link
          href={`/${locale}/contact`}
          prefetch={false}
          onClick={() => trackMicroEvent('micro_click_contact', { locale, component, cta_id: `${ctaId}_contact` })}
          className={layout}
        >
          {body(contactLabel, Mail)}
        </Link>
      </Button>
    </div>
  );
};

export default KakaoSectionBar;
