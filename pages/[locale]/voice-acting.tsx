import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Mic2, Users, ListChecks, ArrowRight, CheckCircle2, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import ReviewSection from '../../components/ui/ReviewSection';
import SectionHeading from '../../components/ui/SectionHeading';
import FAQSection from '../../components/ui/FAQSection';
import QuickAnswers from '../../components/ui/QuickAnswers';
import BaseCard from '../../components/ui/BaseCard';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';
import ContactCTA from '../../components/common/ContactCTA';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getReviews } from '../../data/reviews';
import { getPricingData } from '../../data/pricing';
import { getSchemaLanguage, generateHowToSchema } from '../../utils/schemaGenerator';
import { createFadeInAnimation, createInViewEnterAnimation, HOVER_SCALE } from '../../utils/animationUtils';
import type { NextPageWithLayout } from '../../types';

interface VoiceActingProps {
  locale: Locale;
  reviewsData: ReturnType<typeof getReviews>;
  pricingData: ReturnType<typeof getPricingData>;
}

const AudienceCard = ({
  title,
  description,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  delay?: number;
}) => (
  <BaseCard variant="default" delay={delay} className="p-6 h-full">
    <div className="flex items-center mb-3">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={22} aria-hidden="true" />
      </div>
      <h3 className="typo-card-subtitle">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

const AUDIENCE_ANIMATION = createFadeInAnimation({ delay: 0.2 });
const ENV_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const ENV_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50, delay: 0.2 });
const ENV_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50, delay: 0.2 });
const PROCESS_ANIMATION = createFadeInAnimation({ delay: 0.2 });

