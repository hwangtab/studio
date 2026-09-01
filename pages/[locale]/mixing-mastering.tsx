import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { m } from 'framer-motion';
import {
  SlidersHorizontal,
  Disc,
  Globe2,
  Upload,
  Speaker,
  ListChecks,
  Users,
  Award,
  ArrowRight,
  CheckCircle2,
} from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../../components/ResponsiveImage';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import SectionHeading from '../../components/ui/SectionHeading';
import type { LucideIcon } from '@/lib/lucide-icons';
import BaseCard from '../../components/ui/BaseCard';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';

// Below-fold 컴포넌트 code-splitting
const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const QuickAnswers = dynamic(() => import('../../components/ui/QuickAnswers'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getPricingData, MIXING_LEVEL1_PRICE } from '../../data/pricing';
import { buildPortfolioItems } from '../../data/portfolio/items';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createFadeInAnimation, createInViewEnterAnimation, HOVER_SCALE, TRANSITION_STANDARD } from '../../utils/animationUtils';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import { trackLeadEvent } from '../../utils/analytics';
import type { NextPageWithLayout } from '../../types';

/** 믹싱 또는 마스터링을 스튜디오 놀이 직접 맡은 작업만 고른다.
 *  티어라이너 〈Bite Me〉는 마스터링이 런던 Metropolis라 믹싱 크레딧으로만 쓴다
 *  (역할 문구는 로케일 JSON의 credits.items.*.role이 담당). */
const CREDIT_PORTFOLIO_IDS = [
  'tierliner-bite-me',
  'semin-yeorin-ip',
  'kim-dong-san-mulgyeol',
  'namsu-annyeong',
] as const;

interface CreditItem {
  id: string;
  title: string;
  artist: string;
  image: string;
}

interface MixingMasteringProps {
  locale: Locale;
  pricingData: ReturnType<typeof getPricingData>;
  relatedStories: StoryCardData[];
  credits: CreditItem[];
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
const PROCESS_ANIMATION = createFadeInAnimation();
const ENV_ANIMATION = createInViewEnterAnimation({ axis: 'y' });
const ENV_IMAGE_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: -50 });
const ENV_TEXT_ANIMATION = createInViewEnterAnimation({ axis: 'x', distance: 50 });

