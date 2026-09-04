import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { Heart, Package, ListChecks, CheckCircle2 } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import ServiceQuickLinksSection from '../../components/service/ServiceQuickLinksSection';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import BookingEntryButton from '../../components/booking/BookingEntryButton';
import SectionHeading from '../../components/ui/SectionHeading';
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
import { getPricingData, WEDDING_PACKAGE_PRICE } from '../../data/pricing';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createFadeInAnimation, createInViewEnterAnimation, HOVER_SCALE, TRANSITION_STANDARD } from '../../utils/animationUtils';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import { trackLeadEvent } from '../../utils/analytics';
import type { NextPageWithLayout } from '../../types';

interface WeddingSongProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  relatedStories: StoryCardData[];
}

const INTRO_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const INTRO_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50 });
const INTRO_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50 });
const PROCESS_ANIMATION = createFadeInAnimation();

const WeddingSong: NextPageWithLayout<WeddingSongProps> = ({ locale, pricingData, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const weddingPackage = React.useMemo(
    () => pricingData.specialPackages.find((p) => p.id === 'package-wedding'),
    [pricingData]
  );

  const quickAnswers = React.useMemo(
    () => createTranslatedQaItems(t, 'weddingSong.quickAnswers.items', 3),
    [t]
  );

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'weddingSong.faq.items', 6),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'weddingSong.process.steps', 4),
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/wedding-song`;

  const serviceSchema = React.useMemo(
    () => buildStudioServiceSchema({
      locale,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
      pageUrl,
      name: t('weddingSong.seo.title'),
      description: t('weddingSong.seo.description'),
      serviceType: locale === 'ko' ? '축가 녹음' : 'Wedding Song Recording',
      offerName: weddingPackage?.title ?? (locale === 'ko' ? '축가 완성 패키지' : 'Wedding Song Package'),
      offerPrice: WEDDING_PACKAGE_PRICE,
    }),
    [t, siteConfig, locale, pageUrl, weddingPackage]
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
    () => buildSchemaGraph(serviceSchema, howToSchema),
    [serviceSchema, howToSchema]
  );

  return (
    <>
      <SEO
        locale={locale}
        title={t('weddingSong.seo.title')}
        description={t('weddingSong.seo.description')}
        keywords={t('weddingSong.seo.keywords')}
        ogImage="/images/og-recording3.webp"
        ogImageAlt={t('weddingSong.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
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

      <ImageHero
        locale={locale}
        priority
        title={t('weddingSong.hero.title')}
        subtitle={
          <>
            <span className="block">{t('weddingSong.hero.subtitleLine1')}</span>
            <span className="block">{t('weddingSong.hero.subtitleLine2')}</span>
          </>
        }
        backgroundImage="/images/recording3.webp"
        imageAlt={t('weddingSong.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.weddingSong'), path: `/${locale}/wedding-song` },
        ]}
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="WeddingSongHero"
            ctaId="wedding_song_hero_kakao"
            label={t('weddingSong.cta.inquiry')}
          />
        }
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
                src="/images/recording3.webp"
                alt={t('weddingSong.intro.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
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
              ctaLabel={t('weddingSong.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
              onCtaClick={() =>
                trackLeadEvent('lead_click_kakao', {
                  locale,
                  component: 'WeddingSongPage',
                  cta_id: 'wedding_song_package_kakao',
                })
              }
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
                className="relative glass-card rounded-2xl p-6"
                whileHover={{ ...HOVER_SCALE, transition: TRANSITION_STANDARD }}
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
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="WeddingSongPage"
            ctaId="wedding_song_process_kakao"
            label={t('weddingSong.cta.inquiry')}
            surface="onSurface"
          />
          <BookingEntryButton service="wedding-song" locale={locale} />
        </div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('weddingSong.faq.title')}
        subtitle={t('weddingSong.faq.subtitle')}
        variant="default"
      />

      <ReviewSection variant="alternate" locale={locale} />

      <HubLinkCallout
        hubSlug="wedding-song-singing"
        locale={locale}
        title={t('weddingSong.hubCallout.title', { defaultValue: '결혼식 축가 직접 부르기 — 종합 가이드' })}
        subtitle={t('weddingSong.hubCallout.subtitle', { defaultValue: '선곡·연습·녹음·식장 납품까지 한 페이지에 정리된 신랑·신부 가이드를 보세요.' })}
      />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('weddingSong.relatedStoriesTitle', { defaultValue: '축가 준비에 도움이 되는 가이드' })}
        subtitle={t('weddingSong.relatedStoriesSubtitle', { defaultValue: '실제 신랑·신부분들이 가장 많이 본 보컬·녹음 가이드를 모았습니다.' })}
      />

      <ServiceQuickLinksSection
        variant="default"
        links={[
          { href: `/${locale}/pricing`, label: t('nav.pricing'), color: 'primary' },
          { href: `/${locale}/studio-info`, label: t('nav.equipment'), color: 'secondary' },
          { href: `/${locale}/voice-acting`, label: t('nav.voiceActing'), color: 'accent' },
        ]}
      />

      <Section variant="alternate" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('weddingSong.cta.titleLine1')}</span>
              <span className="block text-primary">{t('weddingSong.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('weddingSong.cta.subtitleLine1')}</span>
              <span className="block">{t('weddingSong.cta.subtitleLine2')}</span>
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
  const relatedStories = getServiceRelatedStories('wedding-song', locale);
  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories },
    { revalidate: 86400, i18nSections: ['weddingSong', 'stories'] }
  );
};

export default WeddingSong;
