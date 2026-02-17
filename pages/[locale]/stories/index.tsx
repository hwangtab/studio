import React, { useMemo, useState } from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import { useTranslation } from 'react-i18next';
import StoryCard from '../../../components/StoryCard';
import CategoryFilter from '../../../components/CategoryFilter';
import SEO from '../../../components/SEO';
import ImageHero from '../../../components/common/ImageHero';
import ContactCTA from '../../../components/common/ContactCTA';
import { getAllStories } from '../../../lib/stories';
import type { Story } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import Pagination from '../../../components/ui/Pagination';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';

import type { NextPageWithLayout } from '../../../types';

interface StoriesPageProps {
  locale: Locale;
  stories: Story[];
}

const StoriesPage: NextPageWithLayout<StoriesPageProps> = ({ locale, stories }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const { t } = useTranslation('common', { lng: locale });


  const categories = useMemo(() => {
    const uniqueKeys = new Set(stories.map((story) => story.categoryKey).filter(Boolean));
    return Array.from(uniqueKeys).map(key => ({
      id: key,
      label: t(`stories.categories.${key}`)
    }));
  }, [stories, t]);

  const filteredStories = useMemo(() => {
    if (activeCategory === 'all') return stories;
    return stories.filter((story) => story.categoryKey === activeCategory);
  }, [stories, activeCategory]);

  const totalPages = Math.ceil(filteredStories.length / ITEMS_PER_PAGE);

  const visibleStories = useMemo(
    () => filteredStories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredStories, currentPage]
  );


  const storyCardLabels = useMemo(
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

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <SEO
        title={t('stories.seo.title')}
        description={t('stories.seo.description')}
        keywords={t('stories.seo.keywords')}
        includeSchema
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
        ]}
      />
      <ImageHero
        locale={locale}
        title={t('stories.hero.title')}
        subtitle={t('stories.hero.subtitle')}
        backgroundImage="/images/studio1.jpg"
        imageAlt={t('stories.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />
      <Section variant="default">
        <div>
          <div className="mb-8">
            <CategoryFilter
              activeCategory={activeCategory}
              setActiveCategory={handleCategoryChange}
              categories={categories}
              allLabel={t('stories.filters.all')}
            />
          </div>

          {filteredStories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-2xl mb-4">📭</div>
              <h2 className="typo-card-title mb-4 text-gray-800 dark:text-white">
                {t('stories.empty.title')}
              </h2>
              <p className="typo-card-body">
                {activeCategory === 'all'
                  ? t('stories.empty.all')
                  : t('stories.empty.byCategory', { category: t(`stories.categories.${activeCategory}`) })}
              </p>
            </div>
          ) : (
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
          )}

          {totalPages > 1 && (
            <div className="mt-12">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
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
        />
      </Section>
    </>
  );
};

StoriesPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<StoriesPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const stories = getAllStories(locale);

  return buildPageStaticProps(
    locale,
    {
      stories,
    },
    { revalidate: 1800 }
  );
};

export default StoriesPage;
