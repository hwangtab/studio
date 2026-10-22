import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Video, Users, ListChecks, CheckCircle2, Mic, MessageSquare, Play } from '@/lib/lucide-icons';
import type { LucideIcon } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import ServiceQuickLinksSection from '../../components/service/ServiceQuickLinksSection';
import VideoPortfolioGrid from '../../components/service/VideoPortfolioGrid';
import SEO from '../../components/SEO';
import ImageHero, { HERO_SCRIM_STRONG } from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import SectionHeading from '../../components/ui/SectionHeading';
import BaseCard from '../../components/ui/BaseCard';
import { Section } from '../../components/ui/Section';
import RuleList from '../../components/ui/RuleList';
import PricingCard from '../../components/ui/PricingCard';
import KakaoSectionBar from '../../components/common/KakaoSectionBar';
import { centeredGrid } from '../../components/ui/centeredGrid';

// Below-fold 컴포넌트 code-splitting
const ReviewSection = dynamic(() => import('../../components/ui/ReviewSection'));
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { COVER_VIDEO_PACKAGE_PRICE, LIVE_VIDEO_FROM_PRICE, MUSIC_VIDEO_FROM_PRICE, formatPriceLabel, getPricingData } from '../../data/pricing';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createFadeInAnimation, createInViewEnterAnimation } from '../../utils/animationUtils';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import { trackLeadEvent } from '../../utils/analytics';
import type { NextPageWithLayout } from '../../types';

/**
 * 영상 제작 — 뮤직비디오·라이브 클립·유튜브 콘텐츠(토크·인터뷰). 촬영은 해방필름 치치 감독.
 * 설계: docs/video-production-design-2026-10.md.
 *
 * 견적형 상품이라 온라인 예약·결제가 없다 — 1차 행동은 전부 카카오 상담(비-ko는 문의 폼).
 * 스튜디오 안 1곡 커버 영상(정가·온라인 예약)은 /cover-video가 정본이고, 여기서는 가격 절에서 그쪽으로 보낸다.
 */

interface MusicVideoProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  relatedStories: StoryCardData[];
}

const VIDEO_OFFER_IDS = ['package-music-video', 'package-live-video'] as const;
const PRICE_GRID = centeredGrid({ md: 2, gap: 6 });
const SERVICE_ICONS: LucideIcon[] = [Video, Mic, MessageSquare];

const SERVICES_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const DIRECTOR_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50 });
const DIRECTOR_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50 });
const PRICING_FACTORS_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50 });
const PRICING_PREP_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50 });
const PROCESS_ANIMATION = createFadeInAnimation();

