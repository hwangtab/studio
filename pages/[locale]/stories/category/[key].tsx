import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft } from '@/lib/lucide-icons';
import StoryCard from '../../../../components/StoryCard';
import SEO from '../../../../components/SEO';
import ImageHero from '../../../../components/common/ImageHero';
import ContactCTA from '../../../../components/common/ContactCTA';
import { getAllStories, isBrowsableStoryForLocale } from '../../../../lib/stories';
import { STORY_CATEGORY_KEYS, type StoryCategoryKey } from '../../../../lib/storyCategories';
import type { StoryCardData } from '../../../../types/story';
import { Section } from '../../../../components/ui/Section';
import Pagination from '../../../../components/ui/Pagination';
import { buildPageStaticProps, resolveLocaleParam } from '../../../../lib/getStatic';
import { locales, type Locale } from '../../../../lib/i18n';
import { generateItemListSchema } from '../../../../utils/schema';
import { getSiteConfig } from '../../../../data/siteConfig';
import { normalizePageNumber } from '../../../../utils/pagination';
import { getScrollBehavior } from '../../../../utils/scrollUtils';

import type { NextPageWithLayout } from '../../../../types';

type CategoryKey = StoryCategoryKey;

interface StoriesCategoryPageProps {
  locale: Locale;
  categoryKey: CategoryKey;
  initialStories: StoryCardData[];
  storyLinks: Pick<StoryCardData, 'slug' | 'title'>[];
  storyCount: number;
  allStoriesCount: number;
  totalPages: number;
}

