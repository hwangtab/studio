import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import ServiceLinkPill from '../../components/ui/ServiceLinkPill';
import { m } from 'framer-motion';
import { Mic, SlidersHorizontal, Headphones, Guitar, Piano, Music, Laptop, Building, Mic2 } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import HubLocaleContentSection from '../../components/ui/HubLocaleContentSection';
import ImageHero from '../../components/common/ImageHero';
import SectionHeading from '../../components/ui/SectionHeading';
import { getEquipmentData } from '../../data/equipment';
import EquipmentSection from '../../components/studio/EquipmentSection';

// Below-fold 컴포넌트 code-splitting
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
// FAQPage 스키마(faqItems)와 동일 데이터를 본문에도 렌더 — 스키마-온리 FAQ는
// 구조화 데이터 가이드라인 위반(가시 콘텐츠 필수)이라 마크업 무시·스팸 판정 리스크.
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getHubLocaleContent } from '../../data/faq';
import { getStudioFaqData } from '../../data/faq';
import { getSiteConfig } from '../../data/siteConfig';
import { DAY_LOCK_PRICE, RECORDING_HOURLY_PRICE } from '../../data/pricing';
import { getSchemaLanguage } from '../../utils/schema';
import { createInViewEnterAnimation, HOVER_SCALE, TRANSITION_STANDARD } from '../../utils/animationUtils';

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
  const introImageAnimation = createInViewEnterAnimation({ axis: 'x', distance: -50 });
  const introTextAnimation = createInViewEnterAnimation({ axis: 'x', distance: 50 });
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
    areaServed: [
      { '@type': 'AdministrativeArea', name: locale === 'ko' ? '서울특별시' : 'Seoul' },
      { '@type': 'AdministrativeArea', name: locale === 'ko' ? '은평구' : 'Eunpyeong-gu' },
      { '@type': 'AdministrativeArea', name: locale === 'ko' ? '연신내' : 'Yeonsinnae' },
    ],
    provider: {
      '@type': 'Organization',
      '@id': `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
    url: `${siteConfig.url}/${locale}/studio-info`,
    // 24시간 무인 운영. utils/schema/business.ts의 openingHoursSpecification(00:00–23:59)과
    // 반드시 같은 값이어야 한다 — 한 사이트가 LocalBusiness와 Service에서 서로 다른 시간을
    // 발행하면 구조화 데이터가 자기모순이 되고, 화면 표시값(common.json contact.hours의
    // "24시간 영업")과도 어긋나 "구조화 데이터는 보이는 내용을 반영한다"는 요건을 깬다.
    //
    // 2026-08 영업시간 24시간 전환(2c0c3085e1→814d24b40b→061a5cf9d0→96ce1779b7) 네 커밋이
    // 모두 이 파일을 열지 않아 10:00이 남아 있었다. 세 번째 사본이라 grep 범위에서 빠졌다.
    hoursAvailable: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
    ],
    offers: [
      {
        '@type': 'Offer',
        name: locale === 'ko' ? '시간당 레코딩' : 'Hourly Recording',
        priceCurrency: 'KRW',
        price: RECORDING_HOURLY_PRICE,
        availability: 'https://schema.org/InStock',
        url: `${siteConfig.url}/${locale}/pricing`,
      },
      {
        '@type': 'Offer',
        name: locale === 'ko' ? 'Day Lock (6시간)' : 'Day Lock (6 hours)',
        priceCurrency: 'KRW',
        price: DAY_LOCK_PRICE,
        availability: 'https://schema.org/InStock',
        url: `${siteConfig.url}/${locale}/pricing`,
      },
    ],
  }), [t, siteConfig, locale, schemaLanguage]);

  return (
    <>
      <SEO
        locale={locale}
        title={t('studioInfo.seo.title')}
        description={t('studioInfo.seo.description')}
        keywords={t('studioInfo.seo.keywords')}
        ogImage="/images/og-hardware1.webp"
        ogImageAlt={t('studioInfo.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
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
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
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
                </p>
                <p className="typo-card-body leading-loose">
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
                whileHover={{ ...HOVER_SCALE, transition: TRANSITION_STANDARD }}
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

      <HubLocaleContentSection content={hubLocaleContent} icon={Headphones} />

      <ReviewSection variant="alternate" locale={locale} />

      <FAQSection
        items={studioFaqData}
        title={t('studioInfo.faq.title')}
        subtitle={t('studioInfo.faq.subtitle')}
        variant="default"
      />

      {/* 관련 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section variant="default" spacing="tight">
        <div className="flex flex-wrap justify-center gap-4">
          <ServiceLinkPill href={`/${locale}/wedding-song`} tone="primary">
            {t('nav.weddingSong')}
          </ServiceLinkPill>
          <ServiceLinkPill href={`/${locale}/voice-acting`} tone="secondary">
            {t('nav.voiceActing')}
          </ServiceLinkPill>
          <ServiceLinkPill href={`/${locale}/pricing`} tone="accent">
            {t('nav.pricing')}
          </ServiceLinkPill>
          <ServiceLinkPill href={`/${locale}/practice-room`} tone="primary">
            {t('nav.practiceRoom')}
          </ServiceLinkPill>
          <ServiceLinkPill href={`/${locale}/lesson`} tone="secondary">
            {t('nav.lesson')}
          </ServiceLinkPill>
        </div>
      </Section>

      <Section variant="default">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('studioInfo.cta.titleLine1')}</span>
              <span className="block text-primary dark:text-primary-lighter">{t('studioInfo.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('studioInfo.cta.subtitleLine1')}</span>
              <span className="block">{t('studioInfo.cta.subtitleLine2')}</span>
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
