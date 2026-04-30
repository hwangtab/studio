import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import Hero from '../../components/ui/Hero';
import Section from '../../components/ui/Section';
import SectionHeading from '../../components/ui/SectionHeading';
import BaseCard from '../../components/ui/BaseCard';
import { getPricingData } from '../../data/pricing';
import { generateAggregateOfferSchema, getSchemaLanguage } from '../../utils/schemaGenerator';
import { getHubLocaleContent } from '../../data/faq';
import PricingCard from '../../components/ui/PricingCard';
import FAQSection from '../../components/ui/FAQSection';

// Below-fold 컴포넌트 code-splitting (초기 JS 번들 감소 → TBT 단축)
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import type { NextPageWithLayout } from '../../types';

interface PricingProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  hubLocaleContent: ReturnType<typeof getHubLocaleContent>;
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

const Pricing: NextPageWithLayout<PricingProps> = ({ locale, pricingData, hubLocaleContent }) => {
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
      areaServed: [
        { '@type': 'AdministrativeArea', name: locale === 'ko' ? '서울특별시' : 'Seoul' },
        { '@type': 'AdministrativeArea', name: locale === 'ko' ? '은평구' : 'Eunpyeong-gu' },
      ],
      provider: {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: t('common.siteName'),
      },
    },
  }), [locale, pricingUrl, priceValidUntil, schemaLanguage, siteUrl, t]);

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
      locale
    ),
    [allOffers, locale, t]
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
        locale={locale}
        title={t('pricing.seo.title')}
        description={t('pricing.seo.description')}
        keywords={t('pricing.seo.keywords')}
        ogImage="/images/hardware2.webp"
        ogImageAlt={t('pricing.hero.alt')}
        ogImageWidth={1280}
        ogImageHeight={720}
        includeSchema
        webPageType="WebPage"
        canonical={`/${locale}/pricing`}
        faqItems={pricingQuickAnswers}
        schema={pricingSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.pricing'), path: `/${locale}/pricing` },
        ]}
      />

      {/* Hero Section */}
      <Hero
        variant="lightEditorial"
        eyebrow={t('nav.pricing')}
        title={t('pricing.hero.title')}
        lead={t('pricing.hero.subtitleLine1')}
        orbs={[{ color: 'mint', size: 600, top: '-100px', right: '-80px', opacity: 0.4 }]}
      />

      <QuickAnswers
        title={t('pricing.quickAnswers.title')}
        subtitle={t('pricing.quickAnswers.subtitle')}
        items={pricingQuickAnswers}
        variant="default"
      />

      {/* Locale-specific content block (non-KO hubs only) */}
      {hubLocaleContent && (
        <Section tone="warm">
          <SectionHeading
            title={hubLocaleContent.title}
            className="mb-8"
          />
          <div className="max-w-4xl mx-auto space-y-6">
            {hubLocaleContent.items.map((item) => (
              <BaseCard key={item.heading} variant="default" className="p-6">
                <h3 className="text-title-md text-ink dark:text-on-dark mb-3">{item.heading}</h3>
                <p className="text-ink-muted-80 dark:text-on-dark-soft leading-[1.6]">{item.body}</p>
              </BaseCard>
            ))}
          </div>
        </Section>
      )}

      {/* Special Packages Section */}
      <Section id="special-packages" tone="canvas">
        <SectionHeading
          eyebrow="PACKAGES"
          title={t('pricing.special.title')}
          lead={t('pricing.special.subtitle')}
        />
        <p className="text-ink-muted-60 dark:text-on-dark-soft text-sm text-center max-w-3xl mx-auto mb-6">
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
      <Section id="recording" tone="warm">
        <SectionHeading
          eyebrow="RECORDING"
          title={t('pricing.recording.title')}
          lead={t('pricing.recording.subtitle')}
        />
        <p className="text-ink-muted-60 dark:text-on-dark-soft text-sm text-center max-w-3xl mx-auto mb-6">
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
      <Section id="mixing" tone="canvas">
        <SectionHeading
          eyebrow="MIXING"
          title={t('pricing.mixing.title')}
          lead={t('pricing.mixing.subtitle')}
        />
        <p className="text-ink-muted-60 dark:text-on-dark-soft text-sm text-center max-w-3xl mx-auto mb-6">
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
        <div className="mt-8 max-w-3xl mx-auto bg-canvas-soft dark:bg-surface-dark-elevated rounded-card p-6 border border-hairline dark:border-white/10 shadow-card flex items-start">
          <div>
            <h3 className="text-title-sm text-ink dark:text-on-dark mb-1">{t('pricing.mixing.noticeTitle')}</h3>
            <p className="text-ink-muted-80 dark:text-on-dark-soft text-sm leading-[1.6]">
              {t('pricing.mixing.noticeBody')}
            </p>
          </div>
        </div>
      </Section>

      {/* Mastering Section */}
      <Section id="mastering" tone="warm">
        <SectionHeading
          eyebrow="MASTERING"
          title={t('pricing.mastering.title')}
          lead={t('pricing.mastering.subtitle')}
        />
        <p className="text-ink-muted-60 dark:text-on-dark-soft text-sm text-center max-w-3xl mx-auto mb-6">
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
      <Section id="support-services" tone="canvas">
        <SectionHeading
          eyebrow="ADD-ONS"
          title={t('pricing.additional.title')}
          lead={t('pricing.additional.subtitle')}
        />
        <p className="text-ink-muted-60 dark:text-on-dark-soft text-sm text-center max-w-3xl mx-auto mb-6">
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

      {/* FAQ Section */}
      <Section tone="warm">
        <FAQSection
          title={t('pricing.quickAnswers.title')}
          subtitle={t('pricing.quickAnswers.subtitle')}
          items={pricingQuickAnswers}
        />
      </Section>

      {/* 관련 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section tone="canvas" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/studio-info`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* Final CTA Section */}
      <Section tone="deep" className="py-16">
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
  const hubLocaleContent = getHubLocaleContent(locale, 'pricing');
  return buildPageStaticProps(
    locale,
    {
      pricingData,
      hubLocaleContent,
    },
    { revalidate: 86400, i18nSections: ['pricing'] }
  );
};

export default Pricing;
