import React from 'react';
import Link from 'next/link';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';

interface ReleaseHeroCtasProps {
  locale: Locale;
  kakaoUrl: string;
  consultLabel: string;
  /** 없으면 2차 버튼을 그리지 않는다 — ko 발매 LP는 "발매 자금 상담" 하나만 둔다(2026-09-26). */
  secondaryHref?: string;
  secondaryLabel?: string;
  secondaryLeadingIcon?: React.ReactNode;
}

/** 히어로 CTA 크기 — 리프트·색 전환·포커스 링은 Button이 소유한다(design-system §4). */
const HERO_CTA = 'h-auto min-h-[48px] w-full sm:w-auto whitespace-normal py-4 px-10 text-base sm:text-lg font-bold leading-snug shadow-lg hover:shadow-xl';
// 어두운 히어로 사진 위 — 링은 흰색, 오프셋은 사진 위 스크림(§5: 표면이 고정이라 다크 짝도 같은 값).
const HERO_CTA_ON_IMAGE = `${HERO_CTA} focus-visible:ring-white/70 dark:focus-visible:ring-white/70 focus-visible:ring-offset-black/20 dark:focus-visible:ring-offset-black/20`;

const ReleaseHeroCtas = ({
  locale,
  kakaoUrl,
  consultLabel,
  secondaryHref,
  secondaryLabel,
  secondaryLeadingIcon,
}: ReleaseHeroCtasProps) => (
  <>
    {/* ko의 1차 목적지는 카카오톡이라 옐로(노란 버튼 = 카카오톡 규칙), 비-ko는 /contact 폼이라
        옐로를 쓰면 안 되므로 흰 버튼(secondary)을 유지한다. */}
    {locale === 'ko' ? (
      <Button asChild variant="kakao" shape="block" className={HERO_CTA_ON_IMAGE}>
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackLeadEvent('lead_click_kakao', {
              locale,
              component: 'ReleaseHeroCtas',
              cta_id: 'release_hero_kakao',
            })
          }
        >
          {consultLabel}
        </a>
      </Button>
    ) : (
      <Button asChild variant="inverse" shape="block" className={HERO_CTA}>
        <Link
          href={`/${locale}/contact`}
          prefetch={false}
          onClick={() =>
            // 목적지가 카카오톡이 아니라 문의 폼이므로 리드가 아니다 — micro로 집계한다.
            trackMicroEvent('micro_click_contact', {
              locale,
              component: 'ReleaseHeroCtas',
              cta_id: 'release_hero_contact',
            })
          }
        >
          {consultLabel}
        </Link>
      </Button>
    )}
    {/* 2차는 홈 히어로와 동일 사유로 강등 — 1차가 옐로가 된 이상 솔리드 보라를 두면
        어두운 히어로 위에서 2차가 더 튀어 위계가 뒤집힌다. scrim variant가 그 배색이다. */}
    {secondaryHref && secondaryLabel ? (
      <Button asChild variant="scrim" shape="block" className={HERO_CTA}>
        <Link href={secondaryHref} prefetch={false}>
          {secondaryLeadingIcon}
          {secondaryLabel}
        </Link>
      </Button>
    ) : null}
  </>
);

export default ReleaseHeroCtas;
