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

const primaryButtonClassName = 'inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const secondaryButtonClassName = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-primary border-2 border-primary text-white font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark';

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
        className={primaryButtonClassName}
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
        className={primaryButtonClassName}
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
