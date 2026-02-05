// @ts-nocheck
import type { NextPage, GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mic, SlidersHorizontal, Disc, TrendingUp, Check, Info, MessageCircle, CalendarCheck, Star, PlusCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import SectionHeading from '../../components/ui/SectionHeading';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../../utils/animationUtils';
import { getPricingData } from '../../data/pricing';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';
import ImageHero from '../../components/common/ImageHero';
import ResponsiveImage from '../../components/ResponsiveImage';
import { getCommonStaticPaths, getCommonStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface PricingProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
}

const Pricing: NextPage<PricingProps> = ({ locale, pricingData }) => {
  const { t } = useTranslation('common', { lng: locale });
  const { 
    VAT_NOTICE, 
    recordingOffers, 
    mixingOffers, 
    masteringOffers, 
    additionalServices, 
    specialPackages 
  } = pricingData;

  const getLink = (path: string) => `/${locale}${path}`;

  return (
    <div className="overflow-visible">
      <SEO
        title={t('pricing.seo.title')}
        description={t('pricing.seo.description')}
        keywords={t('pricing.seo.keywords')}
        canonical={`https://studionol.co.kr/${locale}/pricing`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.pricing'), path: `/${locale}/pricing` },
        ]}
      />

      {/* Hero Section */}
      <ImageHero
        locale={locale}
        title={t('pricing.hero.title')}
        subtitle={
          <>
            {t('pricing.hero.subtitleLine1')}
            <br />
            {t('pricing.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/hardware2.jpg"
        imageAlt={t('pricing.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
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
            />
          ))}
        </div>
        <div className="mt-8 max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-6 border border-primary/20 shadow-sm flex items-start">
          <Info className="text-primary mt-1 mr-3 flex-shrink-0" size={18} />
          <div>
            <h4 className="typo-card-subtitle mb-1">{t('pricing.mixing.noticeTitle')}</h4>
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
            />
          ))}
        </div>
      </Section>

      {/* Improved CTA Section */}
      <Section variant="default" className="py-16">
        <motion.div
          className="overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
            <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
              <SectionHeading
                icon={Sparkles}
                title={t('pricing.cta.title')}
                subtitle={t('pricing.cta.subtitle')}
                align="left"
                className="mb-8"
              />
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={getLink("/contact")}
                  className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600"
                >
                  {t('pricing.cta.location')}
                </Link>
                <a
                  href="https://open.kakao.com/me/nol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                >
                  <MessageCircle className="mr-2" size={20} />
                  {t('pricing.cta.inquiry')}
                </a>
              </div>
            </div>
            <a
              href="https://open.kakao.com/me/nol"
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
            >
              <ResponsiveImage
                src="/images/recording15.png"
                alt={t('pricing.images.packageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                loading="lazy"
                sizes="(min-width: 768px) 50vw, 100vw"
                fill
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
            </a>
          </div>
        </motion.div>
      </Section>
    </div>
  );
};

(Pricing as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = params?.locale || 'ko';
  const pricingData = getPricingData(locale);
  return {
    props: {
      locale,
      pricingData,
    },
  };
};

export default Pricing;
