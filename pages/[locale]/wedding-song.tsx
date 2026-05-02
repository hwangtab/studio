import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import Hero from '../../components/ui/Hero';
import SectionHeading from '../../components/ui/SectionHeading';
import BaseCard from '../../components/ui/BaseCard';
import Section from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';

// Below-fold 컴포넌트 code-splitting
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getPricingData } from '../../data/pricing';
import { getSchemaLanguage, generateHowToSchema } from '../../utils/schemaGenerator';
import { createFadeInAnimation, createInViewEnterAnimation, HOVER_SCALE } from '../../utils/animationUtils';
import type { NextPageWithLayout } from '../../types';

interface WeddingSongProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
}

const INTRO_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const INTRO_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50, delay: 0.2 });
const INTRO_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50, delay: 0.2 });
const PROCESS_ANIMATION = createFadeInAnimation({ delay: 0.2 });

const WeddingSong: NextPageWithLayout<WeddingSongProps> = ({ locale, pricingData }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);

  const weddingPackage = React.useMemo(
    () => pricingData.specialPackages.find((p) => p.id === 'package-wedding'),
    [pricingData]
  );

  const quickAnswers = React.useMemo(
    () => [
      { question: t('weddingSong.quickAnswers.items.0.q'), answer: t('weddingSong.quickAnswers.items.0.a') },
      { question: t('weddingSong.quickAnswers.items.1.q'), answer: t('weddingSong.quickAnswers.items.1.a') },
      { question: t('weddingSong.quickAnswers.items.2.q'), answer: t('weddingSong.quickAnswers.items.2.a') },
    ],
    [t]
  );

  const faqItems = React.useMemo(
    () => [
      { question: t('weddingSong.faq.items.0.q'), answer: t('weddingSong.faq.items.0.a') },
      { question: t('weddingSong.faq.items.1.q'), answer: t('weddingSong.faq.items.1.a') },
      { question: t('weddingSong.faq.items.2.q'), answer: t('weddingSong.faq.items.2.a') },
      { question: t('weddingSong.faq.items.3.q'), answer: t('weddingSong.faq.items.3.a') },
      { question: t('weddingSong.faq.items.4.q'), answer: t('weddingSong.faq.items.4.a') },
      { question: t('weddingSong.faq.items.5.q'), answer: t('weddingSong.faq.items.5.a') },
    ],
    [t]
  );

  const howToSteps = React.useMemo(
    () => [
      { name: t('weddingSong.process.steps.0.title'), text: t('weddingSong.process.steps.0.description') },
      { name: t('weddingSong.process.steps.1.title'), text: t('weddingSong.process.steps.1.description') },
      { name: t('weddingSong.process.steps.2.title'), text: t('weddingSong.process.steps.2.description') },
      { name: t('weddingSong.process.steps.3.title'), text: t('weddingSong.process.steps.3.description') },
    ],
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/wedding-song`;

  const serviceSchema = React.useMemo(
    () => ({
      '@type': 'Service',
      name: t('weddingSong.seo.title'),
      description: t('weddingSong.seo.description'),
      inLanguage: schemaLanguage,
      serviceType: locale === 'ko' ? '축가 녹음' : 'Wedding Song Recording',
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
        name: weddingPackage?.title ?? (locale === 'ko' ? '축가 완성 패키지' : 'Wedding Song Package'),
        priceCurrency: 'KRW',
        price: 350000,
        availability: 'https://schema.org/InStock',
        url: `${siteConfig.url}/${locale}/pricing#special-packages`,
      },
    }),
    [t, siteConfig, locale, schemaLanguage, pageUrl, weddingPackage]
  );

  const howToSchema = React.useMemo(
    () =>
      generateHowToSchema(
        t('weddingSong.process.title'),
        t('weddingSong.process.subtitle'),
        howToSteps,
        'PT2H',
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

  return (
    <>
      <SEO
        locale={locale}
        title={t('weddingSong.seo.title')}
        description={t('weddingSong.seo.description')}
        keywords={t('weddingSong.seo.keywords')}
        ogImage="/images/recording3.webp"
        ogImageAlt={t('weddingSong.hero.alt')}
        ogImageWidth={1280}
        ogImageHeight={720}
        includeSchema
        canonical={`/${locale}/wedding-song`}
        faqItems={faqItems}
        schema={pageSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.weddingSong'), path: `/${locale}/wedding-song` },
        ]}
        webPageType="ItemPage"
      />

      {/* Hero — lightEditorial with rose + peach orbs */}
      <Hero
        variant="lightEditorial"
        eyebrow={t('nav.weddingSong')}
        title={t('weddingSong.hero.title')}
        lead={t('weddingSong.hero.subtitleLine1')}
        primaryCta={{ label: t('weddingSong.cta.inquiry'), href: siteConfig.contact.kakaoUrl }}
        orbs={[
          { color: 'rose', size: 600, top: '-100px', right: '-80px', opacity: 0.4 },
          { color: 'peach', size: 500, bottom: '-150px', left: '-100px', opacity: 0.35 },
        ]}
      />

      <QuickAnswers
        title={t('weddingSong.quickAnswers.title')}
        subtitle={t('weddingSong.quickAnswers.subtitle')}
        items={quickAnswers}
        tone="warm"
      />

      {/* 서비스 소개 섹션 */}
      <Section tone="canvas">
        <m.div {...INTRO_ANIMATION}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <m.div
              {...INTRO_IMAGE_ANIMATION}
              className="relative h-[400px] lg:h-[500px] rounded-hero overflow-hidden shadow-card group"
            >
              <ResponsiveImage
                src="/images/recording3.webp"
                alt={t('weddingSong.intro.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
            </m.div>

            <m.div {...INTRO_TEXT_ANIMATION}>
              <SectionHeading
                eyebrow="About"
                title={t('weddingSong.intro.title')}
                align="left" marginBottom="tight"
                as="h2"
              />
              <ul className="space-y-5">
                {([0, 1, 2] as const).map((i) => (
                  <li key={i} className="flex items-start gap-4">
                    <CheckCircle2
                      className="text-ink flex-shrink-0 mt-1"
                      size={22}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-title-md text-ink dark:text-on-dark mb-1">
                        {t(`weddingSong.intro.features.${i}.title`)}
                      </p>
                      <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">
                        {t(`weddingSong.intro.features.${i}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </m.div>
          </div>
        </m.div>
      </Section>

      {/* 패키지 안내 */}
      <Section id="wedding-package" tone="warm">
        <SectionHeading
          eyebrow="Package"
          title={t('weddingSong.package.title')}
        />
        {weddingPackage && (
          <div className="max-w-md mx-auto">
            <PricingCard
              id={weddingPackage.id}
              title={weddingPackage.title}
              price={weddingPackage.priceDisplay}
              unit={weddingPackage.unit}
              description={weddingPackage.description}
              features={weddingPackage.features}
              recommended={weddingPackage.recommended}
              delay={0.1}
              ctaLabel={t('weddingSong.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
            />
          </div>
        )}
      </Section>

      {/* 진행 절차 */}
      <Section tone="canvas">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            eyebrow="Process"
            title={t('weddingSong.process.title')}
            lead={t('weddingSong.process.subtitle')}
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {([0, 1, 2, 3] as const).map((i) => (
              <m.div
                key={i}
                className="relative"
                whileHover={HOVER_SCALE}
                transition={{ duration: 0.25 }}
              >
                <BaseCard variant="default" hover className="p-6">
                  <div className="w-10 h-10 rounded-pill bg-canvas-warm flex items-center justify-center mb-4">
                    <span className="text-ink font-bold text-sm">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="text-title-md text-ink dark:text-on-dark mb-2">
                    {t(`weddingSong.process.steps.${i}.title`)}
                  </h3>
                  <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6]">
                    {t(`weddingSong.process.steps.${i}.description`)}
                  </p>
                </BaseCard>
              </m.div>
            ))}
          </div>
        </m.div>
        <div className="mt-10 text-center">
          <a
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-pill bg-ink text-white font-bold text-lg hover:bg-canvas-deep transition-colors duration-200"
          >
            {t('weddingSong.cta.inquiry')}
          </a>
        </div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('weddingSong.faq.title')}
        subtitle={t('weddingSong.faq.subtitle')}
        variant="default"
      />

      <ReviewSection tone="warm" locale={locale} />

      {/* 관련 서비스 바로가기 */}
      <Section tone="canvas" paddingY="sm">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/studio-info`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* Final CTA Section — rose orb for wedding tone */}
      <Section tone="deep" orbs={[{ color: 'rose', size: 600, top: '-100px', right: '-80px', opacity: 0.5 }]} paddingY="default">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('weddingSong.cta.titleLine1')}<br />
              <span>{t('weddingSong.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('weddingSong.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('weddingSong.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/recording3.webp"
          imageAlt={t('weddingSong.cta.imageAlt')}
          primaryButtonLabel={t('weddingSong.cta.inquiry')}
          secondaryButtonLabel={t('weddingSong.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

WeddingSong.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  return buildPageStaticProps(
    locale,
    { pricingData },
    { revalidate: 86400, i18nSections: ['weddingSong'] }
  );
};

export default WeddingSong;
