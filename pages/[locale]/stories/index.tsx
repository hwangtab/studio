import React, { useMemo, useState } from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import StoryCard from '../../../components/StoryCard';
import CategoryFilter from '../../../components/CategoryFilter';
import SEO from '../../../components/SEO';
import ImageHero from '../../../components/common/ImageHero';
import ContactCTA from '../../../components/common/ContactCTA';
import { getAllStories } from '../../../lib/stories';
import type { Story } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import { getCommonStaticPaths, getI18nStaticProps } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';

interface StoriesPageProps {
  locale: Locale;
  stories: Story[];
}

const StoriesPage: NextPage<StoriesPageProps> = ({ locale, stories }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(8);
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

  const visibleStories = useMemo(
    () => filteredStories.slice(0, visibleCount),
    [filteredStories, visibleCount]
  );

  const hasMoreStories = filteredStories.length > visibleCount;

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    setVisibleCount(8);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 8);
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
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
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
                <StoryCard key={story.slug} story={story} locale={locale} />
              ))}
            </div>
          )}

          {hasMoreStories && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors font-medium"
              >
                {t('actions.more')}
              </button>
            </div>
          )}
        </m.div>
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

(StoriesPage as NextPage & { hasHero?: boolean }).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<StoriesPageProps> = async ({ params }) => {
  const locale = params?.locale || 'ko';
  const stories = getAllStories(locale as string);
  return {
    props: {
      ...getI18nStaticProps(locale),
      stories,
    },
    revalidate: 1800,
  };
};

export default StoriesPage;