const StoriesCategoryPage: NextPageWithLayout<StoriesCategoryPageProps> = ({
  locale, categoryKey, initialStories, storyLinks, storyCount, allStoriesCount, totalPages: initialTotalPages,
}) => {
  const router = useRouter();
  const ITEMS_PER_PAGE = 12;
  const { t } = useTranslation('common', { lng: locale });
  const siteUrl = useMemo(() => getSiteConfig(locale).url, [locale]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [stories, setStories] = useState<StoryCardData[]>(initialStories);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalItems, setTotalItems] = useState(storyCount);
  const [isLoadingStories, setIsLoadingStories] = useState(false);

  const categoryLabel = t(`stories.categories.${categoryKey}`);
  const seoTitle = t('stories.categoryHub.seoTitle', {
    category: categoryLabel,
    defaultValue: `${categoryLabel} | ${t('nav.stories')} | Studio NOL`,
  });
  const seoDescription = t('stories.categoryHub.seoDescription', {
    category: categoryLabel,
    count: storyCount,
    defaultValue: `${storyCount} Studio NOL stories about ${categoryLabel}.`,
  });

  const currentPage = normalizePageNumber(router.query.page, totalPages);

  const storyCardLabels = useMemo(() => ({
    defaultCategory: t('stories.list.defaultCategory'),
    noDate: t('stories.list.noDate'),
    noTitle: t('stories.list.noTitle'),
    noContent: t('stories.list.noContent'),
    categoryByKey: Object.fromEntries(
      STORY_CATEGORY_KEYS.map((key) => [key, t(`stories.categories.${key}`)])
    ),
  }), [t]);

  const itemListSchema = useMemo(() => generateItemListSchema(
    stories.map((story) => ({
      id: story.slug,
      name: story.title,
      url: `${siteUrl}/${locale}/stories/${story.slug}`,
      image: story.thumbnail ?? undefined,
      description: story.summary,
    })),
    siteUrl,
    locale,
    `${categoryLabel} · ${t('nav.stories')}`
  ), [stories, siteUrl, locale, categoryLabel, t]);

  const canonicalPath = `/${locale}/stories/category/${categoryKey}`;
  const prevUrl = currentPage > 1
    ? `${siteUrl}${canonicalPath}${currentPage - 1 > 1 ? `?page=${currentPage - 1}` : ''}`
    : null;
  const nextUrl = currentPage < totalPages
    ? `${siteUrl}${canonicalPath}?page=${currentPage + 1}`
    : null;

  const handlePageChange = (page: number) => {
    const query: Record<string, string | number> = {
      locale: router.query.locale as string,
      key: categoryKey,
    };
    if (page > 1) query.page = page;
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
    if (sectionRef.current) {
      const yOffset = -100;
      const y = sectionRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: getScrollBehavior() });
    }
  };

  useEffect(() => {
    if (!router.isReady) return;

    const controller = new AbortController();
    const loadStories = async () => {
      setIsLoadingStories(true);
      try {
        const params = new URLSearchParams({
          locale,
          category: categoryKey,
          page: String(currentPage),
          pageSize: String(ITEMS_PER_PAGE),
        });
        const response = await fetch(`/api/stories/catalog?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Story catalog request failed: ${response.status}`);
        const data = await response.json() as {
          stories: StoryCardData[];
          totalItems: number;
          totalPages: number;
        };
        setStories(data.stories);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error(error);
        }
      } finally {
        setIsLoadingStories(false);
      }
    };

    void loadStories();
    return () => controller.abort();
  }, [categoryKey, currentPage, locale, router.isReady]);

  return (
    <>
      <SEO
        locale={locale}
        title={seoTitle}
        description={seoDescription}
        keywords={`${categoryLabel}, ${t('nav.stories')}, 스튜디오 놀, Studio NOL, ${t(`stories.categories.${categoryKey}`)} 가이드`}
        ogImage="/images/og-studio1.webp"
        ogImageAlt={t('stories.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        includeBusinessReviews={false}
        webPageType="CollectionPage"
        schema={currentPage === 1 ? itemListSchema : undefined}
        canonical={canonicalPath}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: categoryLabel, path: canonicalPath },
        ]}
      />
      {(prevUrl || nextUrl) && (
        <Head>
          {prevUrl && <link rel="prev" href={prevUrl} />}
          {nextUrl && <link rel="next" href={nextUrl} />}
        </Head>
      )}
      <ImageHero
        locale={locale}
        priority
        title={categoryLabel}
        subtitle={t('stories.categoryHub.subtitle', {
          category: categoryLabel,
          count: storyCount,
          defaultValue: `${storyCount} stories about ${categoryLabel}`,
        })}
        backgroundImage="/images/studio1.webp"
        imageAlt={t('stories.hero.alt')}
        minHeight="min-h-[50vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: categoryLabel, path: canonicalPath },
        ]}
      />
      <Section variant="default">
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {isLoadingStories ? t('common.loading', { defaultValue: 'Loading' }) : `${totalItems} ${categoryLabel}`}
        </p>
        <div ref={sectionRef}>
          <div className="mb-8">
            <Link
              href={`/${locale}/stories`}
              className="inline-flex items-center typo-card-cta hover:underline"
            >
              <ArrowLeft size={16} aria-hidden="true" className="mr-2" />
              {t('stories.detail.backToList')}
            </Link>
          </div>

          {stories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-2xl mb-4">📭</div>
              <h2 className="typo-card-title mb-4">
                {t('stories.empty.byCategory', { category: categoryLabel })}
              </h2>
            </div>
          ) : (
            <>
              <h2 className="sr-only">{categoryLabel}</h2>
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-200 ${isLoadingStories ? 'opacity-60' : 'opacity-100'}`}>
                {stories.map((story) => (
                  <StoryCard
                    key={story.slug}
                    story={story}
                    locale={locale}
                    labels={storyCardLabels}
                  />
                ))}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <div className="mt-12">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                locale={locale}
              />
            </div>
          )}

          <nav aria-label={`${categoryLabel} stories`} className="sr-only">
            <ul>
              {storyLinks.map((story) => (
                <li key={story.slug}>
                  <a href={`/${locale}/stories/${story.slug}`}>{story.title}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-4">
              {t('stories.categoryHub.browseAll', {
                total: allStoriesCount,
                defaultValue: `Browse all ${allStoriesCount} stories.`,
              })}
            </p>
            <Link
              href={`/${locale}/stories`}
              className="inline-flex items-center gap-2 typo-card-cta hover:underline"
            >
              {t('stories.detail.viewAll')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Section>

      <Section variant="alternate" className="py-16">
        <ContactCTA
          locale={locale}
          title={t('pricing.cta.title')}
          subtitle={t('pricing.cta.subtitle')}
          imageSrc="/images/recording15.webp"
          imageAlt={t('pricing.images.packageAlt')}
          primaryButtonLabel={t('pricing.cta.inquiry')}
          secondaryButtonLabel={t('pricing.cta.location')}
          headingAs="h3"
        />
      </Section>
    </>
  );
};

StoriesCategoryPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = locales.flatMap((locale) =>
    STORY_CATEGORY_KEYS.map((key) => ({ params: { locale, key } }))
  );
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<StoriesCategoryPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const key = params?.key as CategoryKey;

  if (!STORY_CATEGORY_KEYS.includes(key)) {
    return { notFound: true };
  }

  const allStories = getAllStories(locale);
  const listableStories = allStories.filter((story) =>
    isBrowsableStoryForLocale(story, locale)
  );
  // noindex/thin/fallback 및 일반 시·군 지역 페이지는 listing에서도 숨김.
  const filtered = listableStories.filter((story) => story.categoryKey === key);
  // __NEXT_DATA__ 크기 절감: Story 전체 객체 대신 StoryCard에 필요한 필드만 직렬화.
  const toStoryCardData = (story: typeof filtered[number]): StoryCardData => ({
    slug: story.slug,
    id: story.id,
    title: story.title,
    date: story.date,
    categoryKey: story.categoryKey,
    category: story.category,
    thumbnail: story.thumbnail,
    ...(story.summary ? { summary: story.summary } : {}),
  });
  const initialStories = filtered.slice(0, 12).map(toStoryCardData);
  const storyLinks = filtered.slice(0, 50).map((story) => ({
    slug: story.slug,
    title: story.title,
  }));

  return buildPageStaticProps(
    locale,
    {
      categoryKey: key,
      initialStories,
      storyLinks,
      storyCount: filtered.length,
      allStoriesCount: listableStories.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / 12)),
    },
    { revalidate: 3600, i18nSections: ['stories', 'pricing'] }
  );
};

export default StoriesCategoryPage;
