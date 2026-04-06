import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Heart, Package, ListChecks, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import Breadcrumb from '../../components/ui/Breadcrumb';
import ReviewSection from '../../components/ui/ReviewSection';
import SectionHeading from '../../components/ui/SectionHeading';
import FAQSection from '../../components/ui/FAQSection';
import QuickAnswers from '../../components/ui/QuickAnswers';
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

interface WeddingSongProps {
  locale: Locale;
  reviewsData: ReturnType<typeof getReviews>;
  pricingData: ReturnType<typeof getPricingData>;
}

const INTRO_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const INTRO_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50, delay: 0.2 });
const INTRO_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50, delay: 0.2 });
const PROCESS_ANIMATION = createFadeInAnimation({ delay: 0.2 });

const WeddingSong: NextPageWithLayout<WeddingSongProps> = ({ locale, reviewsData, pricingData }) => {
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
      areaServed: siteConfig.contact.address,
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
        title={t('weddingSong.seo.title')}
        description={t('weddingSong.seo.description')}
        keywords={t('weddingSong.seo.keywords')}
        ogImage="/images/recording5.webp"
        ogImageAlt={t('weddingSong.hero.alt')}
        ogImageWidth={1280}
        ogImageHeight={720}
        includeSchema
        faqItems={faqItems}
        schema={pageSchema}
        reviewItems={reviewsData}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.weddingSong'), path: `/${locale}/wedding-song` },
        ]}
      />

      <ImageHero
        locale={locale}
        priority
        title={t('weddingSong.hero.title')}
        subtitle={
          <>
            {t('weddingSong.hero.subtitleLine1')}
            <br />
            {t('weddingSong.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/recording5.webp"
        imageAlt={t('weddingSong.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />

      <Breadcrumb
        items={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.weddingSong'), path: `/${locale}/wedding-song` },
        ]}
      />

      <QuickAnswers
        title={t('weddingSong.quickAnswers.title')}
        subtitle={t('weddingSong.quickAnswers.subtitle')}
        items={quickAnswers}
        variant="default"
      />

      {/* 서비스 소개 섹션 */}
      <Section variant="alternate">
        <m.div {...INTRO_ANIMATION}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <m.div
              {...INTRO_IMAGE_ANIMATION}
              className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl group"
            >
              <ResponsiveImage
                src="/images/recording6.webp"
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
                icon={Heart}
                title={t('weddingSong.intro.title')}
                align="left"
                className="mb-8"
                as="h2"
                titleClassName="mb-2"
              />
              <ul className="space-y-5">
                {([0, 1, 2] as const).map((i) => (
                  <li key={i} className="flex items-start gap-4">
                    <CheckCircle2
                      className="text-primary flex-shrink-0 mt-1"
                      size={22}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="typo-card-subtitle mb-1">
                        {t(`weddingSong.intro.features.${i}.title`)}
                      </p>
                      <p className="typo-card-body">
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
      <Section id="wedding-package" variant="default">
        <SectionHeading
          icon={Package}
          title={t('weddingSong.package.title')}
          className="mb-10"
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
            />
          </div>
        )}
      </Section>

      {/* 진행 절차 */}
      <Section variant="alternate">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            icon={ListChecks}
            title={t('weddingSong.process.title')}
            subtitle={t('weddingSong.process.subtitle')}
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
                  {t(`weddingSong.process.steps.${i}.title`)}
                </h3>
                <p className="typo-card-body text-sm">
                  {t(`weddingSong.process.steps.${i}.description`)}
                </p>
              </m.div>
            ))}
          </div>
        </m.div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('weddingSong.faq.title')}
        subtitle={t('weddingSong.faq.subtitle')}
        variant="default"
      />

      <ReviewSection variant="alternate" locale={locale} />

      {/* 관련 서비스 바로가기 */}
      <Section variant="default" className="py-10">
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
            href={`/${locale}/voice-acting`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section variant="alternate" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('weddingSong.cta.titleLine1')}<br />
              <span className="text-primary">{t('weddingSong.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('weddingSong.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('weddingSong.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/recording5.webp"
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
  const reviewsData = getReviews(locale);
  const pricingData = getPricingData(locale);
  return buildPageStaticProps(
    locale,
    { reviewsData, pricingData },
    { revalidate: 86400 }
  );
};

export default WeddingSong;
