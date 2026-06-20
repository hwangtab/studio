import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Mic, SlidersHorizontal, Disc, Info, Star, PlusCircle, ArrowRight, MessageCircle } from '@/lib/lucide-icons';
import { trackLeadEvent } from '../../utils/analytics';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import SectionHeading from '../../components/ui/SectionHeading';
import { getPricingData } from '../../data/pricing';
import { generateAggregateOfferSchema, getSchemaLanguage } from '../../utils/schemaGenerator';
import { getHubLocaleContent } from '../../data/faq';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';
import BaseCard from '../../components/ui/BaseCard';
import ImageHero from '../../components/common/ImageHero';

// Below-fold 컴포넌트 code-splitting (초기 JS 번들 감소 → TBT 단축)
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));
const HubLinkCallout = dynamic(() => import('../../components/guides/HubLinkCallout'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import type { NextPageWithLayout } from '../../types';

interface PricingProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  hubLocaleContent: ReturnType<typeof getHubLocaleContent>;
  relatedStories: StoryCardData[];
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

const Pricing: NextPageWithLayout<PricingProps> = ({ locale, pricingData, hubLocaleContent, relatedStories }) => {
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
    // 가격 미정(0) 항목은 price 생략 — price:0은 "무료"로 오인됨.
    ...(offer.priceValue > 0 && { price: offer.priceValue }),
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
        ogImage="/images/og-hardware2.webp"
        ogImageAlt={t('pricing.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
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
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.pricing'), path: `/${locale}/pricing` },
        ]}
        ctaButtons={
          // AI 검색(ChatGPT 등)·외부 유입이 가격 페이지에 바로 착지하는 비중이 큰데
          // 기존엔 above-the-fold 행동 버튼이 없어 이탈이 높았음. 검증된 전환 채널인
          // 카카오톡 직링크를 히어로에 노출해 즉시 견적 문의로 연결.
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'PricingHero',
                cta_id: 'pricing_hero_kakao',
              })
            }
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            {t('pricing.hero.ctaKakao', { defaultValue: '카톡으로 무료 견적 받기' })}
          </a>
        }
      />


      <QuickAnswers
        title={t('pricing.quickAnswers.title')}
        subtitle={t('pricing.quickAnswers.subtitle')}
        items={pricingQuickAnswers}
        variant="default"
      />

      {/* Locale-specific content block (non-KO hubs only) */}
      {hubLocaleContent && (
        <Section variant="alternate">
          <SectionHeading
            icon={Info}
            title={hubLocaleContent.title}
            className="mb-8"
          />
          <div className="max-w-4xl mx-auto space-y-6">
            {hubLocaleContent.items.map((item) => (
              <BaseCard key={item.heading} variant="default" className="p-6">
                <h3 className="typo-card-title mb-3 text-primary">{item.heading}</h3>
                <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>
              </BaseCard>
            ))}
          </div>
        </Section>
      )}

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
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto" role="list">
          {specialPackages.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
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
            </div>
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
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto" role="list">
          {recordingOffers.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
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
            </div>
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
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8" role="list">
          {mixingOffers.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
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
            </div>
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
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto" role="list">
          {masteringOffers.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
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
            </div>
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="list">
          {additionalServices.map((service, index) => (
            <div key={service.id} role="listitem">
              <PricingCard
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
            </div>
          ))}
        </div>
      </Section>

      <ReviewSection variant="default" locale={locale} />

      <HubLinkCallout
        hubSlug="home-recording-survival"
        locale={locale}
        title="원룸·자취방에서 데모 만들기 — 종합 가이드"
        subtitle="홈레코딩 한계와 스튜디오 전환 시점까지 한 페이지에 정리한 생존 가이드."
      />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('pricing.relatedStoriesTitle', { defaultValue: '예약 전 한 번 더 살펴보면 좋은 가이드' })}
        subtitle={t('pricing.relatedStoriesSubtitle', { defaultValue: '비용·발매·녹음 절차를 미리 알면 첫 세션을 더 알차게 쓸 수 있습니다.' })}
      />

      {/* 관련 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/studio-info`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
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
  const hubLocaleContent = getHubLocaleContent(locale, 'pricing');
  const relatedStories = getServiceRelatedStories('pricing', locale);
  return buildPageStaticProps(
    locale,
    {
      pricingData,
      hubLocaleContent,
      relatedStories,
    },
    { revalidate: 86400, i18nSections: ['pricing'] }
  );
};

export default Pricing;
