import React, { useMemo, useState } from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import StoryCard from '../../../components/StoryCard';
import CategoryFilter from '../../../components/CategoryFilter';
import SEO from '../../../components/SEO';
import ImageHero from '../../../components/common/ImageHero';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../../../utils/animationUtils';
import { getAllStories } from '../../../lib/stories';
import type { Story } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import { getCommonStaticPaths } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';

interface StoriesPageProps {
  locale: Locale;
  stories: Story[];
}

const StoriesPage: NextPage<StoriesPageProps> = ({ locale, stories }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const { t } = useTranslation('common', { lng: locale });

  const categories = useMemo(() => {
    const unique = new Set(stories.map((story) => story.category).filter(Boolean));
    return Array.from(unique);
  }, [stories]);

  const filteredStories = useMemo(() => {
    if (activeCategory === 'all') return stories;
    return stories.filter((story) => story.category === activeCategory);
  }, [stories, activeCategory]);

  return (
    <>
      <SEO
        title={t('stories.seo.title')}
        description={t('stories.seo.description')}
        canonical={`https://studionol.co.kr/${locale}/stories`}
        keywords={t('stories.seo.keywords')}
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          <div className="mb-8">
            <CategoryFilter
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
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
                  : t('stories.empty.byCategory', { category: activeCategory })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredStories.map((story) => (
                <StoryCard key={story.slug} story={story as any} locale={locale} />
              ))}
            </div>
          )}
        </motion.div>
      </Section>
    </>
  );
};

(StoriesPage as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<StoriesPageProps> = async ({ params }) => {
  const locale = params?.locale || 'ko';
  const stories = getAllStories(locale as string);
  return {
    props: {
      locale: locale as Locale,
      stories,
    },
  };
};

export default StoriesPage;