const VoiceActing: NextPageWithLayout<VoiceActingProps> = ({ locale, reviewsData, pricingData }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

  const voiceoverPackage = React.useMemo(
    () => pricingData.specialPackages.find((p) => p.id === 'package-voiceover'),
    [pricingData]
  );

  const quickAnswers = React.useMemo(
    () => [
      { question: t('voiceActing.quickAnswers.items.0.q'), answer: t('voiceActing.quickAnswers.items.0.a') },
      { question: t('voiceActing.quickAnswers.items.1.q'), answer: t('voiceActing.quickAnswers.items.1.a') },
      { question: t('voiceActing.quickAnswers.items.2.q'), answer: t('voiceActing.quickAnswers.items.2.a') },
    ],
    [t]
  );

  const faqItems = React.useMemo(
    () => [
      { question: t('voiceActing.faq.items.0.q'), answer: t('voiceActing.faq.items.0.a') },
      { question: t('voiceActing.faq.items.1.q'), answer: t('voiceActing.faq.items.1.a') },
      { question: t('voiceActing.faq.items.2.q'), answer: t('voiceActing.faq.items.2.a') },
      { question: t('voiceActing.faq.items.3.q'), answer: t('voiceActing.faq.items.3.a') },
      { question: t('voiceActing.faq.items.4.q'), answer: t('voiceActing.faq.items.4.a') },
      { question: t('voiceActing.faq.items.5.q'), answer: t('voiceActing.faq.items.5.a') },
    ],
    [t]
  );

  const howToSteps = React.useMemo(
    () => [
      { name: t('voiceActing.process.steps.0.title'), text: t('voiceActing.process.steps.0.description') },
      { name: t('voiceActing.process.steps.1.title'), text: t('voiceActing.process.steps.1.description') },
      { name: t('voiceActing.process.steps.2.title'), text: t('voiceActing.process.steps.2.description') },
      { name: t('voiceActing.process.steps.3.title'), text: t('voiceActing.process.steps.3.description') },
    ],
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/voice-acting`;

  const serviceSchema = React.useMemo(
    () => ({
      '@type': 'Service',
      name: t('voiceActing.seo.title'),
      description: t('voiceActing.seo.description'),
      inLanguage: schemaLanguage,
      serviceType: locale === 'ko' ? '성우 녹음' : 'Voice Acting & Narration Recording',
      areaServed: {
        '@type': 'City',
        name: locale === 'ko' ? '서울특별시 은평구' : 'Eunpyeong-gu, Seoul',
      },
      location: {
        '@type': 'Place',
        name: siteConfig.name,
        address: {
          '@type': 'PostalAddress',
          addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
          addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
          postalCode: '03424',
          addressCountry: 'KR',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 37.614353,
          longitude: 126.925887,
        },
      },
      provider: {
        '@type': 'Organization',
        '@id': `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
      },
      url: pageUrl,
      offers: {
        '@type': 'Offer',
        name: voiceoverPackage?.title ?? (locale === 'ko' ? '성우/나레이션 녹음' : 'Voiceover & Narration'),
        priceCurrency: 'KRW',
        price: 100000,
        availability: 'https://schema.org/InStock',
        url: `${siteConfig.url}/${locale}/pricing#special-packages`,
      },
    }),
    [t, siteConfig, locale, schemaLanguage, pageUrl, voiceoverPackage]
  );

  const howToSchema = React.useMemo(
    () =>
      generateHowToSchema(
        t('voiceActing.process.title'),
        t('voiceActing.process.subtitle'),
        howToSteps,
        undefined,
        locale
      ),
    [t, howToSteps, locale]
  );

  const pageSchema = React.useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [serviceSchema, howToSchema],
    }),
    [serviceSchema, howToSchema]
  );

  const audienceIcons: LucideIcon[] = [Users, Mic2, Users, Users];

  return (
    <>
      <SEO
        title={t('voiceActing.seo.title')}
        description={t('voiceActing.seo.description')}
        keywords={t('voiceActing.seo.keywords')}
        ogImage="/images/hardware3.webp"
        ogImageAlt={t('voiceActing.hero.alt')}
        ogImageWidth={1280}
        ogImageHeight={720}
        includeSchema
        canonical={`/${locale}/voice-acting`}
        faqItems={faqItems}
        schema={pageSchema}
        reviewItems={reviewsData}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.voiceActing'), path: `/${locale}/voice-acting` },
        ]}
        webPageType="ItemPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={t('voiceActing.hero.title')}
        subtitle={
          <>
            {t('voiceActing.hero.subtitleLine1')}
            <br />
            {t('voiceActing.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/hardware3.webp"
        imageAlt={t('voiceActing.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.voiceActing'), path: `/${locale}/voice-acting` },
        ]}
      />


      <QuickAnswers
        title={t('voiceActing.quickAnswers.title')}
        subtitle={t('voiceActing.quickAnswers.subtitle')}
        items={quickAnswers}
        variant="default"
      />

      {/* 타겟 오디언스 */}
      <Section variant="alternate">
        <m.div {...AUDIENCE_ANIMATION}>
          <SectionHeading
            icon={Users}
            title={t('voiceActing.audience.title')}
            className="mb-8"
            as="h2"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {([0, 1, 2, 3] as const).map((i) => (
              <AudienceCard
                key={i}
                icon={audienceIcons[i]}
                title={t(`voiceActing.audience.items.${i}.title`)}
                description={t(`voiceActing.audience.items.${i}.description`)}
                delay={0.1 * (i + 1)}
              />
            ))}
          </div>
        </m.div>
      </Section>

      {/* 장비 & 환경 */}
      <Section variant="default">
        <m.div {...ENV_ANIMATION}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <m.div
              {...ENV_IMAGE_ANIMATION}
              className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl group"
            >
              <ResponsiveImage
                src="/images/hardware3.webp"
                alt={t('voiceActing.environment.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
            </m.div>

            <m.div {...ENV_TEXT_ANIMATION}>
              <SectionHeading
                icon={Mic2}
                title={t('voiceActing.environment.title')}
                align="left"
                className="mb-8"
                as="h2"
                titleClassName="mb-2"
              />
              <ul className="space-y-4">
                {([0, 1, 2, 3] as const).map((i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2
                      className="text-primary flex-shrink-0"
                      size={20}
                      aria-hidden="true"
                    />
                    <span className="typo-card-body">
                      {t(`voiceActing.environment.features.${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </m.div>
          </div>
        </m.div>
      </Section>

      {/* 가격 안내 */}
      <Section id="voice-acting-package" variant="alternate">
        <SectionHeading
          icon={Mic2}
          title={t('voiceActing.package.title')}
          className="mb-10"
        />
        {voiceoverPackage && (
          <div className="max-w-md mx-auto">
            <PricingCard
              id={voiceoverPackage.id}
              title={voiceoverPackage.title}
              price={voiceoverPackage.priceDisplay}
              unit={voiceoverPackage.unit}
              description={voiceoverPackage.description}
              features={voiceoverPackage.features}
              recommended={voiceoverPackage.recommended}
              delay={0.1}
              ctaLabel={t('voiceActing.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
            />
          </div>
        )}
      </Section>

      {/* 진행 절차 */}
      <Section variant="default">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            icon={ListChecks}
            title={t('voiceActing.process.title')}
            subtitle={t('voiceActing.process.subtitle')}
            className="mb-12"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {([0, 1, 2, 3] as const).map((i) => (
              <m.div
                key={i}
                className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
                whileHover={HOVER_SCALE}
                transition={{ duration: 0.25 }}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                  <span className="text-primary font-bold text-sm">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="typo-card-subtitle mb-2">
                  {t(`voiceActing.process.steps.${i}.title`)}
                </h3>
                <p className="typo-card-body text-sm">
                  {t(`voiceActing.process.steps.${i}.description`)}
                </p>
              </m.div>
            ))}
          </div>
        </m.div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('voiceActing.faq.title')}
        subtitle={t('voiceActing.faq.subtitle')}
        variant="alternate"
      />

      <ReviewSection variant="default" locale={locale} />

      {/* 관련 서비스 바로가기 */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/studio-info`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/wedding-song`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('voiceActing.cta.titleLine1')}<br />
              <span className="text-primary">{t('voiceActing.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('voiceActing.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('voiceActing.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/hardware3.webp"
          imageAlt={t('voiceActing.cta.imageAlt')}
          primaryButtonLabel={t('voiceActing.cta.inquiry')}
          secondaryButtonLabel={t('voiceActing.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

VoiceActing.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const reviewsData = getReviews(locale);
  const pricingData = getPricingData(locale);
  return buildPageStaticProps(
    locale,
    { reviewsData, pricingData },
    { revalidate: 86400 }
  );
};

export default VoiceActing;
