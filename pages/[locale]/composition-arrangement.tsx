import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import { Music, Users, ListChecks, CheckCircle2, Piano, Layers, FileAudio, Sparkles } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import ServiceQuickLinksSection from '../../components/service/ServiceQuickLinksSection';
import SEO from '../../components/SEO';
import ImageHero, { HERO_SCRIM_STRONG } from '../../components/common/ImageHero';
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
const HubLinkCallout = dynamic(() => import('../../components/guides/HubLinkCallout'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import {
  ARRANGEMENT_BAND_PRICE,
  ARRANGEMENT_LARGE_PRICE,
  ARRANGEMENT_SMALL_PRICE,
  COMPOSITION_PRICE,
  CUSTOM_MR_PRICE,
  formatPriceLabel,
  getPricingData,
} from '../../data/pricing';
import { trackLeadEvent } from '../../utils/analytics';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createFadeInAnimation, createInViewEnterAnimation } from '../../utils/animationUtils';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import type { NextPageWithLayout } from '../../types';

/**
 * 작곡·편곡·MR 제작·프로듀싱 의뢰 LP (2026-10-05).
 *
 * 가격은 data/pricing.ts의 arrangementOffers(작곡·소편성·풀밴드·대편성 편곡·맞춤 MR) 하나를
 * /pricing과 같이 그린다. 처음엔 "상담 후 견적"으로 열었다가 같은 날 운영자 결정으로 정가를 뒀다 —
 * 사이트 안의 숫자(믹싱 트랙 수 등급, 발매 싱글 페이지의 편곡 확장 +50~150만원, 싱글 번들가,
 * 10트랙 이하 믹싱가)에서 끌어낸 값이고 근거는 pricing.ts 상수 주석에 있다. 카피의 금액은
 * common.json에 리터럴로 두지 않고 {{composition}}·{{small}}… 보간으로 상수에서 끌어온다.
 *
 * 예약 플로우(BookingEntryButton)는 없다 — 레퍼런스·데모를 보고 등급을 정한 뒤 시작하는 상품이다.
 */

interface CompositionArrangementProps {
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
        <Icon className="text-primary dark:text-primary-lighter" size={22} aria-hidden="true" />
      </div>
      <h3 className="typo-card-subtitle">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

const AUDIENCE_ANIMATION = createFadeInAnimation();
const SERVICES_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const PRICING_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50 });
const PRICING_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50 });
const PROCESS_ANIMATION = createFadeInAnimation();

const SERVICE_ICONS: LucideIcon[] = [Music, Layers, FileAudio, Sparkles];
const AUDIENCE_ICONS: LucideIcon[] = [Music, Users, Users, Piano];

