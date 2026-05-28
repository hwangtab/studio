import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, CheckCircle, Users, DollarSign, Disc,
  Target, Calendar, ListChecks, X, MessageCircle, BookOpen,
  Award, Star, Quote, ArrowRightLeft,
} from 'lucide-react';
import SEO from '../SEO';
import SectionHeading from '../ui/SectionHeading';
import ImageHero from '../common/ImageHero';
import FAQSection from '../ui/FAQSection';
import { Section } from '../ui/Section';
import { getReviews } from '../../data/reviews';
import type { Locale } from '../../lib/i18n';
import type { PortfolioItem } from '../../types/data';

const ContactCTA = dynamic(() => import('../common/ContactCTA'));

interface InProgressItem {
  artist: string;
  title: string;
  typeKey: string;
}

interface FocusItem {
  title: string;
  desc: string;
}

interface JourneyItem {
  month: string;
  label: string;
  desc: string;
}

interface CaseStudyJsonItem {
  portfolioId: string;
  headline: string;
  quote: string;
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
  inProgressItems: InProgressItem[];
}

const ALL_IN_PROGRESS: InProgressItem[] = [
  { artist: '마리코 & 유키에', title: '〈남산타워〉 정규앨범', typeKey: 'fullAlbum' },
  { artist: 'Sabbaha', title: '정규 2집', typeKey: 'fullAlbum' },
  { artist: '남자애', title: '릴레이 싱글', typeKey: 'single' },
  { artist: 'Sickbaby', title: '정규 2집', typeKey: 'fullAlbum' },
  { artist: '더블제이정', title: '미니앨범', typeKey: 'ep' },
];

const TIER_TYPE_KEYS: Record<string, string[]> = {
  single: ['single'],
  ep: ['ep', 'miniAlbum'],
  album: ['fullAlbum'],
};

const TIER_HERO_IMAGE = '/images/studio2.webp';
const ALL_TIERS: Array<'single' | 'ep' | 'album'> = ['single', 'ep', 'album'];
const REVIEW_IDS_FOR_RELEASE_PROJECT = ['review-1', 'review-3'];
const TIER_CATEGORY_MAP: Record<'single' | 'ep' | 'album', string[]> = {
  single: ['single'],
  ep: [],
  album: ['album'],
};

