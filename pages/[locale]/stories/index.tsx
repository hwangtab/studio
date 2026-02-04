import React, { useMemo, useState } from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import { motion } from 'framer-motion';
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
  const isKo = locale === 'ko';

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
        title={isKo ? "스토리 - 스튜디오 놀 프로젝트 기록" : "Stories - Studio NOL Project Logs"}
        description={isKo ? "스튜디오 놀에서 진행된 다양한 작업 후기와 스토리를 만나보세요." : "Discover various stories and reviews from projects at Studio NOL."}
        canonical={`https://studionol.co.kr/${locale}/stories`}
        keywords="스튜디오 놀 스토리, 작업 후기, 음악 제작 스토리"
        breadcrumbs={[
          { name: isKo ? '홈' : 'Home', path: `/${locale}` },
          { name: isKo ? '스토리' : 'Stories', path: `/${locale}/stories` },
        ]}
      />
      <ImageHero
        title={isKo ? "스토리" : "Stories"}
        subtitle={isKo ? "스튜디오 작업과 관련된 다양한 이야기를 만나보세요." : "Explore various stories about studio work."}
        backgroundImage="/images/studio1.jpg"
        imageAlt="Studio NOL Stories"
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
              allLabel={isKo ? "전체" : "All"}
            />
          </div>

          {filteredStories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-2xl mb-4">📭</div>
              <h2 className="typo-card-title mb-4 text-gray-800 dark:text-white">
                {isKo ? "스토리가 없습니다" : "No stories found"}
              </h2>
              <p className="typo-card-body">
                {activeCategory === 'all'
                  ? (isKo ? '아직 등록된 스토리가 없습니다.' : 'No stories registered yet.')
                  : (isKo ? `'${activeCategory}' 카테고리에 등록된 스토리가 없습니다.` : `No stories in '${activeCategory}' category.`)}
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
