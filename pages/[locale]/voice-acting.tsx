import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { Mic2, Users, ListChecks, CheckCircle2 } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import ServiceQuickLinksSection from '../../components/service/ServiceQuickLinksSection';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import BookingEntryButton from '../../components/booking/BookingEntryButton';
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

interface VoiceActingProps {
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

const VoiceActing: NextPageWithLayout<VoiceActingProps> = ({ locale, pricingData, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const voiceoverPackage = React.useMemo(
    () => pricingData.specialPackages.find((p) => p.id === 'package-voiceover'),
    [pricingData]
  );

  const quickAnswers = React.useMemo(
    () => createTranslatedQaItems(t, 'voiceActing.quickAnswers.items', 3),
    [t]
  );

  // 7개 전부 렌더 — 7번째(index 6)는 "성우 섭외 비용·견적" B2B 항목이라
  // "성우 섭외 견적·업체·외주" 쿼리(pos 8~28, 클릭 0) 대응 + FAQ 스키마에 포함된다.
  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'voiceActing.faq.items', 7),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'voiceActing.process.steps', 4),
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/voice-acting`;

  const serviceSchema = React.useMemo(
    () => buildStudioServiceSchema({
      locale,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
      pageUrl,
      name: t('voiceActing.seo.title'),
      description: t('voiceActing.seo.description'),
      serviceType: locale === 'ko' ? '성우 녹음' : 'Voice Acting & Narration Recording',
      offerName: voiceoverPackage?.title ?? (locale === 'ko' ? '성우/나레이션 녹음' : 'Voiceover & Narration'),
      offerPrice: 100000,
    }),
    [t, siteConfig, locale, pageUrl, voiceoverPackage]
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
    () => buildSchemaGraph(serviceSchema, howToSchema),
    [serviceSchema, howToSchema]
  );

  const audienceIcons: LucideIcon[] = [Users, Mic2, Users, Users];

  return (
    <>
      <SEO
        locale={locale}
        title={t('voiceActing.seo.title')}
        description={t('voiceActing.seo.description')}
        keywords={t('voiceActing.seo.keywords')}
        ogImage="/images/og-hardware3.webp"
        ogImageAlt={t('voiceActing.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/voice-acting`}
        faqItems={faqItems}
        schema={pageSchema}
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
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="VoiceActingHero"
            ctaId="voice_acting_hero_kakao"
            label={t('voiceActing.cta.inquiry')}
          />
        }
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
              ctaLabel={t('voiceActing.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
              onCtaClick={() =>
                trackLeadEvent('lead_click_kakao', {
                  locale,
                  component: 'VoiceActingPage',
                  cta_id: 'voice_acting_package_kakao',
                })
              }
            />
          </div>
        )}
      </Section>

      {/* 성우 섭외 대행 — 프로세스·견적·납품 스펙.
          '성우 녹음 섭외 견적/외주/업체/프리랜서' 쿼리가 노출은 나는데 클릭 0이었다
          (2026-08-19 GSC 실측, 견적 쿼리는 pos 30). 답은 FAQ 아코디언 안에만 있어서
          훑어보는 독자에게 안 보였다. 이 페이지는 28일 노출 190 수준이라 타이틀 실험은
          판정 불가(로그 하한 500)이므로, 타이틀·메타는 두고 본문만 강화한다. */}
      <Section id="voice-acting-hiring" variant="default">
        <SectionHeading
          icon={Users}
          title={t('voiceActing.hiring.title')}
          subtitle={t('voiceActing.hiring.subtitle')}
          className="mb-12"
        />
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
          <div>
            <h3 className="typo-card-subtitle mb-5">{t('voiceActing.hiring.processTitle')}</h3>
            <ol className="space-y-4">
              {([0, 1, 2, 3] as const).map((i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="typo-card-subtitle text-base mb-1">
                      {t(`voiceActing.hiring.steps.${i}.title`)}
                    </p>
                    <p className="typo-card-body text-sm">
                      {t(`voiceActing.hiring.steps.${i}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-6">
            <BaseCard variant="glass" className="p-6">
              <h3 className="typo-card-subtitle mb-4">{t('voiceActing.hiring.quoteTitle')}</h3>
              <ul className="space-y-3 mb-4">
                {([0, 1, 2] as const).map((i) => (
                  <li key={i} className="flex gap-3 typo-card-body text-sm">
                    <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                    <span className="min-w-0">{t(`voiceActing.hiring.quoteItems.${i}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="typo-card-body text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
                {t('voiceActing.hiring.quoteNote')}
              </p>
            </BaseCard>

            <BaseCard variant="glass" className="p-6">
              <h3 className="typo-card-subtitle mb-4">{t('voiceActing.hiring.deliveryTitle')}</h3>
              <ul className="space-y-3">
                {([0, 1, 2, 3] as const).map((i) => (
                  <li key={i} className="flex gap-3 typo-card-body text-sm">
                    <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                    <span className="min-w-0">{t(`voiceActing.hiring.deliveryItems.${i}`)}</span>
                  </li>
                ))}
              </ul>
            </BaseCard>
          </div>
        </div>
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
                className="relative glass-card rounded-2xl p-6"
                whileHover={{ ...HOVER_SCALE, transition: TRANSITION_STANDARD }}
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
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'VoiceActingPage',
                cta_id: 'voice_acting_process_kakao',
              })
            }
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kakao text-kakao-ink font-bold text-lg hover:bg-kakao-dark transition-colors duration-200"
          >
            {t('voiceActing.cta.inquiry')}
          </a>
          <BookingEntryButton service="voice-acting" locale={locale} />
        </div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('voiceActing.faq.title')}
        subtitle={t('voiceActing.faq.subtitle')}
        variant="alternate"
      />

      <ReviewSection variant="default" locale={locale} />

      <HubLinkCallout
        hubSlug="audiobook-asmr-getting-started"
        locale={locale}
        title={t('voiceActing.hubCallout.title', { defaultValue: '오디오북·ASMR·내레이션 첫 도전 — 종합 가이드' })}
        subtitle={t('voiceActing.hubCallout.subtitle', { defaultValue: '원고 준비부터 녹음·편집·마스터링·유통까지 한 페이지에서 시작하세요.' })}
      />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('voiceActing.relatedStoriesTitle', { defaultValue: '성우·내레이션 녹음 가이드' })}
        subtitle={t('voiceActing.relatedStoriesSubtitle', { defaultValue: '오디오북·ASMR·팟캐스트·데모 녹음에 바로 적용할 수 있는 실전 가이드.' })}
      />

      <ServiceQuickLinksSection
        links={[
          { href: `/${locale}/pricing`, label: t('nav.pricing'), color: 'primary' },
          { href: `/${locale}/studio-info`, label: t('nav.equipment'), color: 'secondary' },
          { href: `/${locale}/wedding-song`, label: t('nav.weddingSong'), color: 'accent' },
        ]}
      />

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
  const pricingData = getPricingData(locale);
  const relatedStories = getServiceRelatedStories('voice-acting', locale);
  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories },
    { revalidate: 86400, i18nSections: ['voiceActing', 'stories'] }
  );
};

export default VoiceActing;
