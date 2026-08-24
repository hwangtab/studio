import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { Mic2, Music, Users, ListChecks, CheckCircle2 } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import ServiceQuickLinksSection from '../../components/service/ServiceQuickLinksSection';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
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
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getPricingData, RECORDING_HOURLY_PRICE } from '../../data/pricing';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createFadeInAnimation, createInViewEnterAnimation, HOVER_SCALE, TRANSITION_STANDARD } from '../../utils/animationUtils';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import { trackLeadEvent } from '../../utils/analytics';
import type { NextPageWithLayout } from '../../types';

interface RecordingProps {
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

const Recording: NextPageWithLayout<RecordingProps> = ({ locale, pricingData, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  // 가격 SSOT(data/pricing.ts)의 recordingOffers를 그대로 렌더 — 가격 페이지 #recording과 동일 소스.
  const recordingOffers = pricingData.recordingOffers;

  const quickAnswers = React.useMemo(
    () => createTranslatedQaItems(t, 'recording.quickAnswers.items', 3),
    [t]
  );

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'recording.faq.items', 6),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'recording.process.steps', 4),
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/recording`;

  const serviceSchema = React.useMemo(
    () => buildStudioServiceSchema({
      locale,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
      pageUrl,
      name: t('recording.seo.title'),
      description: t('recording.seo.description'),
      serviceType: locale === 'ko' ? '녹음실 대여 · 보컬 녹음' : 'Recording Studio Rental & Vocal Recording',
      offerName: locale === 'ko' ? '시간당 레코딩' : 'Hourly Recording',
      offerPrice: RECORDING_HOURLY_PRICE,
      pricingHash: 'recording',
    }),
    [t, siteConfig, locale, pageUrl]
  );

  const howToSchema = React.useMemo(
    () =>
      generateHowToSchema(
        t('recording.process.title'),
        t('recording.process.subtitle'),
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

  const audienceIcons: LucideIcon[] = [Music, Mic2, Users, Users];

  return (
    <>
      <SEO
        locale={locale}
        title={t('recording.seo.title')}
        description={t('recording.seo.description')}
        keywords={t('recording.seo.keywords')}
        ogImage="/images/og-recording1.webp"
        ogImageAlt={t('recording.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/recording`}
        faqItems={faqItems}
        schema={pageSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.recording'), path: `/${locale}/recording` },
        ]}
        webPageType="ItemPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={t('recording.hero.title')}
        subtitle={
          <>
            {t('recording.hero.subtitleLine1')}
            <br />
            {t('recording.hero.subtitleLine2')}
          </>
        }
        backgroundImage="/images/recording1.webp"
        imageAlt={t('recording.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.recording'), path: `/${locale}/recording` },
        ]}
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="RecordingHero"
            ctaId="recording_hero_kakao"
            label={t('recording.cta.inquiry')}
            phone={siteConfig.contact.phone}
            phoneCtaId="recording_hero_phone"
          />
        }
      />

      <QuickAnswers
        title={t('recording.quickAnswers.title')}
        subtitle={t('recording.quickAnswers.subtitle')}
        items={quickAnswers}
        variant="default"
      />

      {/* 타겟 오디언스 */}
      <Section variant="alternate">
        <m.div {...AUDIENCE_ANIMATION}>
          <SectionHeading
            icon={Users}
            title={t('recording.audience.title')}
            className="mb-8"
            as="h2"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {([0, 1, 2, 3] as const).map((i) => (
              <AudienceCard
                key={i}
                icon={audienceIcons[i]}
                title={t(`recording.audience.items.${i}.title`)}
                description={t(`recording.audience.items.${i}.description`)}
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
                src="/images/recording1.webp"
                alt={t('recording.environment.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
                pictureClassName="block h-full"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
            </m.div>

            <m.div {...ENV_TEXT_ANIMATION}>
              <SectionHeading
                icon={Mic2}
                title={t('recording.environment.title')}
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
                      {t(`recording.environment.features.${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </m.div>
          </div>
        </m.div>
      </Section>

      {/* 가격 안내 — 가격 SSOT의 recordingOffers 3종 */}
      <Section id="recording-pricing" variant="alternate">
        <SectionHeading
          icon={Mic2}
          title={t('recording.package.title')}
          subtitle={t('recording.package.subtitle')}
          className="mb-10"
        />
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto items-stretch">
          {recordingOffers.map((offer) => (
            <PricingCard
              key={offer.id}
              id={offer.id}
              title={offer.title}
              price={offer.priceDisplay}
              unit={offer.unit}
              description={offer.description}
              features={offer.features}
              recommended={offer.recommended}
              ctaLabel={t('recording.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
              onCtaClick={() =>
                trackLeadEvent('lead_click_kakao', {
                  locale,
                  component: 'RecordingPage',
                  cta_id: `recording_price_${offer.id}_kakao`,
                })
              }
            />
          ))}
        </div>
        <p className="mt-6 text-center typo-card-body text-sm text-gray-500 dark:text-gray-400">
          {pricingData.VAT_NOTICE}
        </p>
      </Section>

      {/* 진행 절차 */}
      <Section variant="default">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            icon={ListChecks}
            title={t('recording.process.title')}
            subtitle={t('recording.process.subtitle')}
            className="mb-12"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {([0, 1, 2, 3] as const).map((i) => (
              <m.div
                key={i}
                className="relative glass-card rounded-2xl p-6"
                whileHover={{ ...HOVER_SCALE, transition: TRANSITION_STANDARD }}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                  <span className="text-primary font-bold text-sm">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="typo-card-subtitle mb-2">
                  {t(`recording.process.steps.${i}.title`)}
                </h3>
                <p className="typo-card-body text-sm">
                  {t(`recording.process.steps.${i}.description`)}
                </p>
              </m.div>
            ))}
          </div>
        </m.div>
        <div className="mt-10 text-center">
          <a
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'RecordingPage',
                cta_id: 'recording_process_kakao',
              })
            }
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kakao text-kakao-ink font-bold text-lg hover:bg-kakao-dark transition-colors duration-200"
          >
            {t('recording.cta.inquiry')}
          </a>
        </div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('recording.faq.title')}
        subtitle={t('recording.faq.subtitle')}
        variant="alternate"
      />

      <ReviewSection variant="default" locale={locale} />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('recording.relatedStoriesTitle', { defaultValue: '녹음 준비 가이드' })}
        subtitle={t('recording.relatedStoriesSubtitle', { defaultValue: '녹음실 예약 전 알아두면 좋은 실전 가이드 — 가격·준비·홈녹음 비교까지.' })}
      />

      <ServiceQuickLinksSection
        links={[
          { href: `/${locale}/pricing`, label: t('nav.pricing'), color: 'primary' },
          { href: `/${locale}/studio-info`, label: t('nav.equipment'), color: 'secondary' },
          { href: `/${locale}/voice-acting`, label: t('nav.voiceActing'), color: 'accent' },
        ]}
      />

      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('recording.cta.titleLine1')}<br />
              <span className="text-primary">{t('recording.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              {t('recording.cta.subtitleLine1')}<br className="hidden md:block" />
              {t('recording.cta.subtitleLine2')}
            </>
          }
          imageSrc="/images/recording1.webp"
          imageAlt={t('recording.cta.imageAlt')}
          primaryButtonLabel={t('recording.cta.inquiry')}
          secondaryButtonLabel={t('recording.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

Recording.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const relatedStories = getServiceRelatedStories('recording', locale);
  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories },
    { revalidate: 86400, i18nSections: ['recording', 'stories'] }
  );
};

export default Recording;
