import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, CheckCircle, Users, DollarSign,
  Target, Calendar, ListChecks, X,
  ArrowRightLeft,
} from '@/lib/lucide-icons';
import SEO from '../SEO';
import SectionHeading from '../ui/SectionHeading';
import ImageHero from '../common/ImageHero';
import FAQSection from '../ui/FAQSection';
import ReleaseConsultationSteps from './ReleaseConsultationSteps';
import ReleaseDiscographySection from './ReleaseDiscographySection';
import ReleaseHeroCtas from './ReleaseHeroCtas';
import ReleaseProducerIntro from './ReleaseProducerIntro';
import ReleaseReviewsSection from './ReleaseReviewsSection';
import TierComparisonTable from './TierComparisonTable';
import { Section } from '../ui/Section';
import { getReviews } from '../../data/reviews';
import { getSiteConfig } from '../../data/siteConfig';
import { generateReleaseProjectSchema } from '../../utils/schema';
import { usePortfolioModalLazy } from '../../hooks/usePortfolioModalLazy';
import type { Locale } from '../../lib/i18n';
import type { PortfolioItem } from '../../types/data';

const ContactCTA = dynamic(() => import('../common/ContactCTA'));
const HubLinkCallout = dynamic(() => import('../guides/HubLinkCallout'));
const PortfolioDetailModal = dynamic(() => import('../PortfolioDetailModal'), { ssr: false });

interface FocusItem {
  title: string;
  desc: string;
}

interface JourneyItem {
  month: string;
  label: string;
  desc: string;
}

interface ConsultationStep {
  num: string;
  title: string;
  desc: string;
}

interface ProducerStat {
  value: string;
  label: string;
}

interface TierPageProps {
  locale: Locale;
  tier: 'single' | 'ep' | 'album';
  portfolioItems: Pick<PortfolioItem, 'id' | 'title' | 'description' | 'image' | 'artist' | 'featured' | 'category'>[];
}

const TIER_HERO_IMAGES: Record<'single' | 'ep' | 'album', string> = {
  single: '/images/recording11.webp',
  ep: '/images/recording13.webp',
  album: '/images/recording15.webp',
};
const ALL_TIERS: Array<'single' | 'ep' | 'album'> = ['single', 'ep', 'album'];
const REVIEW_IDS_FOR_RELEASE_PROJECT = ['review-1', 'review-3'];

