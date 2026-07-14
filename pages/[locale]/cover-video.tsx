import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Video, Users, ListChecks, ArrowRight, CheckCircle2 } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import SectionHeading from '../../components/ui/SectionHeading';
import type { LucideIcon } from '@/lib/lucide-icons';
import BaseCard from '../../components/ui/BaseCard';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';

// Below-fold 컴포넌트 code-splitting
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));
const HubLinkCallout = dynamic(() => import('../../components/guides/HubLinkCallout'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getPricingData } from '../../data/pricing';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createFadeInAnimation, createInViewEnterAnimation, HOVER_SCALE, TRANSITION_STANDARD } from '../../utils/animationUtils';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import { trackLeadEvent } from '../../utils/analytics';
import type { NextPageWithLayout } from '../../types';

interface CoverVideoProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  relatedStories: StoryCardData[];
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

const AUDIENCE_ANIMATION = createFadeInAnimation();
const ENV_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const ENV_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50 });
const ENV_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50 });
const PROCESS_ANIMATION = createFadeInAnimation();

const CoverVideo: NextPageWithLayout<CoverVideoProps> = ({ locale, pricingData, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const coverVideoPackage = React.useMemo(
    () => pricingData.specialPackages.find((p) => p.id === 'package-cover-video'),
    [pricingData]
  );

  const quickAnswers = React.useMemo(
    () => createTranslatedQaItems(t, 'coverVideo.quickAnswers.items', 3),
    [t]
  );

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'coverVideo.faq.items', 6),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'coverVideo.process.steps', 4),
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/cover-video`;

  const serviceSchema = React.useMemo(
    () => buildStudioServiceSchema({
      locale,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
      pageUrl,
      name: t('coverVideo.seo.title'),
      description: t('coverVideo.seo.description'),
      serviceType: locale === 'ko' ? '커버 영상 촬영' : 'Cover Video Production',
      offerName: coverVideoPackage?.title ?? (locale === 'ko' ? '커버 영상 촬영 올인원 패키지' : 'Cover Video All-in-One Package'),
      offerPrice: 350000,
    }),
    [t, siteConfig, locale, pageUrl, coverVideoPackage]
  );

  const howToSchema = React.useMemo(
    () =>
      generateHowToSchema(
        t('coverVideo.process.title'),
        t('coverVideo.process.subtitle'),
        howToSteps,
        undefined,
        locale
      ),
    [t, howToSteps, locale]
  );

  const pageSchema = React.useMemo(
    () => buildSchemaGraph(serviceSchema, howToSchema),
    [serviceSchema, howToSchema]
  );

  const audienceIcons: LucideIcon[] = [Users, Users, Users, Users];

  return (
    <>
      <SEO
        locale={locale}
        title={t('coverVideo.seo.title')}
        description={t('coverVideo.seo.description')}
        keywords={t('coverVideo.seo.keywords')}
        ogImage="/images/og-recording1.webp"
        ogImageAlt={t('coverVideo.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/cover-video`}
        faqItems={faqItems}
        schema={pageSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.coverVideo'), path: `/${locale}/cover-video` },
        ]}
        webPageType="ItemPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={t('coverVideo.hero.title')}
        subtitle={
          <>
            {t('coverVideo.hero.subtitleLine1')}
            <br />
            {t('coverVideo.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/recording1.webp"
        imageAlt={t('coverVideo.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.coverVideo'), path: `/${locale}/cover-video` },
        ]}
      />

      <QuickAnswers
        title={t('coverVideo.quickAnswers.title')}
        subtitle={t('coverVideo.quickAnswers.subtitle')}
        items={quickAnswers}
        variant="default"
      />

      {/* 타겟 오디언스 */}
      <Section variant="alternate">
        <m.div {...AUDIENCE_ANIMATION}>
          <SectionHeading
            icon={Users}
            title={t('coverVideo.audience.title')}
            className="mb-8"
            as="h2"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {([0, 1, 2, 3] as const).map((i) => (
              <AudienceCard
                key={i}
                icon={audienceIcons[i]}
                title={t(`coverVideo.audience.items.${i}.title`)}
                description={t(`coverVideo.audience.items.${i}.description`)}
              />
            ))}
          </div>
        </m.div>
      </Section>

      {/* 장비 & 촬영 환경 */}
      <Section variant="default">
        <m.div {...ENV_ANIMATION}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <m.div
              {...ENV_IMAGE_ANIMATION}
              className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl group"
            >
              <ResponsiveImage
                src="/images/recording2.webp"
                alt={t('coverVideo.environment.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
                pictureClassName="block h-full"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
            </m.div>

            <m.div {...ENV_TEXT_ANIMATION}>
              <SectionHeading
                icon={Video}
                title={t('coverVideo.environment.title')}
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
                      {t(`coverVideo.environment.features.${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </m.div>
          </div>
        </m.div>
      </Section>

      {/* 가격 안내 */}
      <Section id="cover-video-package" variant="alternate">
        <SectionHeading
          icon={Video}
          title={t('coverVideo.package.title')}
          className="mb-10"
        />
        {coverVideoPackage && (
          <div className="max-w-md mx-auto">
            <PricingCard
              id={coverVideoPackage.id}
              title={coverVideoPackage.title}
              price={coverVideoPackage.priceDisplay}
              unit={coverVideoPackage.unit}
              description={coverVideoPackage.description}
              features={coverVideoPackage.features}
              recommended={coverVideoPackage.recommended}
              ctaLabel={t('coverVideo.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
              onCtaClick={() =>
                trackLeadEvent('lead_click_kakao', {
                  locale,
                  component: 'CoverVideoPage',
                  cta_id: 'cover_video_package_kakao',
                })
              }
            />
          </div>
        )}
      </Section>

      {/* 진행 절차 */}
      <Section variant="default">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            icon={ListChecks}
            title={t('coverVideo.process.title')}
            subtitle={t('coverVideo.process.subtitle')}
            className="mb-12"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {([0, 1, 2, 3] as const).map((i) => (
              <m.div
                key={i}
                className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
                whileHover={{ ...HOVER_SCALE, transition: TRANSITION_STANDARD }}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                  <span className="text-primary font-bold text-sm">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="typo-card-subtitle mb-2">
                  {t(`coverVideo.process.steps.${i}.title`)}
                </h3>
                <p className="typo-card-body text-sm">
                  {t(`coverVideo.process.steps.${i}.description`)}
                </p>
              </m.div>
            ))}
          </div>
        </m.div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('coverVideo.faq.title')}
        subtitle={t('coverVideo.faq.subtitle')}
        variant="alternate"
      />

      <ReviewSection variant="default" locale={locale} />

      <HubLinkCallout
        hubSlug="cover-video-production"
        locale={locale}
        title={t('coverVideo.hubCallout.title', { defaultValue: '커버 영상 제작 — 기획·촬영·음원·편집 종합 가이드' })}
        subtitle={t('coverVideo.hubCallout.subtitle', { defaultValue: '선곡부터 촬영 세팅, 음원 믹싱, 유튜브·SNS 업로드까지 한 페이지에서 시작하세요.' })}
      />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('coverVideo.relatedStoriesTitle', { defaultValue: '커버 영상 촬영 가이드' })}
        subtitle={t('coverVideo.relatedStoriesSubtitle', { defaultValue: '유튜브·SNS용 커버 영상을 기획부터 촬영·편집까지 준비할 수 있는 실전 가이드.' })}
      />

      {/* 관련 서비스 바로가기 */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/studio-info`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.equipment')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
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
              {t('coverVideo.cta.titleLine1')}<br />
              <span className="text-primary">{t('coverVideo.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('coverVideo.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('coverVideo.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/recording2.webp"
          imageAlt={t('coverVideo.cta.imageAlt')}
          primaryButtonLabel={t('coverVideo.cta.inquiry')}
          secondaryButtonLabel={t('coverVideo.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

CoverVideo.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const relatedStories = getServiceRelatedStories('cover-video', locale);
  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories },
    { revalidate: 86400, i18nSections: ['coverVideo', 'stories'] }
  );
};

export default CoverVideo;
