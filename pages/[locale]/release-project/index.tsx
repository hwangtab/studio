import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Disc, Clock, CheckCircle, ArrowRight, Lightbulb, Mic, Music, Package, Send, Award, BookOpen, Quote, MessageCircle, Star } from '@/lib/lucide-icons';
import SEO from '../../../components/SEO';
import SectionHeading from '../../../components/ui/SectionHeading';
import ImageHero from '../../../components/common/ImageHero';
import FAQSection from '../../../components/ui/FAQSection';
import { Section } from '../../../components/ui/Section';
import TierComparisonTable from '../../../components/release/TierComparisonTable';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import { usePortfolioModalLazy } from '../../../hooks/usePortfolioModalLazy';
import type { Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { generateReleaseProjectSchema } from '../../../utils/schemaGenerator';
import { getReviews } from '../../../data/reviews';
import { getPortfolioItems } from '../../../data/portfolio';
import { getServiceRelatedStories } from '../../../lib/serviceRelatedStories';
import type { PortfolioItem } from '../../../types/data';
import type { StoryCardData } from '../../../types/story';
import type { NextPageWithLayout } from '../../../types';

const ContactCTA = dynamic(() => import('../../../components/common/ContactCTA'));
const PortfolioDetailModal = dynamic(() => import('../../../components/PortfolioDetailModal'), { ssr: false });
const RelatedStoriesSection = dynamic(() => import('../../../components/ui/RelatedStoriesSection'));

interface SpotlightItem {
  id: string;
  artist: string;
  title: string;
  image: string;
  noteExcerpt: string;
}

interface ReleaseProjectProps {
  locale: Locale;
  portfolioItems: Pick<PortfolioItem, 'id' | 'title' | 'description' | 'image' | 'artist' | 'featured'>[];
  spotlightItems: SpotlightItem[];
  relatedStories: StoryCardData[];
  asOf: string;
}

const TIER_KEYS = ['single', 'ep', 'album'] as const;

const PROCESS_ICONS = [
  { step: '01', icon: Lightbulb },
  { step: '02', icon: Mic },
  { step: '03', icon: Music },
  { step: '04', icon: Package },
  { step: '05', icon: Send },
];

const IN_PROGRESS_ITEMS = [
  { artist: '마리코 & 유키에', title: '〈남산타워〉 정규앨범', typeKey: 'fullAlbum' },
  { artist: 'Sabbaha', title: '정규 2집', typeKey: 'fullAlbum' },
  { artist: '남자애', title: '릴레이 싱글', typeKey: 'single' },
  { artist: 'Sickbaby', title: '정규 2집', typeKey: 'fullAlbum' },
  { artist: '더블제이정', title: '미니앨범', typeKey: 'ep' },
];

const ReleaseProject: NextPageWithLayout<ReleaseProjectProps> = ({ locale, portfolioItems, spotlightItems, relatedStories, asOf }) => {
  const { t } = useTranslation('common', { lng: locale });
  const getLink = (path: string) => `/${locale}${path}`;
  const isKorean = locale === 'ko';
  const siteConfig = getSiteConfig(locale);
  const reviewsToShow = getReviews(locale).filter((r) => ['review-1', 'review-3'].includes(r.id));
  const consultationSteps = t('releaseProject.consultation.steps', { returnObjects: true }) as { num: string; title: string; desc: string }[];
  const scopeItems = t('releaseProject.scope.items', { returnObjects: true }) as string[];
  const producerStats = t('releaseProject.producer.stats', { returnObjects: true }) as Array<{ value: string; label: string }>;
  const hubFaqItems = t('releaseProject.hubFaq.items', { returnObjects: true }) as { question: string; answer: string }[];
  const { selectedItem, categories, open: openModal, close: closeModal } = usePortfolioModalLazy(
    locale,
    `/${locale}/release-project`
  );

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t('releaseProject.seo.title')}
        description={t('releaseProject.seo.description')}
        keywords={t('releaseProject.seo.keywords')}
        canonical={`/${locale}/release-project`}
        faqItems={Array.isArray(hubFaqItems) ? hubFaqItems : null}
        includeSchema
        schema={generateReleaseProjectSchema(siteConfig.url, locale)}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.releaseProject'), path: `/${locale}/release-project` },
        ]}
      />

      <ImageHero
        locale={locale}
        priority
        title={
          <>
            <span className="block mb-2 text-gray-100 drop-shadow-lg">{t('releaseProject.hero.titlePrefix')}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#a8c0ff] to-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              {t('releaseProject.hero.titleHighlight')}
            </span>
            <span className="text-gray-100 drop-shadow-lg">{t('releaseProject.hero.titleSuffix')}</span>
          </>
        }
        subtitle={t('releaseProject.hero.subtitle')}
        backgroundImage="/images/studio3.webp"
        imageAlt={t('releaseProject.hero.imageAlt')}
        minHeight="min-h-[70svh]"
        ctaButtons={
          <>
            {isKorean ? (
              <a
                href={siteConfig.contact.kakaoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t('releaseProject.hero.ctaConsult')}
              </a>
            ) : (
              <Link
                href={getLink('/contact')}
                prefetch={false}
                className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-white text-primary-dark font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-gray-100 transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {t('releaseProject.hero.ctaConsult')}
              </Link>
            )}
            <Link
              href={getLink('/portfolio')}
              prefetch={false}
              className="inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[48px] bg-primary border-2 border-primary text-white font-bold text-base sm:text-lg py-4 px-10 rounded-full hover:bg-primary-dark hover:border-primary-dark transition-transform transition-shadow transition-colors duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
            >
              {t('releaseProject.hero.ctaPortfolio')}
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

      {/* 발매 프로젝트 3형태 */}
      <Section variant="default">
        <SectionHeading
          icon={Disc}
          title={t('releaseProject.tiers.sectionTitle')}
          subtitle={t('releaseProject.tiers.sectionSubtitle')}
          className="mb-12"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TIER_KEYS.map((key) => (
            <div
              key={key}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md border border-gray-100 dark:border-gray-700 flex flex-col"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t(`releaseProject.tiers.${key}.label`)}</h3>
              <div className="flex items-center gap-1.5 text-primary mb-4">
                <Clock size={14} className="flex-shrink-0" />
                <span className="text-sm font-medium">{t(`releaseProject.tiers.${key}.duration`)}</span>
              </div>
              <p className="text-base text-gray-700 dark:text-gray-200 font-semibold mb-2">{t(`releaseProject.tiers.${key}.range`)}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">{t(`releaseProject.tiers.${key}.note`)}</p>
              <Link
                href={getLink(`/release-project/${key}`)}
                className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark hover:underline underline-offset-2 transition-colors"
              >
                {t('releaseProject.tiers.detailCta')} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8 max-w-2xl mx-auto">
          {t('releaseProject.tiers.footNotePre')}{' '}
          <strong>{t('releaseProject.tiers.footNoteHighlight')}</strong>{' '}
          {t('releaseProject.tiers.footNoteMid')}{' '}
          <Link href={getLink('/pricing')} className="text-primary underline underline-offset-2 hover:text-primary-dark">
            {t('releaseProject.tiers.footNotePricingLabel')}
          </Link>
          {t('releaseProject.tiers.footNotePost')}
        </p>

        {/* M1: 3티어 비교표 — 결정 보조 */}
        <div className="mt-16">
          <SectionHeading
            title={t('releaseProject.tiers.comparisonTable.sectionTitle')}
            subtitle={t('releaseProject.tiers.comparisonTable.sectionSubtitle')}
            className="mb-8"
          />
          <TierComparisonTable locale={locale} />
        </div>
      </Section>

      {/* 프로듀서 황경하가 함께하는 것들 */}
      <Section variant="alternate">
        <SectionHeading
          icon={CheckCircle}
          title={t('releaseProject.scope.sectionTitle')}
          subtitle={t('releaseProject.scope.sectionSubtitle')}
          className="mb-12"
        />
        <div className="max-w-3xl mx-auto space-y-3">
          {Array.isArray(scopeItems) && scopeItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <CheckCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">{item}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8 max-w-xl mx-auto">
          {t('releaseProject.scope.footNote')}
        </p>
      </Section>

      {/* 프로듀싱 프로세스 5단계 */}
      <Section variant="default">
        <SectionHeading
          icon={Disc}
          title={t('releaseProject.process.sectionTitle')}
          subtitle={t('releaseProject.process.sectionSubtitle')}
          className="mb-12"
        />
        <div className="max-w-2xl mx-auto">
          {PROCESS_ICONS.map((s, i) => {
            const Icon = s.icon;
            const isLast = i === PROCESS_ICONS.length - 1;
            return (
              <div key={s.step} className="flex gap-5">
                <div className="flex-shrink-0 flex flex-col items-center self-stretch">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1.5" />
                  )}
                </div>
                <div className={`flex-1 pt-1.5 ${!isLast ? 'pb-6' : ''}`}>
                  <p className="text-xs font-mono text-primary/60 mb-1 tracking-wide">{s.step}</p>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{t(`releaseProject.process.steps.${i}.title`)}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{t(`releaseProject.process.steps.${i}.desc`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 지금 함께 만들고 있는 음반들 */}
      <Section variant="alternate">
        <SectionHeading
          icon={Disc}
          title={t('releaseProject.inProgress.sectionTitle')}
          subtitle={t('releaseProject.inProgress.sectionSubtitle')}
          className="mb-3"
        />
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-10">
          {t('releaseProject.inProgress.asOf', { date: asOf })}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {IN_PROGRESS_ITEMS.map((item) => (
            <div
              key={`${item.artist}-${item.title}`}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <span className="inline-block text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3">
                {t(`releaseProject.inProgress.types.${item.typeKey}`)}
              </span>
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{item.artist}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 발매 디스코그래피 증거 */}
      {portfolioItems.length > 0 && (
        <Section variant="default">
          <SectionHeading
            icon={Disc}
            title={t('releaseProject.discography.sectionTitle')}
            subtitle={t('releaseProject.discography.sectionSubtitle')}
            className="mb-12"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {portfolioItems.filter((i) => i.featured).slice(0, 12).map((item) => (
              <Link
                key={item.id}
                href={getLink(`/portfolio/${item.id}`)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as React.MouseEvent).button === 1) return;
                  e.preventDefault();
                  openModal(item.id);
                }}
                className="group block bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                aria-haspopup="dialog"
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

      {/* 최근 작업 노트 spotlight — 검증된 productionNotes 3건 */}
      {spotlightItems.length > 0 && (
        <Section variant="alternate">
          <SectionHeading
            icon={BookOpen}
            title={t('releaseProject.spotlight.sectionTitle')}
            subtitle={t('releaseProject.spotlight.sectionSubtitle')}
            className="mb-12"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {spotlightItems.map((item) => (
              <Link
                key={item.id}
                href={getLink(`/portfolio/${item.id}`)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as React.MouseEvent).button === 1) return;
                  e.preventDefault();
                  openModal(item.id);
                }}
                className="group block bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                aria-haspopup="dialog"
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
                <div className="p-6 flex flex-col flex-1">
                  <p className="text-xs text-primary font-medium mb-1">{item.artist}</p>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4 flex-1 line-clamp-6">
                    {item.noteExcerpt}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-medium self-start mt-auto">
                    {t('releaseProject.spotlight.viewFull')} <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* 함께한 아티스트들의 후기 — proof block 연속 (Spotlight 직후) */}
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

      {/* 발매 가이드 — proof 다음 reference 학습 자료 */}
      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('releaseProject.relatedStories.sectionTitle')}
        subtitle={t('releaseProject.relatedStories.sectionSubtitle')}
      />

      {/* 자주 묻는 질문 */}
      {Array.isArray(hubFaqItems) && hubFaqItems.length > 0 && (
        <FAQSection
          variant="alternate"
          items={hubFaqItems}
          title={t('releaseProject.hubFaq.sectionTitle')}
          subtitle={t('releaseProject.hubFaq.sectionSubtitle')}
        />
      )}

      {/* 상담 프로세스 4단계 (H4: 최종 CTA 직전 약속 명료화) */}
      {Array.isArray(consultationSteps) && consultationSteps.length > 0 && (
        <Section variant="default">
          <SectionHeading
            icon={MessageCircle}
            title={t('releaseProject.consultation.sectionTitle')}
            subtitle={t('releaseProject.consultation.sectionSubtitle')}
            className="mb-10"
          />
          <div className="max-w-xl mx-auto">
            {consultationSteps.map((step, i) => {
              const isLast = i === consultationSteps.length - 1;
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 flex flex-col items-center self-stretch">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {step.num}
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1.5" />
                    )}
                  </div>
                  <div className={`flex-1 pt-1 ${!isLast ? 'pb-6' : ''}`}>
                    <p className="font-bold text-gray-900 dark:text-white mb-1">{step.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 전환 CTA */}
      <Section variant="alternate" className="py-16">
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

ReleaseProject.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<ReleaseProjectProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const allItems = getPortfolioItems(locale);
  const portfolioItems = allItems
    .filter((item) => item.featured)
    .map(({ id, title, description, image, artist, featured }) => ({
      id, title, description, image, artist, featured,
    }));

  // spotlight 후보 (productionNotes + releaseDate, 본인 작품 제외, 최신순 6개)
  const SPOTLIGHT_EXCLUDE_IDS = ['hwang-gyeong-ha-nunnokeut'];
  const spotlightItems: SpotlightItem[] = allItems
    .filter((i) => i.productionNotes && Object.keys(i.productionNotes).length > 0)
    .filter((i) => i.releaseDate)
    .filter((i) => !SPOTLIGHT_EXCLUDE_IDS.includes(i.id))
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
    .slice(0, 6)
    .map((item) => {
      const note = item.productionNotes?.[locale] ?? item.productionNotes?.en ?? item.productionNotes?.ko ?? '';
      const noteExcerpt = note.split('\n\n')[0] ?? '';
      return {
        id: item.id,
        artist: item.artist,
        title: item.title,
        image: item.image,
        noteExcerpt,
      };
    })
    .filter((i) => i.noteExcerpt.length > 0);

  const relatedStories = getServiceRelatedStories('release-project', locale);

  const now = new Date();
  const asOf = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  return buildPageStaticProps(
    locale,
    { locale, portfolioItems, spotlightItems, relatedStories, asOf },
    { revalidate: 86400, i18nSections: ['releaseProject', 'portfolio'] }
  );
};

export default ReleaseProject;
