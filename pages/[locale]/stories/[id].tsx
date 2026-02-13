import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { ArrowLeft, Calendar, Tag, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import StoryCard from '../../../components/StoryCard';
import ImageHero from '../../../components/common/ImageHero';
import StoryCTA, { CTAType } from '../../../components/StoryCTA';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { shareContent } from '../../../utils/shareUtils';
import { stripMarkdown } from '../../../utils/textUtils';
import { timeAgo } from '../../../utils/dateUtils';
import { getRelatedStories, getStoryDetail, getStoryPaths } from '../../../lib/stories';
import type { Story, StoryDetail } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import { getI18nStaticProps } from '../../../lib/getStatic';
import { defaultLocale, type Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { useIsIOSSafari } from '../../../utils/deviceUtils';
import { createEnterAnimation } from '../../../utils/animationUtils';

interface StoryDetailPageProps {
  locale: Locale;
  story: StoryDetail;
  relatedStories: Story[];
}

const STORY_BODY_ANIMATION = createEnterAnimation();

const StoryDetailPage: NextPage<StoryDetailPageProps> = ({ locale, story, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const isIOSSafari = useIsIOSSafari();
  const getCTAType = (slug: string, categoryKey: string | undefined): CTAType => {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
      hash = (hash << 5) - hash + slug.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash % 100) / 100;

    if (categoryKey === 'lesson') {
      if (seed < 0.4) return 'lesson';
      if (seed < 0.7) return 'practice';
      if (seed < 0.9) return 'recording';
      return 'production';
    }

    if (categoryKey === 'equipment' || categoryKey === 'review') {
      if (seed < 0.6) return 'practice';
      if (seed < 0.8) return 'recording';
      return 'lesson';
    }

    const types: CTAType[] = ['recording', 'lesson', 'practice', 'production'];
    return types[Math.floor(seed * types.length)];
  };

  const ctaType = React.useMemo(
    () => getCTAType(story.slug, story.categoryKey),
    [story.categoryKey, story.slug]
  );

  const router = useRouter();
  const storyCardLabels = React.useMemo(
    () => ({
      defaultCategory: t('stories.list.defaultCategory'),
      noDate: t('stories.list.noDate'),
      noTitle: t('stories.list.noTitle'),
      noContent: t('stories.list.noContent'),
      categoryByKey: {
        notice: t('stories.categories.notice'),
        event: t('stories.categories.event'),
        lesson: t('stories.categories.lesson'),
        interview: t('stories.categories.interview'),
        equipment: t('stories.categories.equipment'),
        review: t('stories.categories.review'),
        other: t('stories.categories.other'),
      },
    }),
    [t]
  );

  if (router.isFallback) {
    return <LoadingSpinner locale={locale} />;
  }

  const getLink = (path: string) => `/${locale}${path}`;
  const metaDescription = stripMarkdown(story.content || '').substring(0, 160);

  const shareStory = async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';
    const shareUrl = `${siteUrl}/${locale}/stories/${story.slug}`;
    await shareContent({
      title: story.title,
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
        title={`${story.title} - ${siteConfig.name}`}
        description={story.summary || metaDescription}
        keywords={story.tags ? story.tags.join(', ') : t('stories.seo.fallbackKeywords')}
        canonical={story.isFallbackTranslation ? `/${story.sourceLocale}/stories/${story.slug}` : undefined}
        ogImage={story.thumbnail || '/images/hardware2.jpg'}
        ogType="article"
        robots={story.isFallbackTranslation ? 'noindex, follow' : 'index, follow'}
        articlePublishedTime={story.date}
        articleAuthor={story.author}
        includeSchema
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: story.title, path: `/${locale}/stories/${story.slug}` },
        ]}
      />

      <ImageHero
        locale={locale}
        title={story.title}
        subtitle={
          <div className="flex flex-wrap items-center justify-center gap-4 text-lg mt-4 opacity-90">
            <div className="flex items-center">
              <Tag className="mr-2" size={18} aria-hidden="true" />
              <span>{story.category}</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center">
              <Calendar className="mr-2" size={18} aria-hidden="true" />
              <span>{story.createdAt ? timeAgo(story.createdAt, locale) : story.date}</span>
            </div>
          </div>
        }
        backgroundImage={story.thumbnail || '/images/studio1.jpg'}
        imageAlt={story.title}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/70 via-black/40 to-black/70"
      />

      <Section variant="default" className="pt-12 pb-12">
        <div className="mb-12 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-6">
          <Link
            href={getLink("/stories")}
            className="inline-flex items-center typo-card-cta hover:underline min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <ArrowLeft className="mr-2" size={16} aria-hidden="true" />
            {t('stories.detail.backToList')}
          </Link>

          <button
            type="button"
            onClick={shareStory}
            className="inline-flex items-center typo-card-cta hover:underline text-gray-600 dark:text-gray-400 min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <Share2 className="mr-2" size={16} aria-hidden="true" />
            {t('stories.detail.share')}
          </button>
        </div>

        <m.div
          {...STORY_BODY_ANIMATION}
          className="mb-12"
        >
          <MarkdownRenderer content={story.content} locale={locale} />
        </m.div>

        <StoryCTA type={ctaType} locale={locale} />

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="typo-card-title mb-6">{t('stories.detail.moreTitle')}</h2>
          {relatedStories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {relatedStories.map((related) => (
                <StoryCard
                  key={related.slug}
                  story={related}
                  locale={locale}
                  disableEffects={isIOSSafari}
                  labels={storyCardLabels}
                />
              ))}
            </div>
          ) : (
            <p className="typo-card-body text-gray-500 mb-6">{t('stories.detail.noRelated')}</p>
          )}
          <Link href={getLink("/stories")} className="inline-flex items-center typo-card-cta hover:underline min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900">
            <ArrowLeft className="mr-2" size={16} aria-hidden="true" />
            {t('stories.detail.viewAll')}
          </Link>
        </div>
      </Section>
    </>
  );
};

(StoryDetailPage as NextPage & { hasHero?: boolean }).hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const preRenderedPaths = getStoryPaths().filter(
    (path) => path.params.locale === defaultLocale
  );

  return {
    paths: preRenderedPaths,
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = params?.locale || 'ko';
  try {
    const story = await getStoryDetail(params!.id as string, locale as string);
    const relatedStories = getRelatedStories(locale as string, params!.id as string, 3);

    return {
      props: {
        ...getI18nStaticProps(locale),
        story,
        relatedStories,
      },
      revalidate: 3600,
    };
  } catch (error) {
    console.error('Story detail error:', error);
    return {
      notFound: true,
    };
  }
};

export default StoryDetailPage;
