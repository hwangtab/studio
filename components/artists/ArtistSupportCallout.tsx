import React from 'react';
import HeroKakaoCta from '../common/HeroKakaoCta';
import type { SupportedArtist } from '../../data/artists';
import type { Locale } from '../../lib/i18n';

interface ArtistSupportCalloutProps {
  artist: SupportedArtist;
  locale: Locale;
  kakaoUrl: string;
  labels: { title: string; pending: string; pendingBody: string; pendingLabel: string };
}

/**
 * 아티스트 페이지의 후원 자리. 1차(결제 없음)는 "준비 중 + 카카오톡" 고정.
 * 2차에서 이 컴포넌트 안에 등급 카드·후원 시작 버튼(bg-primary)이 들어온다 — 페이지는 건드리지 않는다.
 * 카카오 링크는 옐로(배색 규칙)이므로 HeroKakaoCta를 그대로 쓴다.
 */
const ArtistSupportCallout = ({ artist, locale, kakaoUrl, labels }: ArtistSupportCalloutProps) => (
  <div className="glass-card rounded-2xl p-6 md:p-8" aria-labelledby={`support-${artist.slug}`}>
    <h2 id={`support-${artist.slug}`} className="typo-card-title text-gray-900 dark:text-white">
      {labels.title}
    </h2>
    <p className="mt-2 font-semibold text-gray-800 dark:text-gray-100">{labels.pending}</p>
    <p className="mt-1 text-gray-600 dark:text-gray-300">{labels.pendingBody}</p>
    <div className="mt-5">
      <HeroKakaoCta
        locale={locale}
        kakaoUrl={kakaoUrl}
        component="ArtistSupportCallout"
        ctaId={`artist-support-${artist.slug}`}
        label={labels.pendingLabel}
        surface="onSurface"
      />
    </div>
  </div>
);

export default ArtistSupportCallout;
