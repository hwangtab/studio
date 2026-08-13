import React from 'react';
import Link from 'next/link';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

interface ReleaseHeroCtasProps {
  locale: Locale;
  kakaoUrl: string;
  consultLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  secondaryLeadingIcon?: React.ReactNode;
}

const primaryButtonBase = 'inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] font-bold text-base sm:text-lg py-4 px-10 rounded-full transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
// ko의 1차 목적지는 카카오톡이라 옐로(노란 버튼 = 카카오톡 규칙), 비-ko는 /contact
// 폼이라 옐로를 쓰면 안 되므로 기존 흰 버튼을 유지한다.
const kakaoPrimaryClassName = `${primaryButtonBase} bg-kakao text-kakao-ink hover:bg-kakao-dark focus-visible:ring-white/70 focus-visible:ring-offset-black/20`;
const formPrimaryClassName = `${primaryButtonBase} bg-white text-primary-dark hover:bg-gray-100 focus-visible:ring-primary/40 focus-visible:ring-offset-white`;
// 2차는 홈 히어로와 동일 사유로 강등 — 1차가 옐로가 된 이상 솔리드 보라를 두면
// 어두운 히어로 위에서 2차가 더 튀어 위계가 뒤집힌다.
const secondaryButtonClassName = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-black/30 border-2 border-white/40 text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.55)] font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-black/40 hover:border-white/60 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20';

const ReleaseHeroCtas = ({
  locale,
  kakaoUrl,
  consultLabel,
  secondaryHref,
  secondaryLabel,
  secondaryLeadingIcon,
}: ReleaseHeroCtasProps) => (
  <>
    {locale === 'ko' ? (
      <a
        href={kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={kakaoPrimaryClassName}
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
    ) : (
      <Link
        href={`/${locale}/contact`}
        prefetch={false}
        className={formPrimaryClassName}
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
    )}
    <Link
      href={secondaryHref}
      prefetch={false}
      className={secondaryButtonClassName}
    >
      {secondaryLeadingIcon}
      {secondaryLabel}
    </Link>
  </>
);

export default ReleaseHeroCtas;
