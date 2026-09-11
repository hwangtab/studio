import React from 'react';
import BaseCard from '../ui/BaseCard';
import ResponsiveImage from '../ResponsiveImage';
import type { ArtistCardData } from '../../data/artists';
import type { Locale } from '../../lib/i18n';

interface ArtistCardProps {
  artist: ArtistCardData;
  locale: Locale;
  viewProfileLabel: string;
}

const ArtistCard = ({ artist, locale, viewProfileLabel }: ArtistCardProps) => (
  <BaseCard href={`/${locale}/artists/${artist.slug}`} className="h-full">
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
      <ResponsiveImage
        src={artist.image}
        alt={artist.name}
        pictureClassName="w-full h-full"
        className="w-full h-full object-cover"
        width={640}
        height={480}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
      />
    </div>
    <div className="p-5">
      <h3 className="typo-card-title text-gray-900 dark:text-white">{artist.name}</h3>
      <p className="typo-card-body mt-1 text-gray-600 dark:text-gray-400">{artist.tagline}</p>
      <span className="mt-3 inline-block text-sm font-medium text-primary dark:text-primary-lighter">
        {viewProfileLabel} →
      </span>
    </div>
  </BaseCard>
);

export default ArtistCard;
