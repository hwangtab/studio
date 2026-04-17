import React, { useMemo, useRef } from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import StoryCard from '../../../../components/StoryCard';
import SEO from '../../../../components/SEO';
import ImageHero from '../../../../components/common/ImageHero';
import ContactCTA from '../../../../components/common/ContactCTA';
import { getAllStories } from '../../../../lib/stories';
import type { Story } from '../../../../types/story';
import { Section } from '../../../../components/ui/Section';
import Pagination from '../../../../components/ui/Pagination';
import { buildPageStaticProps, resolveLocaleParam } from '../../../../lib/getStatic';
import { locales, type Locale } from '../../../../lib/i18n';
import { generateItemListSchema } from '../../../../utils/schemaGenerator';
import { getSiteConfig } from '../../../../data/siteConfig';

import type { NextPageWithLayout } from '../../../../types';

const storyCategoryKeys = [
  'instrument', 'region', 'lesson', 'production', 'recording',
  'vocal', 'feedback', 'mixing', 'business', 'event',
] as const;

type CategoryKey = typeof storyCategoryKeys[number];

interface StoriesCategoryPageProps {
  locale: Locale;
  categoryKey: CategoryKey;
  stories: Story[];
  allStoriesCount: number;
}

const StoriesCategoryPage: NextPageWithLayout<StoriesCategoryPageProps> = ({
  locale, categoryKey, stories, allStoriesCount,
}) => {
  const router = useRouter();
  const currentPage = Number(router.query.page) || 1;
  const ITEMS_PER_PAGE = 12;
  const { t } = useTranslation('common', { lng: locale });
  const siteUrl = useMemo(() => getSiteConfig(locale).url, [locale]);
  const sectionRef = useRef<HTMLDivElement>(null);

  const categoryLabel = t(`stories.categories.${categoryKey}`);
  const seoTitle = t('stories.category.seoTitle', {
    category: categoryLabel,
    defaultValue: `${categoryLabel} | ${t('nav.stories')} | ${t('common.siteName', { defaultValue: 'Studio NOL' })}`,
  });
  const seoDescription = t('stories.category.seoDescription', {
    category: categoryLabel,
    count: stories.length,
    defaultValue: `${categoryLabel} 관련 ${stories.length}개의 스튜디오 놀 스토리. 실무 경험, 제작 노하우, 최신 소식을 한곳에서 확인하세요.`,
  });

  const totalPages = Math.ceil(stories.length / ITEMS_PER_PAGE);
  const visibleStories = useMemo(
    () => stories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [stories, currentPage]
  );

  const storyCardLabels = useMemo(() => ({
    defaultCategory: t('stories.list.defaultCategory'),
    noDate: t('stories.list.noDate'),
    noTitle: t('stories.list.noTitle'),
    noContent: t('stories.list.noContent'),
    categoryByKey: Object.fromEntries(
      storyCategoryKeys.map((key) => [key, t(`stories.categories.${key}`)])
    ),
  }), [t]);

  const itemListSchema = useMemo(() => generateItemListSchema(
    stories.slice(0, 50).map((story) => ({
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
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords={`${categoryLabel}, ${t('nav.stories')}, 스튜디오 놀, Studio NOL, ${t(`stories.categories.${categoryKey}`)} 가이드`}
        ogImage="/images/studio1.webp"
        ogImageAlt={t('stories.hero.alt')}
        ogImageWidth={1440}
        ogImageHeight={809}
        includeSchema
        webPageType="CollectionPage"
        schema={itemListSchema}
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
        subtitle={t('stories.category.subtitle', {
          category: categoryLabel,
          count: stories.length,
          defaultValue: `${categoryLabel} 관련 스토리 ${stories.length}편`,
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visibleStories.map((story) => (
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
              {stories.map((story) => (
                <li key={story.slug}>
                  <a href={`/${locale}/stories/${story.slug}`}>{story.title}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-4">
              {t('stories.category.browseAll', {
                total: allStoriesCount,
                defaultValue: `전체 ${allStoriesCount}편의 스토리도 확인해 보세요.`,
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
    storyCategoryKeys.map((key) => ({ params: { locale, key } }))
  );
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<StoriesCategoryPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const key = params?.key as CategoryKey;

  if (!storyCategoryKeys.includes(key)) {
    return { notFound: true };
  }

  const allStories = getAllStories(locale);
  const stories = allStories.filter((story) => story.categoryKey === key);

  return buildPageStaticProps(
    locale,
    {
      categoryKey: key,
      stories,
      allStoriesCount: allStories.length,
    },
    { revalidate: 3600 }
  );
};

export default StoriesCategoryPage;
