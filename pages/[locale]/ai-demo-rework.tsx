import type { GetStaticPaths, GetStaticProps } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  CheckCircle2,
  Globe2,
  Info,
  ListChecks,
  Mic2,
  Music,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import ImageHero, { HERO_SCRIM_STRONG } from '../../components/common/ImageHero';
import HeroKakaoCta from '../../components/common/HeroKakaoCta';
import SectionHeading from '../../components/ui/SectionHeading';
import BaseCard from '../../components/ui/BaseCard';
import { Section } from '../../components/ui/Section';
import PricingCard from '../../components/ui/PricingCard';
import { centeredGrid } from '../../components/ui/centeredGrid';

const FAQSection = dynamic(() => import('../../components/ui/FAQSection'));
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
const RelatedStoriesSection = dynamic(() => import('../../components/ui/RelatedStoriesSection'));

import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import {
  AI_REWORK_VOCAL_ONLY_PRICE,
  getAiReworkPriceLabels,
  type AiReworkPriceLabels,
} from '../../data/aiRework';
import { trackLeadEvent } from '../../utils/analytics';
import { getServiceRelatedStories } from '../../lib/serviceRelatedStories';
import type { StoryCardData } from '../../types/story';
import { buildSchemaGraph, buildStudioServiceSchema } from '../../lib/studioServiceSchema';
import { generateHowToSchema } from '../../utils/schema';
import { createTranslatedHowToSteps, createTranslatedQaItems } from '../../utils/translatedList';
import type { NextPageWithLayout } from '../../types';

const TIER_COUNT = 3;
const FAQ_COUNT = 5;

const PRICE_GRID = centeredGrid({ md: 3, lg: 3, gap: 6 });

interface AiDemoReworkProps {
  locale: Locale;
  priceLabels: AiReworkPriceLabels;
  relatedStories: StoryCardData[];
}

const ItemList = ({
  items,
  icon: Icon,
  tone = 'neutral',
}: {
  items: string[];
  icon: LucideIcon;
  tone?: 'neutral' | 'positive' | 'negative';
}) => {
  const iconClass =
    tone === 'positive'
      ? 'text-primary dark:text-primary-lighter'
      : tone === 'negative'
        ? 'text-gray-400 dark:text-gray-500'
        : 'text-gray-700 dark:text-gray-300';

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <Icon className={`${iconClass} flex-shrink-0 mt-0.5`} size={20} aria-hidden="true" />
          <span className="typo-card-body text-sm min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
};