const CompositionArrangement: NextPageWithLayout<CompositionArrangementProps> = ({ locale, pricingData, relatedStories }) => {
  const { t: tRaw } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  // 카피 안의 금액은 전부 상수 보간 — common.json에 숫자를 박지 않는다(가격 드리프트 방지).
  const priceVars = React.useMemo(
    () => ({
      composition: formatPriceLabel(COMPOSITION_PRICE, locale),
      small: formatPriceLabel(ARRANGEMENT_SMALL_PRICE, locale),
      band: formatPriceLabel(ARRANGEMENT_BAND_PRICE, locale),
      large: formatPriceLabel(ARRANGEMENT_LARGE_PRICE, locale),
      mr: formatPriceLabel(CUSTOM_MR_PRICE, locale),
    }),
    [locale]
  );
  const t = React.useCallback((key: string) => tRaw(key, priceVars), [tRaw, priceVars]);

  const arrangementOffers = pricingData.arrangementOffers;
  const smallOffer = React.useMemo(
    () => arrangementOffers.find((o) => o.id === 'arrangement-small'),
    [arrangementOffers]
  );

  const quickAnswers = React.useMemo(
    () => createTranslatedQaItems(t, 'compositionArrangement.quickAnswers.items', 3),
    [t]
  );

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'compositionArrangement.faq.items', 7),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'compositionArrangement.process.steps', 5),
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/composition-arrangement`;

  const serviceSchema = React.useMemo(
    () => buildStudioServiceSchema({
      locale,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
      pageUrl,
      name: t('compositionArrangement.seo.title'),
      description: t('compositionArrangement.seo.description'),
      serviceType: locale === 'ko' ? '작곡·편곡·음악 프로듀싱' : 'Music Composition, Arrangement & Production',
      offerName: smallOffer?.title ?? (locale === 'ko' ? '소편성 편곡' : 'Small-Ensemble Arrangement'),
      offerPrice: ARRANGEMENT_SMALL_PRICE,
      pricingHash: 'arrangement',
    }),
    [t, siteConfig, locale, pageUrl, smallOffer]
  );

  const howToSchema = React.useMemo(
    () =>
      generateHowToSchema(
        t('compositionArrangement.process.title'),
        t('compositionArrangement.process.subtitle'),
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

  return (
    <>
      <SEO
        locale={locale}
        title={t('compositionArrangement.seo.title')}
        description={t('compositionArrangement.seo.description')}
        keywords={t('compositionArrangement.seo.keywords')}
        ogImage="/images/og-hardware1.webp"
        ogImageAlt={t('compositionArrangement.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/composition-arrangement`}
        faqItems={faqItems}
        schema={pageSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.compositionArrangement'), path: `/${locale}/composition-arrangement` },
        ]}
        webPageType="ItemPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={t('compositionArrangement.hero.title')}
        subtitle={
          <>
            <span className="block">{t('compositionArrangement.hero.subtitleLine1')}</span>
            <span className="block">{t('compositionArrangement.hero.subtitleLine2')}</span>
          </>
        }
        backgroundImage="/images/hardware1.webp"
        imageAlt={t('compositionArrangement.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient={HERO_SCRIM_STRONG}
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.compositionArrangement'), path: `/${locale}/composition-arrangement` },
        ]}
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="CompositionArrangementHero"
            ctaId="composition_arrangement_hero_kakao"
            label={t('compositionArrangement.cta.inquiry')}
          />
        }
      />

      <QuickAnswers
        title={t('compositionArrangement.quickAnswers.title')}
        subtitle={t('compositionArrangement.quickAnswers.subtitle')}
        items={quickAnswers}
        variant="default"
      />

      {/* 타겟 오디언스 */}
      <Section variant="alternate">
        <m.div {...AUDIENCE_ANIMATION}>
          <SectionHeading
            icon={Users}
            title={t('compositionArrangement.audience.title')}
            className="mb-8"
            as="h2"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {([0, 1, 2, 3] as const).map((i) => (
              <AudienceCard
                key={i}
                icon={AUDIENCE_ICONS[i]}
                title={t(`compositionArrangement.audience.items.${i}.title`)}
                description={t(`compositionArrangement.audience.items.${i}.description`)}
              />
            ))}
          </div>
        </m.div>
      </Section>

      {/* 맡길 수 있는 작업 — 작곡 · 편곡 · MR 제작 · 프로듀싱 */}
      <Section id="composition-arrangement-services" variant="default">
        <m.div {...SERVICES_ANIMATION}>
          <SectionHeading
            icon={Piano}
            title={t('compositionArrangement.services.title')}
            subtitle={t('compositionArrangement.services.subtitle')}
            className="mb-12"
            as="h2"
          />
          <div className="grid sm:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {([0, 1, 2, 3] as const).map((i) => {
              const Icon = SERVICE_ICONS[i];
              return (
                <BaseCard key={i} variant="glass" className="p-6 h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full">
                      <Icon className="text-primary dark:text-primary-lighter" size={22} aria-hidden="true" />
                    </div>
                    <h3 className="typo-card-subtitle">{t(`compositionArrangement.services.items.${i}.title`)}</h3>
                  </div>
                  <p className="typo-card-body">{t(`compositionArrangement.services.items.${i}.description`)}</p>
                </BaseCard>
              );
            })}
          </div>
        </m.div>
      </Section>

      {/* 가격표 — /pricing과 같은 arrangementOffers. 등급은 믹싱과 같은 트랙 수. */}
      <Section id="composition-arrangement-pricing" variant="alternate">
        <SectionHeading
          icon={ListChecks}
          title={t('compositionArrangement.pricing.title')}
          subtitle={t('compositionArrangement.pricing.subtitle')}
          className="mb-10"
          as="h2"
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto" role="list">
          {arrangementOffers.map((offer, index) => (
            <div key={offer.id} role="listitem">
              <PricingCard
                id={offer.id}
                title={offer.title}
                price={offer.priceDisplay}
                unit={offer.unit}
                description={offer.description}
                features={offer.features}
                recommended={offer.recommended}
                delay={0.1 * (index + 1)}
                ctaLabel={t('compositionArrangement.pricing.cta')}
                ctaHref={siteConfig.contact.kakaoUrl}
                onCtaClick={() =>
                  trackLeadEvent('lead_click_kakao', {
                    locale,
                    component: 'CompositionArrangementPage',
                    cta_id: `composition_arrangement_${offer.id}_kakao`,
                  })
                }
              />
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto mt-14">
          <m.div {...PRICING_IMAGE_ANIMATION}>
            <h3 className="typo-card-subtitle mb-5">{t('compositionArrangement.pricing.factorsTitle')}</h3>
            <ol className="space-y-4">
              {([0, 1, 2, 3] as const).map((i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-lighter font-bold text-sm">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="typo-card-subtitle text-base mb-1">
                      {t(`compositionArrangement.pricing.factors.${i}.label`)}
                    </p>
                    <p className="typo-card-body text-sm">
                      {t(`compositionArrangement.pricing.factors.${i}.detail`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </m.div>

          <m.div {...PRICING_TEXT_ANIMATION}>
            <BaseCard variant="glass" className="p-6">
              <h3 className="typo-card-subtitle mb-4">{t('compositionArrangement.pricing.referenceTitle')}</h3>
              <ul className="space-y-3">
                {([0, 1, 2] as const).map((i) => (
                  <li key={i} className="flex gap-3 typo-card-body text-sm">
                    <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5 text-primary dark:text-primary-lighter" aria-hidden="true" />
                    <span className="min-w-0">{t(`compositionArrangement.pricing.referenceItems.${i}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4">
                <HeroKakaoCta
                  locale={locale}
                  kakaoUrl={siteConfig.contact.kakaoUrl}
                  component="CompositionArrangementPage"
                  ctaId="composition_arrangement_pricing_kakao"
                  label={t('compositionArrangement.pricing.cta')}
                  surface="onSurface"
                />
                <Link
                  href={`/${locale}/pricing#arrangement`}
                  className="typo-card-body text-sm font-semibold text-primary dark:text-primary-lighter underline-offset-4 hover:underline"
                >
                  {t('nav.pricing')} →
                </Link>
              </div>
            </BaseCard>
          </m.div>
        </div>
      </Section>

      {/* 진행 절차 — 5단계 (HowTo 스키마) */}
      <Section variant="default">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            icon={ListChecks}
            title={t('compositionArrangement.process.title')}
            subtitle={t('compositionArrangement.process.subtitle')}
            className="mb-12"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            {([0, 1, 2, 3, 4] as const).map((i) => (
              <m.div
                key={i}
                className="relative glass-card rounded-2xl p-6"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                  <span className="text-primary dark:text-primary-lighter font-bold text-sm">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="typo-card-subtitle mb-2">
                  {t(`compositionArrangement.process.steps.${i}.title`)}
                </h3>
                <p className="typo-card-body text-sm">
                  {t(`compositionArrangement.process.steps.${i}.description`)}
                </p>
              </m.div>
            ))}
          </div>
        </m.div>
      </Section>

      {/* 납품과 권리 */}
      <Section id="composition-arrangement-delivery" variant="alternate">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <div className="relative h-[320px] lg:h-[460px] rounded-2xl overflow-hidden shadow-2xl">
            <ResponsiveImage
              src="/images/hardware2.webp"
              alt={t('compositionArrangement.cta.imageAlt')}
              className="w-full h-full object-cover"
              pictureClassName="block h-full"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
          </div>
          <div>
            <SectionHeading
              icon={FileAudio}
              title={t('compositionArrangement.delivery.title')}
              align="left"
              className="mb-8"
              as="h2"
              titleClassName="mb-2"
            />
            <h3 className="typo-card-subtitle mb-3">{t('compositionArrangement.delivery.filesTitle')}</h3>
            <ul className="space-y-3 mb-8">
              {([0, 1, 2, 3] as const).map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="text-primary dark:text-primary-lighter flex-shrink-0 mt-0.5" size={20} aria-hidden="true" />
                  <span className="typo-card-body">{t(`compositionArrangement.delivery.files.${i}`)}</span>
                </li>
              ))}
            </ul>
            <h3 className="typo-card-subtitle mb-3">{t('compositionArrangement.delivery.rightsTitle')}</h3>
            <ul className="space-y-3">
              {([0, 1, 2, 3] as const).map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="text-primary dark:text-primary-lighter flex-shrink-0 mt-0.5" size={20} aria-hidden="true" />
                  <span className="typo-card-body">{t(`compositionArrangement.delivery.rights.${i}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('compositionArrangement.faq.title')}
        subtitle={t('compositionArrangement.faq.subtitle')}
        variant="default"
      />

      <ReviewSection variant="alternate" locale={locale} />

      <HubLinkCallout
        hubSlug="indie-release-guide"
        locale={locale}
        title={t('compositionArrangement.hubCallout.title')}
        subtitle={t('compositionArrangement.hubCallout.subtitle')}
      />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('compositionArrangement.relatedStoriesTitle')}
        subtitle={t('compositionArrangement.relatedStoriesSubtitle')}
      />

      <ServiceQuickLinksSection
        links={[
          { href: `/${locale}/recording`, label: t('nav.recording'), color: 'primary' },
          { href: `/${locale}/mixing-mastering`, label: t('nav.mixingMastering'), color: 'primary' },
          { href: `/${locale}/release-project`, label: t('nav.releaseProject'), color: 'primary' },
        ]}
      />

      <Section variant="default">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('compositionArrangement.cta.titleLine1')}</span>
              <span className="block text-primary dark:text-primary-lighter">{t('compositionArrangement.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('compositionArrangement.cta.subtitleLine1')}</span>
              <span className="block">{t('compositionArrangement.cta.subtitleLine2')}</span>
            </>
          }
          imageSrc="/images/hardware1.webp"
          imageAlt={t('compositionArrangement.cta.imageAlt')}
          primaryButtonLabel={t('compositionArrangement.cta.inquiry')}
          secondaryButtonLabel={t('compositionArrangement.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

CompositionArrangement.hasHero = true;
CompositionArrangement.designEdition = 'v2';

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const relatedStories = getServiceRelatedStories('composition-arrangement', locale);
  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories },
    { revalidate: 86400, i18nSections: ['compositionArrangement', 'stories'] }
  );
};

export default CompositionArrangement;
