import React, { useMemo, useState } from 'react';
import type { NextPage, GetStaticProps } from 'next';
import { motion } from 'framer-motion';
import StoryCard from '../../components/StoryCard';
import CategoryFilter from '../../components/CategoryFilter';
// @ts-ignore - SEO component is JS
import SEO from '../../components/SEO';
// @ts-ignore - ImageHero component is JS
import ImageHero from '../../components/common/ImageHero';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../../utils/animationUtils';
import { getAllStories } from '../../lib/stories';
import type { Story } from '../../types/story';

interface StoriesPageProps {
  stories: Story[];
}

const StoriesPage: NextPage<StoriesPageProps> = ({ stories }) => {
  const [activeCategory, setActiveCategory] = useState('all');

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
        title="스토리 - 스튜디오 놀 프로젝트 기록"
        description="스튜디오 놀에서 진행된 다양한 작업 후기와 스토리를 만나보세요."
        canonical="https://studionol.co.kr/stories"
        keywords="스튜디오 놀 스토리, 작업 후기, 음악 제작 스토리"
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '스토리', path: '/stories' },
        ]}
      />
      <ImageHero
        title="스토리"
        subtitle="스튜디오 작업과 관련된 다양한 이야기를 만나보세요."
        backgroundImage="/images/studio1.jpg"
        imageAlt="스튜디오 놀 스토리"
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />
      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          <div className="mb-8">
            <CategoryFilter
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              categories={categories}
            />
          </div>

          {filteredStories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-2xl mb-4">📭</div>
              <h2 className="typo-card-title mb-4 text-gray-800 dark:text-white">스토리가 없습니다</h2>
              <p className="typo-card-body">
                {activeCategory === 'all'
                  ? '아직 등록된 스토리가 없습니다.'
                  : `'${activeCategory}' 카테고리에 등록된 스토리가 없습니다.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredStories.map((story) => (
                <StoryCard key={story.slug} story={story as any} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export const getStaticProps: GetStaticProps<StoriesPageProps> = () => {
  const stories = getAllStories();
  return {
    props: {
      stories,
    },
  };
};

export default StoriesPage;

(StoriesPage as any).hasHero = true;