const AiDemoRework: NextPageWithLayout<AiDemoReworkProps> = ({ locale, priceLabels, relatedStories }) => {
  const { t: tRaw } = useTranslation('common', { lng: locale });
  const priceVars = React.useMemo(() => ({ ...priceLabels }), [priceLabels]);
  const t = React.useCallback((key: string) => tRaw(key, priceVars), [tRaw, priceVars]);
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const faqItems = React.useMemo(
    () => createTranslatedQaItems(t, 'aiDemoRework.faq.items', FAQ_COUNT),
    [t]
  );

  const howToSteps = React.useMemo(
    () => createTranslatedHowToSteps(t, 'aiDemoRework.tiers.items', TIER_COUNT),
    [t]
  );

  const pageUrl = `${siteConfig.url}/${locale}/ai-demo-rework`;

  const serviceSchema = React.useMemo(
    () =>
      buildStudioServiceSchema({
        locale,
        siteName: siteConfig.name,
        siteUrl: siteConfig.url,
        pageUrl,
        name: t('aiDemoRework.seo.title'),
        description: t('aiDemoRework.seo.description'),
        serviceType: locale === 'ko' ? 'AI 데모 리워크·음악 제작' : 'AI Demo Rework & Music Production',
        offerName: t('aiDemoRework.tiers.items.0.title'),
        offerPrice: AI_REWORK_VOCAL_ONLY_PRICE,
        pricingHash: 'arrangement',
        remote: true,
      }),
    [t, siteConfig, locale, pageUrl]
  );

  const howToSchema = React.useMemo(
    () =>
      generateHowToSchema(
        t('aiDemoRework.seo.title'),
        t('aiDemoRework.seo.description'),
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

  const requirements = {
    hard: [t('aiDemoRework.requirements.hard.0'), t('aiDemoRework.requirements.hard.1')],
    soft: [
      t('aiDemoRework.requirements.soft.0'),
      t('aiDemoRework.requirements.soft.1'),
      t('aiDemoRework.requirements.soft.2'),
      t('aiDemoRework.requirements.soft.3'),
    ],
  };

  const promises = {
    included: [
      t('aiDemoRework.promises.included.0'),
      t('aiDemoRework.promises.included.1'),
      t('aiDemoRework.promises.included.2'),
    ],
    excluded: [
      t('aiDemoRework.promises.excluded.0'),
      t('aiDemoRework.promises.excluded.1'),
      t('aiDemoRework.promises.excluded.2'),
    ],
  };

  return (
    <>
      <SEO
        locale={locale}
        title={t('aiDemoRework.seo.title')}
        description={t('aiDemoRework.seo.description')}
        keywords={t('aiDemoRework.seo.keywords')}
        ogImage="/images/og-hardware1.webp"
        ogImageAlt={t('aiDemoRework.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        canonical={`/${locale}/ai-demo-rework`}
        faqItems={faqItems}
        schema={pageSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.aiDemoRework'), path: `/${locale}/ai-demo-rework` },
        ]}
        webPageType="ItemPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={t('aiDemoRework.hero.title')}
        subtitle={
          <>
            <span className="block">{t('aiDemoRework.hero.subtitleLine1')}</span>
            <span className="block">{t('aiDemoRework.hero.subtitleLine2')}</span>
          </>
        }
        backgroundImage="/images/hardware1.webp"
        imageAlt={t('aiDemoRework.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient={HERO_SCRIM_STRONG}
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.aiDemoRework'), path: `/${locale}/ai-demo-rework` },
        ]}
        ctaButtons={
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            component="AiDemoReworkHero"
            ctaId="ai_demo_rework_hero_kakao"
            label={t('aiDemoRework.cta.button')}
            secondary={{
              label: t('actions.seePricing'),
              href: '#ai-demo-rework-pricing',
              ctaId: 'ai_demo_rework_hero_pricing',
            }}
          />
        }
      />

      <Section variant="default">
        <SectionHeading
          icon={Mic2}
          index="01"
          title={t('aiDemoRework.intro.title')}
          subtitle={t('aiDemoRework.intro.body')}
          as="h2"
        />
      </Section>

      <Section id="ai-demo-rework-pricing" variant="alternate">
        <SectionHeading
          icon={ListChecks}
          index="02"
          title={t('aiDemoRework.tiers.title')}
          subtitle={t('aiDemoRework.tiers.subtitle')}
          as="h2"
        />
        <div className={`${PRICE_GRID.container} max-w-6xl mx-auto`} role="list">
          {([0, 1, 2] as const).map((i) => (
            <div key={i} role="listitem" className={PRICE_GRID.item}>
              <PricingCard
                id={`ai-rework-tier-${i}`}
                title={t(`aiDemoRework.tiers.items.${i}.title`)}
                price={t(`aiDemoRework.tiers.items.${i}.priceNote`)}
                description={t(`aiDemoRework.tiers.items.${i}.description`)}
                features={[]}
                delay={0.1 * (i + 1)}
                ctaLabel={t('aiDemoRework.pricing.cta')}
                ctaHref={siteConfig.contact.kakaoUrl}
                onCtaClick={() =>
                  trackLeadEvent('lead_click_kakao', {
                    locale,
                    component: 'AiDemoReworkPage',
                    cta_id: `ai_demo_rework_tier_${i}_kakao`,
                  })
                }
              />
            </div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mt-10 space-y-2">
          <p className="typo-card-body text-sm">{t('aiDemoRework.pricing.note')}</p>
          <p className="typo-card-body text-sm">{t('aiDemoRework.pricing.releaseNote')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('aiDemoRework.pricing.updated')}</p>
        </div>
      </Section>

      <Section variant="default">
        <SectionHeading
          icon={ShieldCheck}
          index="03"
          title={t('aiDemoRework.requirements.title')}
          subtitle={t('aiDemoRework.requirements.subtitle')}
          as="h2"
        />
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <BaseCard variant="highlight" className="p-6 h-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-gray-700 dark:text-gray-300" size={22} aria-hidden="true" />
              <h3 className="typo-card-subtitle">{t('aiDemoRework.requirements.hardTitle')}</h3>
            </div>
            <ItemList items={requirements.hard} icon={AlertCircle} />
          </BaseCard>
          <BaseCard variant="glass" className="p-6 h-full">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="text-gray-700 dark:text-gray-300" size={22} aria-hidden="true" />
              <h3 className="typo-card-subtitle">{t('aiDemoRework.requirements.softTitle')}</h3>
            </div>
            <ItemList items={requirements.soft} icon={CheckCircle2} tone="positive" />
          </BaseCard>
        </div>
      </Section>

      <Section variant="alternate">
        <SectionHeading
          icon={CheckCircle2}
          index="04"
          title={t('aiDemoRework.promises.title')}
          as="h2"
        />
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <BaseCard variant="glass" className="p-6 h-full">
            <h3 className="typo-card-subtitle mb-4">{t('aiDemoRework.promises.includedTitle')}</h3>
            <ItemList items={promises.included} icon={CheckCircle2} tone="positive" />
          </BaseCard>
          <BaseCard variant="outline" className="p-6 h-full">
            <h3 className="typo-card-subtitle mb-4">{t('aiDemoRework.promises.excludedTitle')}</h3>
            <ItemList items={promises.excluded} icon={XCircle} tone="negative" />
          </BaseCard>
        </div>
      </Section>

      <Section variant="default">
        <SectionHeading
          icon={Globe2}
          index="05"
          title={t('aiDemoRework.release.title')}
          subtitle={t('aiDemoRework.release.body')}
          as="h2"
        />
        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <BaseCard variant="glass" className="p-6 h-full">
            <div className="flex items-center gap-3">
              <Music className="text-gray-700 dark:text-gray-300 flex-shrink-0" size={22} aria-hidden="true" />
              <p className="typo-card-body text-sm min-w-0">{t('aiDemoRework.release.domestic')}</p>
            </div>
          </BaseCard>
          <BaseCard variant="glass" className="p-6 h-full">
            <div className="flex items-center gap-3">
              <Globe2 className="text-gray-700 dark:text-gray-300 flex-shrink-0" size={22} aria-hidden="true" />
              <p className="typo-card-body text-sm min-w-0">{t('aiDemoRework.release.global')}</p>
            </div>
          </BaseCard>
        </div>

        <div className="max-w-4xl mx-auto mt-14">
          <h3 className="typo-card-subtitle mb-3">{t('aiDemoRework.rights.title')}</h3>
          <p className="typo-card-body">{t('aiDemoRework.rights.body')}</p>
          <p className="mt-4 flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Info className="flex-shrink-0 mt-0.5" size={16} aria-hidden="true" />
            <span className="min-w-0">{t('aiDemoRework.rights.komca')}</span>
          </p>
        </div>
      </Section>

      <FAQSection
        items={faqItems}
        title={t('aiDemoRework.faq.title')}
        subtitle=""
        variant="alternate"
        index="06"
      />

      <RelatedStoriesSection stories={relatedStories} locale={locale} title={t('nav.stories')} />

      <Section variant="alternate">
        <ContactCTA
          locale={locale}
          title={t('aiDemoRework.cta.title')}
          subtitle={t('aiDemoRework.cta.body')}
          imageSrc="/images/hardware1.webp"
          imageAlt={t('aiDemoRework.hero.alt')}
          primaryButtonLabel={t('aiDemoRework.cta.button')}
          secondaryButtonLabel={t('actions.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

AiDemoRework.hasHero = true;
AiDemoRework.designEdition = 'v2';

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  return buildPageStaticProps(
    locale,
    {
      priceLabels: getAiReworkPriceLabels(locale),
      relatedStories: getServiceRelatedStories('composition-arrangement', locale),
    },
    { revalidate: 86400, i18nSections: ['aiDemoRework', 'stories'] }
  );
};

export default AiDemoRework;
