import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, Tag, Share2 } from 'lucide-react';
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
import { extractHowToSteps, getRelatedStories, getStoryDetail, getStoryPaths } from '../../../lib/stories';
import { getStoryRedirectTarget } from '../../../lib/storyRedirects';
import { STORY_CATEGORY_KEYS, type StoryDetail, type StoryListItem } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { type Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { generateFaqSchema, generateHowToSchema } from '../../../utils/schemaGenerator';
import TableOfContents from '../../../components/stories/TableOfContents';

import { createEnterAnimation } from '../../../utils/animationUtils';
import type { NextPageWithLayout } from '../../../types';

interface StoryDetailPageProps {
  locale: Locale;
  story: StoryDetail;
  relatedStories: StoryListItem[];
  howToSchema: Record<string, unknown> | null;
}

const STORY_BODY_ANIMATION = createEnterAnimation();

const StoryDetailPage: NextPageWithLayout<StoryDetailPageProps> = ({ locale, story, relatedStories, howToSchema }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);

  const getCTAType = (slug: string, categoryKey: string | undefined): CTAType => {
    if (slug.startsWith('practice-room-')) return 'practice';

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

    if (categoryKey === 'instrument' || categoryKey === 'feedback') {
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
      categoryByKey: Object.fromEntries(
        STORY_CATEGORY_KEYS.map((key) => [key, t(`stories.categories.${key}`)])
      ),
    }),
    [t]
  );

  const faqSchema = React.useMemo(() => {
    if (!story.faq || story.faq.length === 0) return null;
    return generateFaqSchema(
      story.faq.map((item) => ({ question: item.q, answer: item.a })),
      locale
    );
  }, [story.faq, locale]);

  if (router.isFallback) {
    return <LoadingSpinner locale={locale} />;
  }

  const getLink = (path: string) => `/${locale}${path}`;
  const _rawDescription = stripMarkdown(story.content || '');
  const metaDescription = _rawDescription.length <= 160
    ? _rawDescription
    : _rawDescription.substring(0, 160).replace(/\s+\S*$/, '');

  const dynamicOgImage = `/api/og/story?title=${encodeURIComponent(story.title)}&category=${encodeURIComponent(story.category || '')}&date=${encodeURIComponent(story.date || '')}&locale=${locale}`;
  const ogImage = story.thumbnail || dynamicOgImage;

  const shareStory = async () => {
    const shareUrl = `${siteConfig.url}/${locale}/stories/${story.slug}`;
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
        title={`${story.title} | ${siteConfig.name}`}
        description={story.summary || metaDescription}
        keywords={story.tags ? story.tags.join(', ') : t('stories.seo.fallbackKeywords')}
        canonical={story.isFallbackTranslation ? `/${story.sourceLocale}/stories/${story.slug}` : undefined}
        disableAlternates={story.isFallbackTranslation}
        ogImage={ogImage}
        ogImageAlt={story.thumbnail ? story.title : `${story.title} - ${siteConfig.name}`}
        ogType="article"
        author={story.author || undefined}
        robots={story.isFallbackTranslation ? 'noindex, follow' : undefined}
        articlePublishedTime={story.date}
        articleModifiedTime={story.modifiedDate}
        articleAuthor={story.author}
        articleSchemaType="BlogPosting"
        articleSection={story.category}
        articleTags={story.tags ?? undefined}
        articleWordCount={story.readingTime ? story.readingTime * 400 : undefined}
        includeSchema
        schema={
          [...(faqSchema ? [faqSchema] : []), ...(howToSchema ? [howToSchema] : [])].length > 0
            ? ([...(faqSchema ? [faqSchema] : []), ...(howToSchema ? [howToSchema] : [])] as Record<string, unknown>[])
            : undefined
        }
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: story.title, path: `/${locale}/stories/${story.slug}` },
        ]}
        webPageType="Article"
      />

      <ImageHero
        locale={locale}
        priority
        title={story.title}
        subtitle={
          <div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-lg mt-4 opacity-90">
              <div className="flex items-center">
                <Tag className="mr-2" size={18} aria-hidden="true" />
                <span>{story.category}</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <div className="flex items-center">
                <Calendar className="mr-2" size={18} aria-hidden="true" />
                <time dateTime={story.date}>{story.createdAt ? timeAgo(story.createdAt, locale) : story.date}</time>
              </div>
              <span className="hidden sm:inline">·</span>
              <div className="flex items-center">
                <Clock className="mr-1.5 opacity-80" size={16} aria-hidden="true" />
                <span>{story.readingTime}{t('stories.detail.readingTimeUnit')}</span>
              </div>
            </div>
            {story.tags && story.tags.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                {story.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/${locale}/stories/tag/${encodeURIComponent(tag)}`}
                    className="text-xs px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        }
        backgroundImage={story.thumbnail || '/images/studio1.webp'}
        imageAlt={story.title}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/70 via-black/40 to-black/70"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: story.title, path: `/${locale}/stories/${story.slug}` },
        ]}
      />

      <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 md:relative md:bg-transparent md:backdrop-blur-none md:border-0">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="py-3 flex items-center justify-between">
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
        </div>
      </div>

      <Section variant="default" className="pt-12 pb-12">
        <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-10 xl:gap-16">
          <article>
            <m.div
              {...STORY_BODY_ANIMATION}
              className="mb-12"
            >
              <MarkdownRenderer content={story.content} locale={locale} />
            </m.div>
          </article>
          <aside className="hidden lg:block">
            <TableOfContents content={story.content} locale={locale} />
          </aside>
        </div>

        <StoryCTA type={ctaType} locale={locale} />

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="typo-card-title mb-6">{t('stories.detail.moreTitle')}</h2>
          {relatedStories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {relatedStories.map((related) => (
                <StoryCard
                  key={related.slug}
                  story={related}
                  locale={locale}
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

StoryDetailPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: getStoryPaths(),
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const slug = params?.id as string;
  try {
    const story = await getStoryDetail(slug, locale);
    const relatedStories = getRelatedStories(locale, slug, 4);

    let howToSchema: Record<string, unknown> | null = null;
    if ((story.categoryKey === 'lesson' || story.categoryKey === 'music-guide') && story.content) {
      const steps = extractHowToSteps(story.content);
      if (steps.length >= 2) {
        howToSchema = generateHowToSchema(story.title, story.summary || '', steps, undefined, locale) as Record<string, unknown>;
      }
    }

    return buildPageStaticProps(
      locale,
      {
        story,
        relatedStories,
        howToSchema,
      },
      { revalidate: 3600 }
    );
  } catch (error) {
    const redirectTarget = getStoryRedirectTarget(slug);

    if (redirectTarget && redirectTarget !== slug) {
      try {
        await getStoryDetail(redirectTarget, locale);
        return {
          redirect: {
            destination: `/${locale}/stories/${redirectTarget}`,
            permanent: true,
          },
        };
      } catch {
        // Fall through to 404 when the redirect target is also missing.
      }
    }

    console.error('Story detail error:', error);
    return {
      notFound: true,
    };
  }
};

export default StoryDetailPage;