export const TierPage: React.FC<TierPageProps> = ({ locale, tier, portfolioItems }) => {
  const { t } = useTranslation('common', { lng: locale });
  const getLink = (path: string) => `/${locale}${path}`;
  const k = (key: string) => `releaseProject.tiers.${tier}.detail.${key}`;

  const personaItems = t(k('personaItems'), { returnObjects: true }) as string[];
  const focusItems = t(k('focusItems'), { returnObjects: true }) as FocusItem[];
  const journeyItems = t(k('journeyItems'), { returnObjects: true }) as JourneyItem[];
  const deliverablesIncluded = t(k('deliverablesIncluded'), { returnObjects: true }) as string[];
  const deliverablesExcluded = t(k('deliverablesExcluded'), { returnObjects: true }) as string[];
  const caseStudyJsonItems = t(k('caseStudyItems'), { returnObjects: true }) as CaseStudyJsonItem[];
  const faqItems = t(k('faqItems'), { returnObjects: true }) as { question: string; answer: string }[];
  const consultationSteps = t('releaseProject.consultation.steps', { returnObjects: true }) as ConsultationStep[];
  const producerStats = t('releaseProject.producer.stats', { returnObjects: true }) as ProducerStat[];

  const tierTypeKeys = TIER_TYPE_KEYS[tier] ?? [];
  const filteredInProgress = ALL_IN_PROGRESS.filter((item) => tierTypeKeys.includes(item.typeKey));
  const tierCategoryAllow = TIER_CATEGORY_MAP[tier];
  const featuredPortfolioItems = portfolioItems
    .filter((i) => i.featured && tierCategoryAllow.includes(i.category))
    .slice(0, 6);
  const otherTiers = ALL_TIERS.filter((t) => t !== tier);
  const reviewsToShow = getReviews(locale).filter((r) => REVIEW_IDS_FOR_RELEASE_PROJECT.includes(r.id));

  const inProgressTypeLabels: Record<string, string> = {
    fullAlbum: t('releaseProject.inProgress.types.fullAlbum'),
    single: t('releaseProject.inProgress.types.single'),
    ep: t('releaseProject.inProgress.types.ep'),
    miniAlbum: t('releaseProject.inProgress.types.miniAlbum'),
  };

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t(`releaseProject.seo.${tier}.title`)}
        description={t(`releaseProject.seo.${tier}.description`)}
        keywords={t(`releaseProject.seo.${tier}.keywords`)}
        canonical={`/${locale}/release-project/${tier}`}
        faqItems={Array.isArray(faqItems) ? faqItems : null}
      />

      <ImageHero
        locale={locale}
        priority
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{t(k('heroTitlePrefix'))}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {t(k('heroTitleHighlight'))}
            </span>
            <span className="text-gray-100 drop-shadow-lg"> {t(k('heroTitleSuffix'))}</span>
          </>
        }
        subtitle={t(k('heroSubtitle'))}
        backgroundImage={TIER_HERO_IMAGE}
        imageAlt={t('releaseProject.hero.imageAlt')}
        minHeight="min-h-[60svh]"
        ctaButtons={
          <>
            <Link
              href={getLink('/contact')}
              prefetch={false}
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('releaseProject.hero.ctaConsult')}
            </Link>
            <Link
              href={getLink('/release-project')}
              prefetch={false}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-primary border-2 border-primary text-white font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
            >
              <ArrowLeft size={16} />
              {t(k('linkBack'))}
            </Link>
          </>
        }
      />

      {/* 프로듀서 소개 */}
      <Section variant="alternate">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 sm:p-10 shadow-md border border-gray-100 dark:border-gray-700 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-5">
              <Award size={32} className="text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-title font-bold text-gray-900 dark:text-white mb-2">
              {t('releaseProject.producer.sectionTitle')}
            </h2>
            <p className="text-sm text-primary font-medium mb-6">
              {t('releaseProject.producer.tagline')}
            </p>
            <div className="text-left sm:text-center space-y-3 max-w-xl mx-auto mb-8">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {t('releaseProject.producer.bodyParagraph1')}
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {t('releaseProject.producer.bodyParagraph2')}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-100 dark:border-gray-700">
              {Array.isArray(producerStats) && producerStats.map((stat, i) => (
                <div key={i}>
                  <p className="text-2xl sm:text-3xl font-bold text-primary mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

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
              className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
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
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
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
          {Array.isArray(journeyItems) && journeyItems.map((item, i) => (
            <div key={i} className="flex gap-4 mb-4 last:mb-0">
              <div className="flex-shrink-0 pt-0.5 w-20 flex justify-end">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1 whitespace-nowrap">
                  {item.month}
                </span>
              </div>
              <div className={`flex-1 pb-5 ${i < journeyItems.length - 1 ? 'border-l-2 border-gray-100 dark:border-gray-700' : ''} pl-4`}>
                <p className="font-bold text-gray-900 dark:text-white mb-1">{item.label}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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

      {/* 가격 레인지 */}
      <Section variant="default">
        <SectionHeading
          icon={DollarSign}
          title={t(k('priceSectionTitle'))}
          className="mb-10"
        />
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md border border-gray-100 dark:border-gray-700 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t(k('priceRange'))}</p>
            <p className="text-sm text-primary font-medium mb-4">{t(k('priceRationale'))}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t(k('priceNote'))}</p>
          </div>
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

      {/* 케이스 스터디 */}
      {Array.isArray(caseStudyJsonItems) && caseStudyJsonItems.length > 0 && (
        <Section variant="alternate">
          <SectionHeading
            icon={BookOpen}
            title={t(k('caseStudySectionTitle'))}
            subtitle={t(k('caseStudySubtitle'))}
            className="mb-10"
          />
          <div className={`grid grid-cols-1 ${caseStudyJsonItems.length > 1 ? 'sm:grid-cols-2' : ''} gap-6 max-w-3xl mx-auto`}>
            {caseStudyJsonItems.map((csItem) => {
              const portfolioItem = portfolioItems.find((p) => p.id === csItem.portfolioId);
              return (
                <div
                  key={csItem.portfolioId}
                  className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700 flex flex-col"
                >
                  {portfolioItem?.image && (
                    <div className="aspect-square overflow-hidden relative">
                      <Image
                        src={portfolioItem.image}
                        alt={portfolioItem.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    {portfolioItem?.artist && (
                      <p className="text-xs text-primary font-medium mb-1">{portfolioItem.artist}</p>
                    )}
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{csItem.headline}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4 flex-1">{csItem.quote}</p>
                    {portfolioItem && (
                      <Link
                        href={getLink(`/portfolio/${portfolioItem.id}`)}
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline underline-offset-2 self-start"
                      >
                        {t('releaseProject.tiers.caseStudyViewDetail')} <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 고객 후기 */}
      {reviewsToShow.length > 0 && (
        <Section variant="default">
          <SectionHeading
            icon={Quote}
            title={t('releaseProject.reviews.sectionTitle')}
            subtitle={t('releaseProject.reviews.sectionSubtitle')}
            className="mb-10"
          />
          <div className={`grid grid-cols-1 ${reviewsToShow.length > 1 ? 'md:grid-cols-2' : ''} gap-5 max-w-4xl mx-auto`}>
            {reviewsToShow.map((review) => (
              <figure
                key={review.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-7 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col"
              >
                <div className="flex items-center gap-1 mb-3" aria-label={`${review.rating} / 5`}>
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4 flex-1">
                  &ldquo;{review.content}&rdquo;
                </blockquote>
                <figcaption className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{review.author}</span>
                  <span>{review.category}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {/* 지금 함께 만들고 있는 작업들 */}
      {filteredInProgress.length > 0 && (
        <Section variant="alternate">
          <SectionHeading
            icon={Disc}
            title={t(k('inProgressSectionTitle'))}
            subtitle={t('releaseProject.inProgress.sectionSubtitle')}
            className="mb-10"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {filteredInProgress.map((item) => (
              <div
                key={`${item.artist}-${item.title}`}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <span className="inline-block text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3">
                  {inProgressTypeLabels[item.typeKey] ?? item.typeKey}
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{item.artist}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8 max-w-xl mx-auto">
            {t('releaseProject.inProgress.footNote')}
          </p>
        </Section>
      )}

      {/* FAQ */}
      {Array.isArray(faqItems) && faqItems.length > 0 && (
        <FAQSection
          variant="default"
          items={faqItems}
          title={t(k('faqSectionTitle'))}
          subtitle={t(k('faqSubtitle'))}
        />
      )}

      {/* 디스코그래피 */}
      {featuredPortfolioItems.length > 0 && (
        <Section variant="alternate">
          <SectionHeading
            icon={Disc}
            title={t('releaseProject.discography.sectionTitle')}
            subtitle={t('releaseProject.discography.sectionSubtitle')}
            className="mb-10"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {featuredPortfolioItems.map((item) => (
              <Link
                key={item.id}
                href={getLink(`/portfolio/${item.id}`)}
                className="group block bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {item.image && (
                  <div className="aspect-square overflow-hidden relative">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  <p className="text-xs text-primary font-medium mb-1">{item.artist}</p>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href={getLink('/portfolio')}
              className="inline-flex items-center gap-2 text-primary font-semibold hover:underline underline-offset-2"
            >
              {t('releaseProject.discography.viewAll')} <ArrowRight size={16} />
            </Link>
          </div>
        </Section>
      )}

      {/* 상담 프로세스 */}
      {Array.isArray(consultationSteps) && consultationSteps.length > 0 && (
        <Section variant="default">
          <SectionHeading
            icon={MessageCircle}
            title={t('releaseProject.consultation.sectionTitle')}
            subtitle={t('releaseProject.consultation.sectionSubtitle')}
            className="mb-10"
          />
          <div className="max-w-xl mx-auto">
            {consultationSteps.map((step, i) => (
              <div key={i} className="flex gap-4 mb-6 last:mb-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  {step.num}
                </div>
                <div className="pt-0.5">
                  <p className="font-bold text-gray-900 dark:text-white mb-1">{step.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

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
              className="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <p className="text-xs text-primary font-medium mb-1">{t(`releaseProject.tiers.${otherTier}.duration`)}</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
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

      <Section variant="default" className="py-16">
        <ContactCTA
          locale={locale}
          title={
            <>
              {t('releaseProject.cta.titleLine1')}<br />
              <span className="text-primary">{t('releaseProject.cta.titleHighlight')}</span>
            </>
          }
          subtitle={t('releaseProject.cta.subtitle')}
          imageSrc="/images/studio2.webp"
          imageAlt={t('releaseProject.cta.imageAlt')}
          primaryButtonLabel={t('releaseProject.cta.inquiry')}
        />
      </Section>
    </div>
  );
};

TierPage.displayName = 'TierPage';