export const TierPage: React.FC<TierPageProps> = ({ locale, tier, portfolioItems }) => {
  const { t } = useTranslation('common', { lng: locale });
  const getLink = (path: string) => `/${locale}${path}`;
  const siteConfig = getSiteConfig(locale);
  const { selectedItem, categories, open: openModal, close: closeModal, loadError } = usePortfolioModalLazy(
    locale,
    `/${locale}/release-project/${tier}`
  );
  const k = (key: string) => `releaseProject.tiers.${tier}.detail.${key}`;

  const personaItems = t(k('personaItems'), { returnObjects: true }) as string[];
  const focusItems = t(k('focusItems'), { returnObjects: true }) as FocusItem[];
  const journeyItems = t(k('journeyItems'), { returnObjects: true }) as JourneyItem[];
  const deliverablesIncluded = t(k('deliverablesIncluded'), { returnObjects: true }) as string[];
  const deliverablesExcluded = t(k('deliverablesExcluded'), { returnObjects: true }) as string[];
  const faqItems = t(k('faqItems'), { returnObjects: true }) as { question: string; answer: string }[];
  const priceFactors = t(k('priceFactors'), { returnObjects: true }) as { label: string; detail: string }[];
  const consultationSteps = t('releaseProject.consultation.steps', { returnObjects: true }) as ConsultationStep[];
  const producerStats = t('releaseProject.producer.stats', { returnObjects: true }) as ProducerStat[];

  // portfolioItems는 getTierPortfolioItems가 이미 이 티어에 맞게 골라 정렬·상한(12)까지
  // 적용한 목록이다. 여기서 다시 featured로 거르지 않는다 — 그러면 티어 폴백으로 채운
  // 항목이 다시 떨어져 나가 빈 섹션이 된다(예전 재필터가 그 버그였다).
  const discographyItems = portfolioItems;
  const otherTiers = ALL_TIERS.filter((t) => t !== tier);
  const reviewsToShow = getReviews(locale).filter((r) => REVIEW_IDS_FOR_RELEASE_PROJECT.includes(r.id));

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t(`releaseProject.seo.${tier}.title`)}
        description={t(`releaseProject.seo.${tier}.description`)}
        keywords={t(`releaseProject.seo.${tier}.keywords`)}
        canonical={`/${locale}/release-project/${tier}`}
        // 이미지 사이트맵(next-sitemap pageImageMap)과 동일 대표 이미지 — og-default
        // 폴백이면 소셜 카드가 범용 이미지로 약화되고 두 신호가 서로 어긋난다.
        ogImage="/images/og-recording15.webp"
        ogImageAlt={t('releaseProject.hero.imageAlt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        webPageType="ItemPage"
        faqItems={Array.isArray(faqItems) ? faqItems : null}
        includeSchema
        schema={generateReleaseProjectSchema(siteConfig.url, locale, tier)}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.releaseProject'), path: `/${locale}/release-project` },
          { name: t(`releaseProject.tiers.${tier}.label`), path: `/${locale}/release-project/${tier}` },
        ]}
      />

      <ImageHero
        locale={locale}
        priority
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{t(k('heroTitlePrefix'))}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[var(--hero-title-accent)] to-white drop-shadow-[0_0_25px_var(--hero-title-glow)]">
              {t(k('heroTitleHighlight'))}
            </span>
            <span className="text-gray-100 drop-shadow-lg"> {t(k('heroTitleSuffix'))}</span>
          </>
        }
        subtitle={t(k('heroSubtitle'))}
        backgroundImage={TIER_HERO_IMAGES[tier]}
        imageAlt={t('releaseProject.hero.imageAlt')}
        minHeight="min-h-[60svh]"
        ctaButtons={
          <ReleaseHeroCtas
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            consultLabel={t('releaseProject.hero.ctaConsult')}
            secondaryHref={getLink('/release-project')}
            secondaryLabel={t(k('linkBack'))}
            secondaryLeadingIcon={<ArrowLeft size={16} />}
          />
        }
      />

      <ReleaseProducerIntro
        sectionTitle={t('releaseProject.producer.sectionTitle')}
        tagline={t('releaseProject.producer.tagline')}
        bodyParagraphs={[
          t('releaseProject.producer.bodyParagraph1'),
          t('releaseProject.producer.bodyParagraph2'),
        ]}
        stats={Array.isArray(producerStats) ? producerStats : []}
      />

      {/* 페르소나 */}
      <Section variant="default">
        <SectionHeading
          icon={Users}
          title={t(k('personaSectionTitle'))}
          className="mb-10"
        />
        <div className="max-w-2xl mx-auto space-y-3">
          {Array.isArray(personaItems) && personaItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 glass-card rounded-xl p-5"
            >
              <CheckCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">{item}</span>
            </div>
          ))}
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-4 pt-1">
            {t(k('personaNotFitNote'))}
          </p>
        </div>
      </Section>

      {/* 이 티어에서 특히 신경 쓰는 것 */}
      <Section variant="alternate">
        <SectionHeading
          icon={Target}
          title={t(k('focusSectionTitle'))}
          subtitle={t(k('focusSubtitle'))}
          className="mb-10"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {Array.isArray(focusItems) && focusItems.map((item, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-6"
            >
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 발매까지의 여정 */}
      <Section variant="default">
        <SectionHeading
          icon={Calendar}
          title={t(k('journeySectionTitle'))}
          subtitle={t(k('journeySubtitle'))}
          className="mb-10"
        />
        <div className="max-w-2xl mx-auto">
          {Array.isArray(journeyItems) && journeyItems.map((item, i) => {
            const isLast = i === journeyItems.length - 1;
            return (
              <div key={i} className="flex gap-5">
                <div className="flex-shrink-0 flex flex-col items-center self-stretch">
                  <div className="w-3 h-3 rounded-full bg-primary mt-2 flex-shrink-0 ring-4 ring-primary/10" />
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1" />
                  )}
                </div>
                <div className={`flex-1 ${!isLast ? 'pb-6' : ''}`}>
                  <p className="text-xs font-bold text-primary mb-1 tracking-wide">{item.month}</p>
                  <p className="font-bold text-gray-900 dark:text-white mb-1">{item.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 결과물 — 포함 / 별도 */}
      <Section variant="alternate">
        <SectionHeading
          icon={ListChecks}
          title={t(k('deliverablesSectionTitle'))}
          className="mb-10"
        />
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-primary flex-shrink-0" />
              {t(k('deliverablesIncludedTitle'))}
            </h3>
            <ul className="space-y-2.5">
              {Array.isArray(deliverablesIncluded) && deliverablesIncluded.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-primary mt-0.5 flex-shrink-0 text-base leading-none">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-400 dark:text-gray-500 mb-4 flex items-center gap-2 text-sm">
              <X size={16} className="flex-shrink-0" />
              {t(k('deliverablesExcludedTitle'))}
            </h3>
            <ul className="space-y-2.5">
              {Array.isArray(deliverablesExcluded) && deliverablesExcluded.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-500">
                  <span className="flex-shrink-0 mt-0.5">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* M1: 3티어 비교표 — 가격 결정 직전 */}
      <Section variant="default">
        <SectionHeading
          icon={DollarSign}
          title={t(k('priceSectionTitle'))}
          className="mb-10"
        />
        <div className="mb-12">
          <TierComparisonTable locale={locale} highlightTier={tier} />
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t(k('priceRange'))}</p>
            <p className="text-sm text-primary font-medium mb-4">{t(k('priceRationale'))}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t(k('priceNote'))}</p>
          </div>
          {Array.isArray(priceFactors) && priceFactors.length > 0 && (
            <div className="mt-8">
              <p className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                {t(k('priceFactorsTitle'))}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {priceFactors.map((f, i) => (
                  <div
                    key={i}
                    className="glass-card rounded-xl p-4"
                  >
                    <p className="text-xs font-bold text-primary mb-1">{f.label}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            {t('releaseProject.tiers.footNotePre')}{' '}
            <strong>{t('releaseProject.tiers.footNoteHighlight')}</strong>{' '}
            {t('releaseProject.tiers.footNoteMid')}{' '}
            <Link href={getLink('/pricing')} className="text-primary underline underline-offset-2 hover:text-primary-dark">
              {t('releaseProject.tiers.footNotePricingLabel')}
            </Link>
            {t('releaseProject.tiers.footNotePost')}
          </p>
        </div>
      </Section>

      <ReleaseDiscographySection
        locale={locale}
        title={t('releaseProject.discography.sectionTitle')}
        subtitle={t('releaseProject.discography.sectionSubtitle')}
        viewAllLabel={t('releaseProject.discography.viewAll')}
        items={discographyItems}
        variant="alternate"
        onSelectItem={loadError ? undefined : openModal}
      />

      <ReleaseReviewsSection
        title={t('releaseProject.reviews.sectionTitle')}
        subtitle={t('releaseProject.reviews.sectionSubtitle')}
        reviews={reviewsToShow}
      />

      {/* FAQ */}
      {Array.isArray(faqItems) && faqItems.length > 0 && (
        <FAQSection
          variant="alternate"
          items={faqItems}
          title={t(k('faqSectionTitle'))}
          subtitle={t(k('faqSubtitle'))}
        />
      )}

      <ReleaseConsultationSteps
        title={t('releaseProject.consultation.sectionTitle')}
        subtitle={t('releaseProject.consultation.sectionSubtitle')}
        steps={Array.isArray(consultationSteps) ? consultationSteps : []}
      />

      {/* 다른 티어 살펴보기 */}
      <Section variant="alternate">
        <SectionHeading
          icon={ArrowRightLeft}
          title={t('releaseProject.tiers.crossTier.sectionTitle')}
          subtitle={t('releaseProject.tiers.crossTier.sectionSubtitle')}
          className="mb-10"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {otherTiers.map((otherTier) => (
            <Link
              key={otherTier}
              href={getLink(`/release-project/${otherTier}`)}
              className="group glass-card rounded-2xl p-6 hover:-translate-y-0.5 transition-all duration-200"
            >
              <p className="text-xs text-primary font-medium mb-1">{t(`releaseProject.tiers.${otherTier}.duration`)}</p>
              <h3 className="typo-card-subtitle text-gray-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
                {t(`releaseProject.tiers.${otherTier}.label`)}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t(`releaseProject.tiers.${otherTier}.note`)}</p>
              <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
                {t('releaseProject.tiers.detailCta')} <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* 발매 buyer-intent 허브 정적 진입점 — 절차·유통·저작권료 정보 의도를 허브로 수렴. */}
      <HubLinkCallout
        hubSlug="indie-release-guide"
        locale={locale}
        title={t('releaseProject.hubCallout.title')}
        subtitle={t('releaseProject.hubCallout.subtitle')}
      />

      <Section variant="default">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('releaseProject.cta.titleLine1')}</span>
              <span className="block text-primary">{t('releaseProject.cta.titleHighlight')}</span>
            </>
          }
          subtitle={t('releaseProject.cta.subtitle')}
          imageSrc="/images/studio2.webp"
          imageAlt={t('releaseProject.cta.imageAlt')}
          primaryButtonLabel={t('releaseProject.cta.inquiry')}
        />
      </Section>

      <AnimatePresence>
        {selectedItem && (
          <PortfolioDetailModal
            key={selectedItem.id}
            item={selectedItem}
            categories={categories}
            onClose={closeModal}
            locale={locale}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

TierPage.displayName = 'TierPage';
