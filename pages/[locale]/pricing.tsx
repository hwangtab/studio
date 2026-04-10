import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { Mic, SlidersHorizontal, Disc, Info, Star, PlusCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import ReviewSection from '../../components/ui/ReviewSection';
import SectionHeading from '../../components/ui/SectionHeading';
import { getPricingData } from '../../data/pricing';
import { generateAggregateOfferSchema, getSchemaLanguage } from '../../utils/schemaGenerator';
import { getReviews } from '../../data/reviews';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';
import ImageHero from '../../components/common/ImageHero';
import ContactCTA from '../../components/common/ContactCTA';
import QuickAnswers from '../../components/ui/QuickAnswers';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import type { NextPageWithLayout } from '../../types';

interface PricingProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  reviewsData: ReturnType<typeof getReviews>;
}

interface Offer {
  id: string;
  title: string;
  description: string;
  priceValue: number;
  priceDisplay: string;
  unit: string;
  features: string[];
  recommended?: boolean;
}

const Pricing: NextPageWithLayout<PricingProps> = ({ locale, pricingData, reviewsData }) => {
  const { t } = useTranslation('common', { lng: locale });
  const {
    VAT_NOTICE,
    recordingOffers,
    mixingOffers,
    masteringOffers,
    additionalServices,
    specialPackages
  } = pricingData;

  const siteConfig = getSiteConfig(locale);
  const siteUrl = siteConfig.url;
  const kakaoUrl = siteConfig.contact.kakaoUrl;
  const pricingUrl = `${siteUrl}/${locale}/pricing`;
  const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

  const pricingQuickAnswers = React.useMemo(() => ([
    {
      question: t('pricing.quickAnswers.items.0.q'),
      answer: t('pricing.quickAnswers.items.0.a', { vatNotice: VAT_NOTICE }),
    },
    {
      question: t('pricing.quickAnswers.items.1.q'),
      answer: t('pricing.quickAnswers.items.1.a', { mixingNotice: t('pricing.mixing.noticeBody') }),
    },
    {
      question: t('pricing.quickAnswers.items.2.q'),
      answer: t('pricing.quickAnswers.items.2.a'),
    },
  ]), [t, VAT_NOTICE]);

  const priceValidUntil = React.useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return date.toISOString().split('T')[0];
  }, []);

  const offerToSchema = React.useCallback((offer: Offer) => ({
    '@type': 'Offer',
    name: offer.title,
    description: offer.description,
    inLanguage: schemaLanguage,
    priceCurrency: 'KRW',
    price: offer.priceValue,
    priceValidUntil,
    availability: 'https://schema.org/InStock',
    url: `${pricingUrl}#${offer.id}`,
    seller: {
      '@type': 'Organization',
      name: t('common.siteName'),
      '@id': `${siteUrl}/#organization`,
    },
    itemOffered: {
      '@type': 'Service',
      name: offer.title,
      url: `${pricingUrl}#${offer.id}`,
      inLanguage: schemaLanguage,
      provider: {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: t('common.siteName'),
      },
    },
  }), [pricingUrl, priceValidUntil, schemaLanguage, siteUrl, t]);

  const catalogToSchema = React.useCallback((name: string, offers: Offer[]) => ({
    '@type': 'OfferCatalog',
    name,
    inLanguage: schemaLanguage,
    itemListElement: offers.map(offerToSchema),
  }), [offerToSchema, schemaLanguage]);

  const allOffers = React.useMemo(() => [
    ...specialPackages as Offer[],
    ...recordingOffers as Offer[],
    ...mixingOffers as Offer[],
    ...masteringOffers as Offer[],
    ...additionalServices.map(s => ({ ...s, features: s.note ? [s.note] : [] })) as Offer[],
  ], [specialPackages, recordingOffers, mixingOffers, masteringOffers, additionalServices]);

  const aggregateOfferSchema = React.useMemo(() =>
    generateAggregateOfferSchema(
      t('pricing.seo.schemaTitle'),
      allOffers.map((offer) => ({ name: offer.title, priceValue: offer.priceValue })),
      reviewsData,
      locale
    ),
    [allOffers, locale, reviewsData, t]
  );

  const pricingSchema = React.useMemo(() => ({
    '@context': 'https://schema.org',
    '@graph': [
      aggregateOfferSchema,
      {
        '@type': 'OfferCatalog',
        name: t('pricing.seo.title'),
        inLanguage: schemaLanguage,
        itemListElement: [
          catalogToSchema(t('pricing.special.title'), specialPackages as Offer[]),
          catalogToSchema(t('pricing.recording.title'), recordingOffers as Offer[]),
          catalogToSchema(t('pricing.mixing.title'), mixingOffers as Offer[]),
          catalogToSchema(t('pricing.mastering.title'), masteringOffers as Offer[]),
          catalogToSchema(t('pricing.additional.title'), additionalServices.map(s => ({
            id: s.id,
            title: s.title,
            description: s.note || '',
            priceValue: s.priceValue || 0,
            priceDisplay: s.priceDisplay,
            unit: '',
            features: s.note ? [s.note] : [],
          }))),
        ],
      },
    ].filter(Boolean) as Record<string, unknown>[],
  }), [
    t,
    catalogToSchema,
    aggregateOfferSchema,
    specialPackages,
    recordingOffers,
    mixingOffers,
    masteringOffers,
    additionalServices,
    schemaLanguage,
  ]);

  return (
    <div className="overflow-visible">
      <SEO
        title={t('pricing.seo.title')}
        description={t('pricing.seo.description')}
        keywords={t('pricing.seo.keywords')}
        ogImage="/images/hardware2.webp"
        ogImageAlt={t('pricing.hero.alt')}
        ogImageWidth={1280}
        ogImageHeight={720}
        includeSchema
        webPageType="WebPage"
        faqItems={pricingQuickAnswers}
        schema={pricingSchema}
        reviewItems={reviewsData}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.pricing'), path: `/${locale}/pricing` },
        ]}
      />

      {/* Hero Section */}
      <ImageHero
        locale={locale}
        priority
        title={t('pricing.hero.title')}
        subtitle={
          <>
            {t('pricing.hero.subtitleLine1')}
            <br />
            {t('pricing.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/hardware2.webp"
        imageAlt={t('pricing.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />


      <QuickAnswers
        title={t('pricing.quickAnswers.title')}
        subtitle={t('pricing.quickAnswers.subtitle')}
        items={pricingQuickAnswers}
        variant="default"
      />

      {/* Special Packages Section */}
      <Section id="special-packages" variant="alternate">
        <SectionHeading
          icon={Star}
          title={t('pricing.special.title')}
          subtitle={t('pricing.special.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {specialPackages.map((offer, index) => (
            <PricingCard
              key={offer.id}
              id={offer.id}
              title={offer.title}
              price={offer.priceDisplay}
              unit={offer.unit}
              description={offer.description}
              features={offer.features}
              recommended={offer.recommended}
              delay={0.1 * (index + 1)}
              ctaLabel={t('pricing.cta.inquiry')}
              ctaHref={kakaoUrl}
            />
          ))}
        </div>
      </Section>

      {/* Recording Section */}
      <Section id="recording" variant="default">
        <SectionHeading
          icon={Mic}
          title={t('pricing.recording.title')}
          subtitle={t('pricing.recording.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {recordingOffers.map((offer, index) => (
            <PricingCard
              key={offer.id}
              id={offer.id}
              title={offer.title}
              price={offer.priceDisplay}
              unit={offer.unit}
              description={offer.description}
              features={offer.features}
              recommended={offer.recommended}
              delay={0.1 * (index + 1)}
              ctaLabel={t('pricing.cta.inquiry')}
              ctaHref={kakaoUrl}
            />
          ))}
        </div>
      </Section>

      {/* Mixing Section */}
      <Section id="mixing" variant="alternate">
        <SectionHeading
          icon={SlidersHorizontal}
          title={t('pricing.mixing.title')}
          subtitle={t('pricing.mixing.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {mixingOffers.map((offer, index) => (
            <PricingCard
              key={offer.id}
              id={offer.id}
              title={offer.title}
              price={offer.priceDisplay}
              unit={offer.unit}
              description={offer.description}
              features={offer.features}
              recommended={offer.recommended}
              delay={0.1 * (index + 1)}
              ctaLabel={t('pricing.cta.inquiry')}
              ctaHref={kakaoUrl}
            />
          ))}
        </div>
        <div className="mt-8 max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-6 border border-primary/20 shadow-sm flex items-start">
          <Info className="text-primary mt-1 mr-3 flex-shrink-0" size={18} aria-hidden="true" />
          <div>
            <h3 className="typo-card-subtitle mb-1">{t('pricing.mixing.noticeTitle')}</h3>
            <p className="typo-card-body text-sm">
              {t('pricing.mixing.noticeBody')}
            </p>
          </div>
        </div>
      </Section>

      {/* Mastering Section */}
      <Section id="mastering" variant="default">
        <SectionHeading
          icon={Disc}
          title={t('pricing.mastering.title')}
          subtitle={t('pricing.mastering.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {masteringOffers.map((offer, index) => (
            <PricingCard
              key={offer.id}
              id={offer.id}
              title={offer.title}
              price={offer.priceDisplay}
              unit={offer.unit}
              description={offer.description}
              features={offer.features}
              recommended={offer.recommended}
              delay={0.1 * (index + 1)}
              ctaLabel={t('pricing.cta.inquiry')}
              ctaHref={kakaoUrl}
            />
          ))}
        </div>
      </Section>

      {/* Additional Services Section */}
      <Section id="support-services" variant="alternate">
        <SectionHeading
          icon={PlusCircle}
          title={t('pricing.additional.title')}
          subtitle={t('pricing.additional.subtitle')}
        />
        <p className="typo-card-meta text-center max-w-3xl mx-auto mb-6">
          {VAT_NOTICE}
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {additionalServices.map((service, index) => (
            <PricingCard
              key={service.id}
              id={service.id}
              title={service.title}
              price={service.priceDisplay}
              unit={service.unit}
              description={service.description}
              features={service.note ? [service.note] : []}
              delay={0.1 * (index + 1)}
              ctaLabel={t('pricing.cta.inquiry')}
              ctaHref={kakaoUrl}
            />
          ))}
        </div>
      </Section>

      <ReviewSection variant="default" locale={locale} />

      {/* 관련 서비스 바로가기 */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/studio-info`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/wedding-song`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* Improved CTA Section */}
      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={t('pricing.cta.title')}
          subtitle={t('pricing.cta.subtitle')}
          imageSrc="/images/recording15.webp"
          imageAlt={t('pricing.images.packageAlt')}
          primaryButtonLabel={t('pricing.cta.inquiry')}
          secondaryButtonLabel={t('pricing.cta.location')}
          headingAs="h3"
        />
      </Section>
    </div>
  );
};

Pricing.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const reviewsData = getReviews(locale);
  return buildPageStaticProps(
    locale,
    {
      pricingData,
      reviewsData,
    },
    { revalidate: 86400 }
  );
};

export default Pricing;
