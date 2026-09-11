import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import Markdown from 'markdown-to-jsx';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from '@/lib/lucide-icons';
import SEO from '../../../components/SEO';
import Breadcrumb from '../../../components/ui/Breadcrumb';
import { Section } from '../../../components/ui/Section';
import SectionHeading from '../../../components/ui/SectionHeading';
import ResponsiveImage from '../../../components/ResponsiveImage';
import PortfolioMiniCard from '../../../components/ui/PortfolioMiniCard';
import ArtistSupportCallout from '../../../components/artists/ArtistSupportCallout';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import {
  SUPPORTED_ARTISTS,
  getSupportedArtist,
  getArtistPortfolioItems,
  toArtistPageData,
  type ArtistPageData,
  type ArtistLinkKey,
} from '../../../data/artists';
import type { PortfolioItem } from '../../../types/data';
import type { NextPageWithLayout } from '../../../types';

interface ArtistPageProps {
  locale: Locale;
  artist: ArtistPageData;
  works: PortfolioItem[];
}

const LINK_LABELS: Record<ArtistLinkKey, string> = {
  instagram: 'Instagram', youtube: 'YouTube', spotify: 'Spotify', melon: '멜론', bandcamp: 'Bandcamp', site: '공식 사이트',
};

const ArtistPage: NextPageWithLayout<ArtistPageProps> = ({ locale, artist, works }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const links = Object.entries(artist.links) as [ArtistLinkKey, string][];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    url: `${siteConfig.url}/${locale}/artists/${artist.slug}`,
    image: `${siteConfig.url}${artist.image}`,
    description: artist.tagline,
    ...(links.length > 0 && { sameAs: links.map(([, url]) => url) }),
  };

  const breadcrumbItems = [
    { name: t('nav.home'), path: `/${locale}` },
    { name: t('nav.artists'), path: `/${locale}/artists` },
    { name: artist.name, path: `/${locale}/artists/${artist.slug}` },
  ];

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t('artists.detail.shareTitle', { name: artist.name })}
        description={t('artists.detail.metaDescription', { name: artist.name, tagline: artist.tagline })}
        canonical={`/${locale}/artists/${artist.slug}`}
        ogImage={artist.image}
        ogImageAlt={artist.name}
        ogImageWidth={800}
        ogImageHeight={600}
        includeSchema
        schema={schema}
        availableLocales={['ko']}
        webPageType="ProfilePage"
        breadcrumbs={breadcrumbItems}
      />

      <Breadcrumb
        items={breadcrumbItems}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-100 dark:border-gray-800"
      />

      <Section variant="alternate" className="pt-8 pb-12">
        <Link href={`/${locale}/artists`} className="inline-flex items-center gap-1 text-sm text-primary dark:text-primary-lighter">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('artists.detail.backToList')}
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
          <div className="overflow-hidden rounded-2xl">
            <ResponsiveImage src={artist.image} alt={artist.name} width={800} height={600} priority
              pictureClassName="w-full" className="w-full h-auto object-cover" sizes="(max-width: 1024px) 100vw, 40vw" />
          </div>
          <div>
            <h1 className="typo-section-title text-gray-900 dark:text-white">{artist.name}</h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">{artist.tagline}</p>
            <div className="mt-6 space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0 [&_a]:text-primary [&_a]:underline">
              <Markdown options={{ forceBlock: true, overrides: { a: { props: { target: '_blank', rel: 'noopener noreferrer' } } } }}>
                {artist.bio}
              </Markdown>
            </div>
            {links.length > 0 && (
              <div className="mt-6">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{t('artists.detail.linksTitle')}</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {links.map(([key, url]) => (
                    <li key={key}>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                        {LINK_LABELS[key]} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Section>

      {artist.supportActive && (
        <Section variant="alternate">
          <div className="max-w-3xl mx-auto">
            <ArtistSupportCallout
              artist={artist}
              locale={locale}
              kakaoUrl={siteConfig.contact.kakaoUrl}
              labels={{
                title: t('artists.detail.supportTitle'),
                pending: t('artists.detail.supportPending'),
                pendingBody: t('artists.detail.supportPendingBody'),
                pendingLabel: t('artists.detail.supportPendingLabel'),
              }}
            />
          </div>
        </Section>
      )}

      {works.length > 0 && (
        <Section>
          <SectionHeading title={t('artists.detail.worksTitle')} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {works.slice(0, 8).map((item) => (
              <PortfolioMiniCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: SUPPORTED_ARTISTS.map((a) => ({ params: { locale: 'ko', slug: a.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const artist = getSupportedArtist(slug);
  if (!artist) return { notFound: true };
  // productionNotes는 7개 언어 전체가 포함되어 __NEXT_DATA__가 과대해짐. PortfolioMiniCard는
  // notes를 쓰지 않으므로 통째로 제거한다(portfolio.tsx와 같은 판단).
  const works = getArtistPortfolioItems(artist, locale).map((item) => {
    const { productionNotes: _omit, ...rest } = item;
    return rest;
  });
  return buildPageStaticProps(
    locale,
    { artist: toArtistPageData(artist), works },
    { revalidate: 86400, i18nSections: ['artists', 'portfolio'] },
  );
};

export default ArtistPage;