const MixingMastering: NextPageWithLayout<MixingMasteringProps> = ({
  locale,
  pricingData,
  relatedStories,
  credits,
}) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  // 가격 SSOT(data/pricing.ts) — 가격 페이지 #mixing·#mastering과 동일 소스.
  const { mixingOffers, masteringOffers } = pricingData;

  const quickAnswers = React.useMemo(
    () => createTranslatedQaItems(t, 'mixingMastering.quickAnswers.items', 3),
    [t]
  );

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'mixingMastering.faq.items', 6),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'mixingMastering.process.steps', 4),
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/mixing-mastering`;

  const serviceSchema = React.useMemo(
    () => buildStudioServiceSchema({
      locale,
      siteName: siteConfig.name,
      siteUrl: siteConfig.url,
      pageUrl,
      name: t('mixingMastering.seo.title'),
      description: t('mixingMastering.seo.description'),
      serviceType: locale === 'ko' ? '믹싱 · 마스터링' : 'Mixing & Mastering',
      offerName: locale === 'ko' ? '믹싱 (10트랙 이하)' : 'Mixing (up to 10 tracks)',
      offerPrice: MIXING_LEVEL1_PRICE,
      pricingHash: 'mixing',
    }),
    [t, siteConfig, locale, pageUrl]
  );

  const howToSchema = React.useMemo(
    () =>
      generateHowToSchema(
        t('mixingMastering.process.title'),
        t('mixingMastering.process.subtitle'),
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

  const audienceIcons: LucideIcon[] = [Upload, SlidersHorizontal, Disc, Globe2];

  return (
    <>
      <SEO
        locale={locale}
        title={t('mixingMastering.seo.title')}
        description={t('mixingMastering.seo.description')}
        keywords={t('mixingMastering.seo.keywords')}
        ogImage="/images/og-hardware1.webp"
        ogImageAlt={t('mixingMastering.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/mixing-mastering`}
        faqItems={faqItems}
        schema={pageSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.mixingMastering'), path: `/${locale}/mixing-mastering` },
        ]}
        webPageType="ItemPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={t('mixingMastering.hero.title')}
        subtitle={
          <>
            <span className="block">{t('mixingMastering.hero.subtitleLine1')}</span>
            <span className="block">{t('mixingMastering.hero.subtitleLine2')}</span>
          </>
        }
        backgroundImage="/images/console.webp"
        imageAlt={t('mixingMastering.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.mixingMastering'), path: `/${locale}/mixing-mastering` },
        ]}
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="MixingMasteringHero"
            ctaId="mixing_hero_kakao"
            label={t('mixingMastering.cta.inquiry')}
            phone={siteConfig.contact.phone}
            phoneCtaId="mixing_hero_phone"
          />
        }
      />

      <QuickAnswers
        title={t('mixingMastering.quickAnswers.title')}
        subtitle={t('mixingMastering.quickAnswers.subtitle')}
        items={quickAnswers}
        variant="default"
      />

      {/* 타겟 오디언스 */}
      <Section variant="alternate">
        <m.div {...AUDIENCE_ANIMATION}>
          <SectionHeading
            icon={Users}
            title={t('mixingMastering.audience.title')}
            className="mb-8"
            as="h2"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {([0, 1, 2, 3] as const).map((i) => (
              <AudienceCard
                key={i}
                icon={audienceIcons[i]}
                title={t(`mixingMastering.audience.items.${i}.title`)}
                description={t(`mixingMastering.audience.items.${i}.description`)}
              />
            ))}
          </div>
        </m.div>
      </Section>

      {/* 믹싱 가격 — 가격 SSOT의 mixingOffers 3티어 */}
      <Section id="mixing" variant="default" className="scroll-mt-32">
        <SectionHeading
          icon={SlidersHorizontal}
          title={t('mixingMastering.mixing.title')}
          subtitle={t('mixingMastering.mixing.subtitle')}
          className="mb-10"
        />
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto items-stretch">
          {mixingOffers.map((offer) => (
            <PricingCard
              key={offer.id}
              id={offer.id}
              title={offer.title}
              price={offer.priceDisplay}
              unit={offer.unit}
              description={offer.description}
              features={offer.features}
              recommended={offer.recommended}
              ctaLabel={t('mixingMastering.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
              onCtaClick={() =>
                trackLeadEvent('lead_click_kakao', {
                  locale,
                  component: 'MixingMasteringPage',
                  cta_id: `mixing_price_${offer.id}_kakao`,
                })
              }
            />
          ))}
        </div>
        <p className="mt-6 text-center typo-card-body text-sm text-gray-500 dark:text-gray-400">
          {t('mixingMastering.mixing.vocalTuneNotice')}
        </p>
      </Section>

      {/* 마스터링 가격 — 싱글 / EP·정규 */}
      <Section id="mastering" variant="alternate" className="scroll-mt-32">
        <SectionHeading
          icon={Disc}
          title={t('mixingMastering.mastering.title')}
          subtitle={t('mixingMastering.mastering.subtitle')}
          className="mb-10"
        />
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
          {masteringOffers.map((offer) => (
            <PricingCard
              key={offer.id}
              id={offer.id}
              title={offer.title}
              price={offer.priceDisplay}
              unit={offer.unit}
              description={offer.description}
              features={offer.features}
              recommended={offer.recommended}
              ctaLabel={t('mixingMastering.cta.inquiry')}
              ctaHref={siteConfig.contact.kakaoUrl}
              onCtaClick={() =>
                trackLeadEvent('lead_click_kakao', {
                  locale,
                  component: 'MixingMasteringPage',
                  cta_id: `mastering_price_${offer.id}_kakao`,
                })
              }
            />
          ))}
        </div>
        <p className="mt-6 text-center typo-card-body text-sm text-gray-500 dark:text-gray-400">
          {pricingData.VAT_NOTICE}
        </p>
      </Section>

      {/* 원격 의뢰 절차 — HowTo 스키마와 동일 데이터 */}
      <Section variant="default">
        <m.div {...PROCESS_ANIMATION}>
          <SectionHeading
            icon={ListChecks}
            title={t('mixingMastering.process.title')}
            subtitle={t('mixingMastering.process.subtitle')}
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
                  {t(`mixingMastering.process.steps.${i}.title`)}
                </h3>
                <p className="typo-card-body text-sm">
                  {t(`mixingMastering.process.steps.${i}.description`)}
                </p>
              </m.div>
            ))}
          </div>
        </m.div>
      </Section>

      {/* 파일 준비 규격 */}
      <Section variant="alternate">
        <SectionHeading
          icon={Upload}
          title={t('mixingMastering.fileSpec.title')}
          subtitle={t('mixingMastering.fileSpec.subtitle')}
          className="mb-10"
        />
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {([0, 1] as const).map((group) => (
            <BaseCard key={group} variant="default" className="p-6 h-full">
              <h3 className="typo-card-subtitle mb-4">
                {t(`mixingMastering.fileSpec.groups.${group}.title`)}
              </h3>
              <ul className="space-y-3">
                {([0, 1, 2, 3] as const).map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2
                      className="text-primary flex-shrink-0 mt-0.5"
                      size={18}
                      aria-hidden="true"
                    />
                    <span className="typo-card-body text-sm">
                      {t(`mixingMastering.fileSpec.groups.${group}.items.${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </BaseCard>
          ))}
        </div>
      </Section>

      {/* 작업 환경 */}
      <Section variant="default">
        <m.div {...ENV_ANIMATION}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <m.div
              {...ENV_IMAGE_ANIMATION}
              className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl group"
            >
              <ResponsiveImage
                src="/images/console.webp"
                alt={t('mixingMastering.environment.imageAlt')}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
                pictureClassName="block h-full"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
            </m.div>

            <m.div {...ENV_TEXT_ANIMATION}>
              <SectionHeading
                icon={Speaker}
                title={t('mixingMastering.environment.title')}
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
                      {t(`mixingMastering.environment.features.${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/studio-info`}
                prefetch={false}
                className="mt-8 inline-flex items-center gap-2 text-primary font-semibold hover:underline"
              >
                {t('mixingMastering.environment.equipmentLink')} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </m.div>
          </div>
        </m.div>
      </Section>

      {/* 믹싱·마스터링 크레딧 */}
      {credits.length > 0 && (
        <Section variant="alternate">
          <SectionHeading
            icon={Award}
            title={t('mixingMastering.credits.title')}
            subtitle={t('mixingMastering.credits.subtitle')}
            className="mb-10"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {credits.map((credit, i) => (
              <Link
                key={credit.id}
                href={`/${locale}/portfolio/${credit.id}`}
                prefetch={false}
                className="group"
              >
                <BaseCard variant="default" className="p-4 h-full">
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-4">
                    <ResponsiveImage
                      src={credit.image}
                      alt={credit.title}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-slow"
                      pictureClassName="block h-full"
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </div>
                  <h3 className="typo-card-subtitle text-sm mb-1">{credit.title}</h3>
                  <p className="typo-card-meta text-xs">
                    {t(`mixingMastering.credits.items.${i}.role`)}
                  </p>
                </BaseCard>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={`/${locale}/portfolio`}
              prefetch={false}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
            >
              {t('nav.portfolio')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Section>
      )}

      <FAQSection
        items={faqItems}
        title={t('mixingMastering.faq.title')}
        subtitle={t('mixingMastering.faq.subtitle')}
        variant="default"
      />

      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('mixingMastering.relatedStoriesTitle')}
        subtitle={t('mixingMastering.relatedStoriesSubtitle')}
      />

      {/* 관련 서비스 바로가기 */}
      <Section variant="alternate" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/recording`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.recording')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/release-project`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.releaseProject')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('mixingMastering.cta.titleLine1')}</span>
              <span className="block text-primary">{t('mixingMastering.cta.titleHighlight')}</span>
            </>
          }
          subtitle={
            <>
              <span className="block">{t('mixingMastering.cta.subtitleLine1')}</span>
              <span className="block">{t('mixingMastering.cta.subtitleLine2')}</span>
            </>
          }
          imageSrc="/images/console.webp"
          imageAlt={t('mixingMastering.cta.imageAlt')}
          primaryButtonLabel={t('mixingMastering.cta.inquiry')}
          secondaryButtonLabel={t('mixingMastering.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

MixingMastering.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const pricingData = getPricingData(locale);
  const relatedStories = getServiceRelatedStories('mixing-mastering', locale);

  // 크레딧 카드는 포트폴리오 SSOT에서 끌어온다 — 제목·아티스트·이미지가
  // 포트폴리오 상세와 어긋나지 않도록. 역할 문구만 로케일 JSON이 담당한다.
  const portfolioById = new Map(buildPortfolioItems(locale).map((item) => [item.id, item]));
  const credits: CreditItem[] = CREDIT_PORTFOLIO_IDS.map((id) => portfolioById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      image: item.image,
    }));

  return buildPageStaticProps(
    locale,
    { pricingData, relatedStories, credits },
    { revalidate: 86400, i18nSections: ['mixingMastering', 'stories'] }
  );
};

export default MixingMastering;
