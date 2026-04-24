import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Mic, SlidersHorizontal, Headphones, Guitar, Piano, Music, Laptop, Building, Mic2, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import BaseCard from '../../components/ui/BaseCard';
import ImageHero from '../../components/common/ImageHero';
import SectionHeading from '../../components/ui/SectionHeading';
import { getEquipmentData } from '../../data/equipment';
import EquipmentSection from '../../components/studio/EquipmentSection';

// Below-fold 컴포넌트 code-splitting
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getHubLocaleContent } from '../../data/faq';
import { getStudioFaqData } from '../../data/faq';
import { getSiteConfig } from '../../data/siteConfig';
import { getSchemaLanguage } from '../../utils/schemaGenerator';
import { createInViewEnterAnimation, HOVER_SCALE } from '../../utils/animationUtils';

import type { NextPageWithLayout } from '../../types';

interface StudioInfoProps {
  locale: Locale;
  equipmentData: ReturnType<typeof getEquipmentData>;
  hubLocaleContent: ReturnType<typeof getHubLocaleContent>;
}

const Studio: NextPageWithLayout<StudioInfoProps> = ({ locale, equipmentData, hubLocaleContent }) => {
  const { categories, equipment, studioImages } = equipmentData;
  const { t } = useTranslation('common', { lng: locale });
  const studioFaqData = React.useMemo(() => getStudioFaqData(locale), [locale]);
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  const schemaLanguage = React.useMemo(() => getSchemaLanguage(locale), [locale]);
  const introSectionAnimation = createInViewEnterAnimation({ axis: 'y' });
  const introImageAnimation = createInViewEnterAnimation({ axis: 'x', distance: -50, delay: 0.2 });
  const introTextAnimation = createInViewEnterAnimation({ axis: 'x', distance: 50, delay: 0.2 });
  const equipmentSectionAnimation = createInViewEnterAnimation({});

  const recordingStudioSchema = React.useMemo(() => ({
    '@type': 'Service',
    name: t('studioInfo.seo.title'),
    description: t('studioInfo.seo.description'),
    inLanguage: schemaLanguage,
    serviceType: locale === 'ko' ? '녹음실' : 'Recording Studio',
    image: {
      '@type': 'ImageObject',
      url: `${siteConfig.url}/images/hardware1.webp`,
      width: 1280,
      height: 720,
    },
    areaServed: {
      '@type': 'AdministrativeArea',
      name: locale === 'ko' ? '서울특별시' : 'Seoul',
    },
    provider: {
      '@type': 'Organization',
      '@id': `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
    url: `${siteConfig.url}/${locale}/studio-info`,
    hoursAvailable: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '12:00',
        closes: '18:00',
      },
    ],
    offers: [
      {
        '@type': 'Offer',
        name: locale === 'ko' ? '시간당 레코딩' : 'Hourly Recording',
        priceCurrency: 'KRW',
        price: 100000,
        availability: 'https://schema.org/InStock',
        url: `${siteConfig.url}/${locale}/pricing`,
      },
      {
        '@type': 'Offer',
        name: locale === 'ko' ? 'Day Lock (6시간)' : 'Day Lock (6 hours)',
        priceCurrency: 'KRW',
        price: 500000,
        availability: 'https://schema.org/InStock',
        url: `${siteConfig.url}/${locale}/pricing`,
      },
    ],
  }), [t, siteConfig, locale, schemaLanguage]);

  return (
    <>
      <SEO
        title={t('studioInfo.seo.title')}
        description={t('studioInfo.seo.description')}
        keywords={t('studioInfo.seo.keywords')}
        ogImage="/images/hardware1.webp"
        ogImageAlt={t('studioInfo.hero.alt')}
        ogImageWidth={1280}
        ogImageHeight={720}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.equipment'), path: `/${locale}/studio-info` },
        ]}
        includeSchema={true}
        webPageType="ItemPage"
        canonical={`/${locale}/studio-info`}
        faqItems={studioFaqData}
        schema={recordingStudioSchema}
      />
      <ImageHero
        locale={locale}
        priority
        title={t('studioInfo.hero.title')}
        subtitle={t('studioInfo.hero.subtitle')}
        backgroundImage="/images/hardware1.webp"
        imageAlt={t('studioInfo.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.equipment'), path: `/${locale}/studio-info` },
        ]}
      />

      {/* 스튜디오 소개 섹션 */}
      <Section variant="default">
        <m.div {...introSectionAnimation}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <m.div {...introImageAnimation} className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl group">
              <ResponsiveImage
                src="/images/hardware2.webp"
                alt={t('studioInfo.intro.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                pictureClassName="block h-full"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60"></div>
            </m.div>

            <m.div {...introTextAnimation}>
              <SectionHeading
                icon={Building}
                title={t('studioInfo.intro.title')}
                subtitle={t('studioInfo.intro.subtitle')}
                align="left"
                className="mb-8"
                as="h2"
                titleClassName="mb-2"
              />
              <div className="space-y-6">
                <p className="typo-section-lead text-gray-900 dark:text-white border-l-4 border-primary pl-4 font-bold">
                  {t('studioInfo.intro.quote')}
                </p>
                <p className="typo-card-body leading-loose">
                  {t('studioInfo.intro.paragraphs.0')}
                  <br className="mb-2" />
                  {t('studioInfo.intro.paragraphs.1')}
                </p>
                <p className="typo-card-body leading-loose">
                  {t('studioInfo.intro.paragraphs.2')}
                </p>
              </div>
            </m.div>
          </div>
        </m.div>
      </Section>

      {/* 장비 목록 섹션 */}
      <Section variant="alternate">
        <m.div {...equipmentSectionAnimation}>
          <SectionHeading
            icon={Mic2}
            title={t('studioInfo.equipment.title')}
            titleClassName="text-heading-1 font-title bg-clip-text text-transparent bg-gradient-to-r from-primary-dark via-secondary to-accent"
            className="mb-12 py-4"
          />

          {/* 장비 이미지 갤러리 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {studioImages.map((image, index) => (
              <m.div
                key={index}
                className="rounded-lg overflow-hidden shadow-md h-48"
                whileHover={HOVER_SCALE}
                transition={{ duration: 0.3 }}
              >
                <ResponsiveImage
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                  pictureClassName="block h-full"
                  loading="lazy"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  fill
                />
              </m.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EquipmentSection title={categories.microphones} items={equipment.microphones} icon={Mic} />
            <EquipmentSection title={t('studioInfo.equipment.preampsEq')} items={[...equipment.preamps, ...equipment.equalizers]} icon={SlidersHorizontal} />
            <EquipmentSection title={t('studioInfo.equipment.compressorsProcessors')} items={[...equipment.compressors, ...equipment.processors]} icon={SlidersHorizontal} />
            <EquipmentSection title={categories.speakers + " & " + categories.headphones} items={[...equipment.speakers, ...equipment.headphones]} icon={Headphones} />
            <EquipmentSection title={categories.instruments} items={equipment.instruments} icon={Guitar} />
            <EquipmentSection title={categories.synthesizers} items={equipment.synthesizers} icon={Piano} />
            <EquipmentSection title={categories.plugins} items={equipment.plugins} icon={Music} />
            <EquipmentSection title={t('studioInfo.equipment.interfacesConsoles')} items={[...equipment.interfaces, ...equipment.consoles]} icon={Laptop} />
          </div>
        </m.div >
      </Section>

      {/* Locale-specific content block (non-KO hubs only) */}
      {hubLocaleContent && (
        <Section variant="alternate">
          <SectionHeading
            icon={Headphones}
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

      <ReviewSection variant="alternate" locale={locale} />

      {/* 관련 서비스 바로가기 */}
      <Section variant="default" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/wedding-song`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/lesson`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('studioInfo.cta.titleLine1')}<br />
              <span className="text-primary">{t('studioInfo.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('studioInfo.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('studioInfo.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/studio2.webp"
          imageAlt={t('studioInfo.cta.imageAlt')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

Studio.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const equipmentData = getEquipmentData(locale);
  const hubLocaleContent = getHubLocaleContent(locale, 'studio-info');

  return buildPageStaticProps(
    locale,
    {
      equipmentData,
      hubLocaleContent,
    },
    { revalidate: 86400, i18nSections: ['studioInfo'] }
  );
};

export default Studio;
