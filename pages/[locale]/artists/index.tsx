import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Heart, Users, Send } from '@/lib/lucide-icons';
import SEO from '../../../components/SEO';
import ImageHero from '../../../components/common/ImageHero';
import { Section } from '../../../components/ui/Section';
import SectionHeading from '../../../components/ui/SectionHeading';
import ArtistCard from '../../../components/artists/ArtistCard';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { getSupportedArtists, toArtistCardData, type ArtistCardData } from '../../../data/artists';
import type { NextPageWithLayout } from '../../../types';

const FAQSection = dynamic(() => import('../../../components/ui/FAQSection'));
const ContactCTA = dynamic(() => import('../../../components/common/ContactCTA'));

interface ArtistsHubProps {
  locale: Locale;
  artists: ArtistCardData[];
}

const HOW_ICONS = [Users, Heart, Send];

const ArtistsHub: NextPageWithLayout<ArtistsHubProps> = ({ locale, artists }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const howItems = t('artists.how.items', { returnObjects: true }) as { title: string; body: string }[];
  const faqItems = t('artists.faq.items', { returnObjects: true }) as { question: string; answer: string }[];

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t('artists.seo.title')}
        description={t('artists.seo.description')}
        keywords={t('artists.seo.keywords')}
        canonical={`/${locale}/artists`}
        ogImage="/images/og-recording15.webp"
        ogImageAlt={t('artists.hero.imageAlt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        robots={artists.length === 0 ? 'noindex, follow' : undefined}
        includeSchema
        availableLocales={['ko']}
        webPageType="CollectionPage"
        faqItems={Array.isArray(faqItems) ? faqItems : null}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.artists'), path: `/${locale}/artists` },
        ]}
      />

      <ImageHero
        locale={locale}
        priority
        title={t('artists.hero.title')}
        subtitle={t('artists.hero.subtitle')}
        backgroundImage="/images/recording15.webp"
        imageAlt={t('artists.hero.imageAlt')}
      />

      <Section>
        <SectionHeading title={t('artists.list.title')} />
        {artists.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-300">{t('artists.list.empty')}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <ArtistCard key={artist.slug} artist={artist} locale={locale} viewProfileLabel={t('artists.list.viewProfile')} />
            ))}
          </div>
        )}
      </Section>

      <Section variant="alternate">
        <SectionHeading title={t('artists.how.title')} />
        <ol className="grid gap-6 md:grid-cols-3">
          {(Array.isArray(howItems) ? howItems : []).map((item, i) => {
            const Icon = HOW_ICONS[i] ?? Heart;
            return (
              <li key={item.title} className="glass-card rounded-xl p-6">
                <Icon className="h-6 w-6 text-primary dark:text-primary-light" aria-hidden="true" />
                <h3 className="typo-card-subtitle mt-3 text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{item.body}</p>
              </li>
            );
          })}
        </ol>
      </Section>

      <FAQSection
        items={Array.isArray(faqItems) ? faqItems : []}
        title={t('artists.faq.title')}
        subtitle={t('artists.faq.subtitle')}
        variant="default"
      />

      <ContactCTA
        locale={locale}
        title={t('artists.cta.title')}
        subtitle={t('artists.cta.subtitle')}
        imageSrc="/images/studio2.webp"
        imageAlt={siteConfig.name}
        primaryButtonLabel={t('artists.cta.label')}
      />
    </div>
  );
};

ArtistsHub.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: 'ko' } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  return buildPageStaticProps(
    locale,
    { artists: getSupportedArtists().map(toArtistCardData) },
    { revalidate: 86400, i18nSections: ['artists'] },
  );
};

export default ArtistsHub;
