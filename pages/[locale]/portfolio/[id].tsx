import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { ArrowLeft, Share2 } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import PortfolioDetailContent from '../../../components/portfolio/PortfolioDetailContent';
import { getPortfolioItems, getCategories } from '../../../data/portfolio';
import { getPortfolioRelatedStories } from '../../../lib/portfolioRelatedStories';
import type { PortfolioItem, PortfolioCategory } from '../../../types/data';
import type { StoryCardData } from '../../../types/story';

const RelatedStoriesSection = dynamic(() => import('../../../components/ui/RelatedStoriesSection'));
import { shareContent } from '../../../utils/shareUtils';
import { getCategoryInfo } from '../../../utils/portfolioDataUtils';
import { generateMusicRecordingSchema } from '../../../utils/schema';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { Section } from '../../../components/ui/Section';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { defaultLocale, locales, type Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { createEnterAnimation } from '../../../utils/animationUtils';
import Breadcrumb from '../../../components/ui/Breadcrumb';


interface PortfolioDetailPageProps {
  locale: Locale;
  item: PortfolioItem;
  categories: PortfolioCategory[];
  relatedStories: StoryCardData[];
}

const DETAIL_CONTENT_ANIMATION = createEnterAnimation();

function getImageDimensions(imageUrl: string): { width: number; height: number } {
  // bugsm.co.kr: /images/SIZE/ in path
  const bugsmMatch = imageUrl.match(/\/images\/(\d+)\//);
  if (bugsmMatch) {
    const size = parseInt(bugsmMatch[1], 10);
    return { width: size, height: size };
  }
  // mzstatic.com / similar CDNs: WIDTHxHEIGHT in filename
  const dimMatch = imageUrl.match(/\/(\d+)x(\d+)[a-z]+-?[\d]*\.\w+$/);
  if (dimMatch) {
    return { width: parseInt(dimMatch[1], 10), height: parseInt(dimMatch[2], 10) };
  }
  // default: square album art
  return { width: 1000, height: 1000 };
}

const PortfolioDetailPage: NextPage<PortfolioDetailPageProps> = ({ locale, item, categories, relatedStories }) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });

  const siteConfig = getSiteConfig(locale);

  const getLink = (path: string) => `/${locale}${path}`;

  if (router.isFallback) {
    return <LoadingSpinner locale={locale} />;
  }

  const metaDescription = t('portfolio.detail.metaDescription', {
    artist: item.artist,
    title: item.title,
    description: item.description,
  });

  // Locale availability + fallback chain.
  // availableLocales: only locales with native productionNotes get hreflang pointers.
  // notesForLocale: show English/Korean content when this locale lacks native copy,
  //   but flag the page so we can apply noindex — same pattern as stories fallback.
  const availableLocales = (Object.keys(item.productionNotes ?? {}) as Locale[])
    .filter((l) => locales.includes(l));
  const hasNativeNotes = Boolean(item.productionNotes?.[locale]);
  const notesForLocale =
    item.productionNotes?.[locale]
    ?? item.productionNotes?.en
    ?? item.productionNotes?.ko;
  const isFallbackTranslation = Boolean(notesForLocale) && !hasNativeNotes;
  const isThinPortfolio = !notesForLocale;
  const shouldNoindex = isThinPortfolio || isFallbackTranslation;

  // Build a locale-resolved item so PortfolioDetailBody and MusicRecording schema
  // render fallback content without mutating the original data object.
  const resolvedItem: PortfolioItem = notesForLocale && !hasNativeNotes
    ? { ...item, productionNotes: { ...item.productionNotes, [locale]: notesForLocale } }
    : item;

  const ogImageDimensions = getImageDimensions(item.image);

  const categoryInfo = getCategoryInfo(item.category, categories);
  const schemaImage = item.image.startsWith('http') ? item.image : `${siteConfig.url}${item.image}`;
  const portfolioSchema = generateMusicRecordingSchema(
    {
      title: resolvedItem.title,
      artist: resolvedItem.artist,
      image: schemaImage,
      url: `${siteConfig.url}/${locale}/portfolio/${resolvedItem.id}`,
      genre: categoryInfo.name,
      // Pass production metadata for richer schema (only when available)
      ...(resolvedItem.productionNotes && { productionNotes: resolvedItem.productionNotes }),
      ...(resolvedItem.credits && { credits: resolvedItem.credits }),
      ...(resolvedItem.releaseDate && { datePublished: resolvedItem.releaseDate }),
      ...(resolvedItem.label && { label: resolvedItem.label }),
      ...(resolvedItem.trackList && { trackList: resolvedItem.trackList }),
    },
    siteConfig.url,
    locale
  );
  const detailContentAnimation = DETAIL_CONTENT_ANIMATION;

  const sharePortfolio = async () => {
    const shareUrl = `${siteConfig.url}/${locale}/portfolio/${item.id}`;
    await shareContent({
      title: `${item.title} - ${t('portfolio.detail.titleSuffix')}`,
      text: metaDescription,
      url: shareUrl,
      messages: {
        copied: t('actions.shareCopied'),
        unsupported: t('actions.shareUnsupported'),
      },
    });
  };

  return (
    <>
      <SEO
        locale={locale}
        title={`${item.title} - ${t('portfolio.detail.titleSuffix')}`}
        description={metaDescription}
        canonical={isFallbackTranslation ? `/ko/portfolio/${item.id}` : `/${locale}/portfolio/${item.id}`}
        disableUrlMetaAndAlternates={isFallbackTranslation}
        availableLocales={availableLocales.length > 0 ? availableLocales : undefined}
        ogImage={item.image}
        ogImageAlt={`${item.title} - ${item.artist}`}
        ogImageWidth={ogImageDimensions.width}
        ogImageHeight={ogImageDimensions.height}
        ogType="music.album"
        includeSchema
        schema={portfolioSchema}
        keywords={`${item.artist}, ${item.title}, ${item.services.join(', ')}, ${siteConfig.name}`}
        {...(shouldNoindex && { robots: 'noindex, follow' })}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
          { name: item.title, path: `/${locale}/portfolio/${item.id}` },
        ]}
      />
      <Breadcrumb
        items={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
          { name: item.title, path: `/${locale}/portfolio/${item.id}` },
        ]}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-100 dark:border-gray-800"
      />
      <Section variant="alternate" className="pt-8 pb-12">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push(getLink('/portfolio'));
              }
            }}
            className="inline-flex items-center typo-card-cta hover:underline mb-6 min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <ArrowLeft className="mr-2" size={16} aria-hidden="true" />
            {t('portfolio.detail.backToList')}
          </button>
        </div>

        <m.div {...detailContentAnimation}>
          <PortfolioDetailContent
            item={resolvedItem}
            categories={categories}
            locale={locale}
            titleTag="h1"
            imageSectionClassName="px-6 pt-8"
            imageWrapperClassName="relative aspect-square max-w-md mx-auto rounded-xl overflow-hidden shadow-lg"
            contentSectionClassName="p-8"
            titleClassName="text-heading-2 font-title mb-2"
            artistClassName="typo-card-body mb-6"
            servicesHeadingClassName="typo-card-title mb-3"
            primaryActionClassName="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
            summaryActions={
              <button
                type="button"
                onClick={sharePortfolio}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-lg transition-colors font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
              >
                <Share2 size={16} aria-hidden="true" />
                {t('portfolio.detail.share')}
              </button>
            }
          />
        </m.div>
      </Section>
      <RelatedStoriesSection
        stories={relatedStories}
        locale={locale}
        title={t('portfolio.detail.relatedStoriesTitle', { defaultValue: '이런 작업은 어떻게 만들어졌을까요' })}
        subtitle={t('portfolio.detail.relatedStoriesSubtitle', { defaultValue: '실제 녹음·믹싱·프로덕션 과정에서 사용하는 기법을 가이드로 정리했습니다.' })}
      />

      <Section variant="alternate" className="py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-body mb-6 text-gray-600 dark:text-gray-300">{t('portfolio.detail.ctaPrompt', '당신의 음악도 완성해 드립니다.')}</p>
          {/* prefetch={false}: 본문 fold 내 button CTA들의 무거운 SSG JSON
              자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={getLink('/pricing')} prefetch={false} className="inline-flex items-center px-6 py-3 min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors">
              {t('nav.pricing')}
            </Link>
            <Link href={getLink('/contact')} prefetch={false} className="inline-flex items-center px-6 py-3 min-h-[44px] border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-lg font-medium transition-colors">
              {t('nav.contact')}
            </Link>
            <Link href={getLink('/studio-info')} prefetch={false} className="inline-flex items-center px-6 py-3 min-h-[44px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary rounded-lg font-medium transition-colors">
              {t('nav.equipment')}
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: { params: { locale: string; id: string } }[] = [];
  const items = getPortfolioItems(defaultLocale);
  items.forEach((item) => {
    locales.forEach((locale) => {
      paths.push({ params: { locale, id: item.id } });
    });
  });

  return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const portfolioItems = getPortfolioItems(locale);
  const item = portfolioItems.find((p) => p.id === params?.id);
  const categories = getCategories(locale);

  if (!item) {
    return { notFound: true, revalidate: 3600 };
  }

  const relatedStories = getPortfolioRelatedStories(item.id, locale, 6);

  return buildPageStaticProps(
    locale,
    {
      item,
      categories,
      relatedStories,
    },
    { revalidate: 3600, i18nSections: ['portfolio', 'stories'] }
  );
};

export default PortfolioDetailPage;
