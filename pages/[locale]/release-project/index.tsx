import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Disc, Clock, CheckCircle, ArrowRight, Lightbulb, Mic, Music, Package, Send, BookOpen } from '@/lib/lucide-icons';
import SEO from '../../../components/SEO';
import SectionHeading from '../../../components/ui/SectionHeading';
import ImageHero from '../../../components/common/ImageHero';
import FAQSection from '../../../components/ui/FAQSection';
import { Section } from '../../../components/ui/Section';
import ReleaseConsultationSteps from '../../../components/release/ReleaseConsultationSteps';
import ReleaseDiscographySection from '../../../components/release/ReleaseDiscographySection';
import ReleaseHeroCtas from '../../../components/release/ReleaseHeroCtas';
import ReleaseProducerIntro from '../../../components/release/ReleaseProducerIntro';
import ReleaseReviewsSection from '../../../components/release/ReleaseReviewsSection';
import TierComparisonTable from '../../../components/release/TierComparisonTable';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import { usePortfolioModalLazy } from '../../../hooks/usePortfolioModalLazy';
import type { Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { generateReleaseProjectSchema } from '../../../utils/schema';
import { getReviews } from '../../../data/reviews';
import { getPortfolioItems } from '../../../data/portfolio';
import { getServiceRelatedStories } from '../../../lib/serviceRelatedStories';
import type { PortfolioItem } from '../../../types/data';
import type { StoryCardData } from '../../../types/story';
import type { NextPageWithLayout } from '../../../types';

const ContactCTA = dynamic(() => import('../../../components/common/ContactCTA'));
const HubLinkCallout = dynamic(() => import('../../../components/guides/HubLinkCallout'));
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
  { artist: '마리코 & 유키에', titleKey: 'namsanTower', typeKey: 'fullAlbum' },
  { artist: 'Sabbaha', titleKey: 'fullAlbum2', typeKey: 'fullAlbum' },
  { artist: '남자애', titleKey: 'relaySingle', typeKey: 'single' },
  { artist: 'Sickbaby', titleKey: 'fullAlbum2', typeKey: 'fullAlbum' },
  { artist: '더블제이정', titleKey: 'miniAlbum', typeKey: 'ep' },
];