const MusicVideo: NextPageWithLayout<MusicVideoProps> = ({ locale, pricingData, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);
  // 카피의 금액은 상수에서 — {{mv}} = 뮤직비디오 하한, {{live}} = 라이브·유튜브 하한, {{cover}} = 커버 영상 패키지.
  const priceVars = React.useMemo(
    () => ({
      mv: formatPriceLabel(MUSIC_VIDEO_FROM_PRICE, locale),
      live: formatPriceLabel(LIVE_VIDEO_FROM_PRICE, locale),
      cover: formatPriceLabel(COVER_VIDEO_PACKAGE_PRICE, locale),
    }),
    [locale]
  );
  const tPrice = React.useCallback((key: string) => t(key, priceVars), [t, priceVars]);

  const videoOffers = React.useMemo(
    () =>
      VIDEO_OFFER_IDS.map((id) => pricingData.specialPackages.find((p) => p.id === id)).filter(
        (p): p is NonNullable<typeof p> => Boolean(p)
      ),
    [pricingData]
  );

  const quickAnswers = React.useMemo(() => createTranslatedQaItems(tPrice, 'musicVideo.quickAnswers.items', 3), [tPrice]);
  const faqItems = React.useMemo(() => createTranslatedQaItems(tPrice, 'musicVideo.faq.items', 7), [tPrice]);
  const howToSteps = React.useMemo(() => createTranslatedHowToSteps(t, 'musicVideo.process.steps', 4), [t]);

  const pageUrl = `${siteConfig.url}/${locale}/music-video`;

  const pageSchema = React.useMemo(
    () =>
      buildSchemaGraph(
        buildStudioServiceSchema({
          locale,
          siteName: siteConfig.name,
          siteUrl: siteConfig.url,
          pageUrl,
          name: tPrice('musicVideo.seo.title'),
          description: tPrice('musicVideo.seo.description'),
          serviceType: locale === 'ko' ? '뮤직비디오·영상 제작' : 'Music Video Production',
          offerName: videoOffers[0]?.title,
          offerPrice: MUSIC_VIDEO_FROM_PRICE,
        }),
        generateHowToSchema(t('musicVideo.process.title'), t('musicVideo.process.subtitle'), howToSteps, undefined, locale)
      ),
    [t, tPrice, siteConfig, locale, pageUrl, videoOffers, howToSteps]
  );

  const breadcrumbs = [
    { name: t('nav.home'), path: `/${locale}` },
    { name: t('nav.musicVideo'), path: `/${locale}/music-video` },
  ];

  return (
    <>
      <SEO
        locale={locale}
        title={tPrice('musicVideo.seo.title')}
        description={tPrice('musicVideo.seo.description')}
        keywords={t('musicVideo.seo.keywords')}
        ogImage="/images/og-music-video-20261022.webp"
        ogImageAlt={t('musicVideo.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/music-video`}
        faqItems={faqItems}
        schema={pageSchema}
        breadcrumbs={breadcrumbs}
        webPageType="ItemPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={t('musicVideo.hero.title')}
        subtitle={
          <>
            <span className="block">{t('musicVideo.hero.subtitleLine1')}</span>
            <span className="block">{tPrice('musicVideo.hero.subtitleLine2')}</span>
          </>
        }
        backgroundImage="/images/music-video-hero-20261022.webp"
        imageAlt={t('musicVideo.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient={HERO_SCRIM_STRONG}
        breadcrumbItems={breadcrumbs}
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="MusicVideoHero"
            ctaId="music_video_hero_kakao"
            label={t('musicVideo.cta.inquiry')}
            secondary={{ label: t('musicVideo.hero.seeWorks'), href: '#video-portfolio', ctaId: 'music_video_hero_portfolio' }}
          />
        }
      />

      <QuickAnswers
        title={t('musicVideo.quickAnswers.title')}
        subtitle={t('musicVideo.quickAnswers.subtitle')}
        items={quickAnswers}
        variant="default"
      />

      {/* 작업 영상 — 이 페이지의 중심. 누르기 전엔 썸네일만 받는다(YouTubeFacade). */}
      <Section id="video-portfolio" variant="alternate" className="scroll-mt-24">
        <SectionHeading
          icon={Play}
          title={t('musicVideo.portfolio.title')}
          subtitle={t('musicVideo.portfolio.subtitle')}
          className="mb-8"
          as="h2"
        />
        <VideoPortfolioGrid locale={locale} />
      </Section>

      {/* 무엇을 찍나 */}
      <Section variant="default">
        <m.div {...SERVICES_ANIMATION}>
          <SectionHeading icon={Users} title={t('musicVideo.services.title')} className="mb-8" as="h2" />
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {SERVICE_ICONS.map((Icon, i) => (
              <BaseCard key={i} variant="glass" className="p-6 h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full">
                    <Icon className="text-gray-700 dark:text-gray-300" size={22} aria-hidden="true" />
                  </div>
                  <h3 className="typo-card-subtitle">{t(`musicVideo.services.items.${i}.title`)}</h3>
                </div>
                <p className="typo-card-body">{t(`musicVideo.services.items.${i}.description`)}</p>
              </BaseCard>
            ))}
          </div>
        </m.div>
      </Section>

      {/* 촬영 감독 */}
      <Section variant="alternate">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <m.div
            {...DIRECTOR_IMAGE_ANIMATION}
            className="relative h-[320px] lg:h-[440px] rounded-2xl overflow-hidden shadow-2xl"
          >
            <ResponsiveImage
              src="/images/music-video-scene-20261022.webp"
              alt={t('musicVideo.director.imageAlt')}
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </m.div>
          <m.div {...DIRECTOR_TEXT_ANIMATION}>
            <SectionHeading
              icon={Video}
              title={t('musicVideo.director.title')}
              align="left"
              className="mb-6"
              as="h2"
              titleClassName="mb-2"
            />
            <p className="typo-card-body mb-6 break-keep">{t('musicVideo.director.body')}</p>
            <ul className="space-y-4">
              {([0, 1, 2, 3] as const).map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="text-gray-700 dark:text-gray-300 flex-shrink-0 mt-0.5" size={20} aria-hidden="true" />
                  <span className="typo-card-body">{t(`musicVideo.director.points.${i}`)}</span>
                </li>
              ))}
            </ul>
          </m.div>
        </div>
      </Section>

      {/* 가격 — /pricing과 같은 specialPackages 오퍼. 둘 다 하한가, 범위는 상담으로. */}
      <Section id="music-video-pricing" variant="default" className="scroll-mt-24">
        <SectionHeading
          icon={ListChecks}
          title={t('musicVideo.pricing.title')}
          subtitle={tPrice('musicVideo.pricing.subtitle')}
          className="mb-10"
          as="h2"
        />
        <div className={`${PRICE_GRID.container} max-w-4xl mx-auto`} role="list">
          {videoOffers.map((offer, index) => (
            <div key={offer.id} role="listitem" className={PRICE_GRID.item}>
              <PricingCard
                kakaoEmphasis="band"
                id={offer.id}
                title={offer.title}
                price={offer.priceDisplay}
                unit={offer.unit}
                description={offer.description}
                features={offer.features}
                recommended={offer.recommended}
                delay={0.1 * (index + 1)}
                ctaLabel={t('musicVideo.cta.inquiry')}
                ctaHref={siteConfig.contact.kakaoUrl}
                onCtaClick={() =>
                  trackLeadEvent('lead_click_kakao', {
                    locale,
                    component: 'MusicVideoPage',
                    cta_id: `music_video_${offer.id}_kakao`,
                  })
                }
              />
            </div>
          ))}
        </div>
        {/* 라이너 노트 §3-4: 카드의 카카오 CTA는 행 아래 노란 띠 하나로 모은다 — 노랑은 한 화면에 하나. */}
        <KakaoSectionBar
          locale={locale}
          kakaoUrl={siteConfig.contact.kakaoUrl}
          component="MusicVideoPage"
          ctaId="music_video_tier_bar"
          message={t('musicVideo.tierBar.message')}
          actionLabel={t('musicVideo.tierBar.action')}
          contactLabel={t('musicVideo.tierBar.contact')}
        />

        <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto mt-14">
          <m.div {...PRICING_FACTORS_ANIMATION}>
            <h3 className="typo-card-subtitle mb-5">{t('musicVideo.pricing.factorsTitle')}</h3>
            <ol className="space-y-4">
              {([0, 1, 2, 3, 4] as const).map((i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="typo-card-subtitle text-base mb-1">{t(`musicVideo.pricing.factors.${i}.label`)}</p>
                    <p className="typo-card-body text-sm">{t(`musicVideo.pricing.factors.${i}.detail`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </m.div>

          <m.div {...PRICING_PREP_ANIMATION}>
            <BaseCard variant="glass" className="p-6">
              <h3 className="typo-card-subtitle mb-4">{t('musicVideo.pricing.prepTitle')}</h3>
              <ul className="space-y-3">
                {([0, 1, 2] as const).map((i) => (
                  <li key={i} className="flex gap-3 typo-card-body text-sm">
                    <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                    <span className="min-w-0">{t(`musicVideo.pricing.prepItems.${i}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="typo-card-body text-sm mb-2">{tPrice('musicVideo.pricing.coverNote')}</p>
                <Link
                  href={`/${locale}/cover-video`}
                  className="typo-card-body text-sm font-semibold text-primary dark:text-primary-lighter underline-offset-4 hover:underline"
                >
                  {t('nav.coverVideo')} →
                </Link>
              </div>
            </BaseCard>
          </m.div>
        </div>
      </Section>

      {/* 진행 절차 */}
      <Section variant="alternate">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            icon={ListChecks}
            title={t('musicVideo.process.title')}
            subtitle={t('musicVideo.process.subtitle')}
            className="mb-12"
          />
          <RuleList
            numbered
            columns={4}
            className="max-w-5xl mx-auto"
            items={([0, 1, 2, 3] as const).map((i) => ({
              key: String(i),
              heading: t(`musicVideo.process.steps.${i}.title`),
              body: t(`musicVideo.process.steps.${i}.description`),
            }))}
          />
        </m.div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="MusicVideoPage"
            ctaId="music_video_process_kakao"
            label={t('musicVideo.cta.inquiry')}
            surface="onSurface"
          />
        </div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('musicVideo.faq.title')}
        subtitle={t('musicVideo.faq.subtitle')}
        variant="default"
      />

      <ReviewSection variant="alternate" locale={locale} />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('musicVideo.relatedStoriesTitle')}
        subtitle={t('musicVideo.relatedStoriesSubtitle')}
      />

      {/* 음원도 한 곳에서 — 영상에 쓸 소리를 만드는 서비스로 */}
      <ServiceQuickLinksSection
        links={[
          { href: `/${locale}/recording`, label: t('nav.recording'), color: 'primary' },
          { href: `/${locale}/mixing-mastering`, label: t('nav.mixingMastering'), color: 'primary' },
          { href: `/${locale}/release-project`, label: t('nav.releaseProject'), color: 'primary' },
          { href: `/${locale}/cover-video`, label: t('nav.coverVideo'), color: 'primary' },
        ]}
      />

      <Section variant="default">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('musicVideo.cta.titleLine1')}</span>
              <span className="block text-gray-950 dark:text-white">{t('musicVideo.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('musicVideo.cta.subtitleLine1')}</span>
              <span className="block">{t('musicVideo.cta.subtitleLine2')}</span>
            </>
          }
          imageSrc="/images/music-video-scene-20261022.webp"
          imageAlt={t('musicVideo.director.imageAlt')}
          primaryButtonLabel={t('musicVideo.cta.inquiry')}
          secondaryButtonLabel={t('musicVideo.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

MusicVideo.hasHero = true;
MusicVideo.designEdition = 'v2';

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const relatedStories = getServiceRelatedStories('music-video', locale);
  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories },
    { revalidate: 86400, i18nSections: ['musicVideo', 'stories'] }
  );
};

export default MusicVideo;