const ReleaseProject: NextPageWithLayout<ReleaseProjectProps> = ({ locale, portfolioItems, spotlightItems, relatedStories, asOf }) => {
  const { t } = useTranslation('common', { lng: locale });
  const getLink = (path: string) => `/${locale}${path}`;
  const siteConfig = getSiteConfig(locale);
  const reviewsToShow = getReviews(locale).filter((r) => ['review-1', 'review-3'].includes(r.id));
  const consultationSteps = t('releaseProject.consultation.steps', { returnObjects: true }) as { num: string; title: string; desc: string }[];
  const scopeItems = t('releaseProject.scope.items', { returnObjects: true }) as string[];
  const producerStats = t('releaseProject.producer.stats', { returnObjects: true }) as Array<{ value: string; label: string }>;
  const hubFaqItems = t('releaseProject.hubFaq.items', { returnObjects: true }) as { question: string; answer: string }[];
  const { selectedItem, categories, open: openModal, close: closeModal, loadError } = usePortfolioModalLazy(
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
        // 이미지 사이트맵(pageImageMap)과 동일 대표 이미지로 소셜 카드·이미지 검색 신호 일치.
        ogImage="/images/og-recording15.webp"
        ogImageAlt={t('releaseProject.hero.imageAlt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        webPageType="ItemPage"
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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[var(--hero-title-accent)] to-white drop-shadow-[0_0_25px_var(--hero-title-glow)]">
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
          <ReleaseHeroCtas
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            consultLabel={t('releaseProject.hero.ctaConsult')}
            secondaryHref={getLink('/portfolio')}
            secondaryLabel={t('releaseProject.hero.ctaPortfolio')}
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
              className="glass-card rounded-2xl p-8 flex flex-col"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t(`releaseProject.tiers.${key}.label`)}</h3>
              <div className="flex items-center gap-1.5 text-primary dark:text-primary-lighter mb-4">
                <Clock size={14} className="flex-shrink-0" />
                <span className="text-sm font-medium">{t(`releaseProject.tiers.${key}.duration`)}</span>
              </div>
              <p className="text-base text-gray-700 dark:text-gray-200 font-semibold mb-2">{t(`releaseProject.tiers.${key}.range`)}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">{t(`releaseProject.tiers.${key}.note`)}</p>
              <Link
                href={getLink(`/release-project/${key}`)}
                className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-lighter hover:text-primary-dark dark:hover:text-white hover:underline underline-offset-2 transition-colors"
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
          <Link href={getLink('/pricing')} className="text-primary dark:text-primary-lighter underline underline-offset-2 hover:text-primary-dark dark:hover:text-white">
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
              className="flex items-start gap-3 glass-card rounded-xl p-5"
            >
              <CheckCircle size={20} className="text-primary dark:text-primary-lighter flex-shrink-0 mt-0.5" />
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
                    <Icon size={18} className="text-primary dark:text-primary-lighter" />
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
              key={`${item.artist}-${item.titleKey}`}
              className="glass-card rounded-xl p-5"
            >
              <span className="inline-block text-xs font-medium text-primary dark:text-primary-lighter bg-primary/10 rounded-full px-2.5 py-0.5 mb-3">
                {t(`releaseProject.inProgress.types.${item.typeKey}`)}
              </span>
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{item.artist}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t(`releaseProject.inProgress.items.${item.titleKey}`)}</p>
            </div>
          ))}
        </div>
      </Section>

      <ReleaseDiscographySection
        locale={locale}
        title={t('releaseProject.discography.sectionTitle')}
        subtitle={t('releaseProject.discography.sectionSubtitle')}
        viewAllLabel={t('releaseProject.discography.viewAll')}
        items={portfolioItems.filter((item) => item.featured)}
        onSelectItem={loadError ? undefined : openModal}
      />

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
                  // 데이터 로드 실패 시 모달 대신 링크 기본 동작(실제 상세 페이지 이동)으로 폴백.
                  if (loadError) return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as React.MouseEvent).button === 1) return;
                  e.preventDefault();
                  openModal(item.id);
                }}
                className="group block glass-card rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                aria-haspopup={loadError ? undefined : 'dialog'}
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
                  <p className="text-xs text-primary dark:text-primary-lighter font-medium mb-1">{item.artist}</p>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary dark:group-hover:text-primary-lighter transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4 flex-1 line-clamp-6">
                    {item.noteExcerpt}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs text-primary dark:text-primary-lighter font-medium self-start mt-auto">
                    {t('releaseProject.spotlight.viewFull')} <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <ReleaseReviewsSection
        title={t('releaseProject.reviews.sectionTitle')}
        subtitle={t('releaseProject.reviews.sectionSubtitle')}
        reviews={reviewsToShow}
      />

      {/* 발매 가이드 — proof 다음 reference 학습 자료 */}
      {/* 발매 buyer-intent 허브로의 정적 진입점 — 이게 없으면 허브 유입이 스토리 본문
          자동링크뿐이라 가장 관련 깊은 플래그십 페이지에서 고아가 된다. */}
      <HubLinkCallout
        hubSlug="indie-release-guide"
        locale={locale}
        title={t('releaseProject.hubCallout.title')}
        subtitle={t('releaseProject.hubCallout.subtitle')}
      />

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

      <ReleaseConsultationSteps
        title={t('releaseProject.consultation.sectionTitle')}
        subtitle={t('releaseProject.consultation.sectionSubtitle')}
        steps={Array.isArray(consultationSteps) ? consultationSteps : []}
      />

      {/* 전환 CTA */}
      <Section variant="alternate">
        <ContactCTA
          locale={locale}
          title={
            <>
              <span className="block">{t('releaseProject.cta.titleLine1')}</span>
              <span className="block text-primary dark:text-primary-lighter">{t('releaseProject.cta.titleHighlight')}</span>
            </>
          }
          subtitle={t('releaseProject.cta.subtitle')}
          imageSrc="/images/studio2.webp"
          imageAlt={t('releaseProject.cta.imageAlt')}
          primaryButtonLabel={t('releaseProject.cta.inquiry')}
          // 기본 secondary 라벨은 '위치'인데 실제 목적지는 /contact 문의 폼이라
          // 라벨-목적지가 어긋난다. 문의 라벨로 명시 덮어쓴다.
          secondaryButtonLabel={t('actions.contact')}
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
    { revalidate: 86400, i18nSections: ['releaseProject', 'portfolio', 'stories'] }
  );
};

export default ReleaseProject;
