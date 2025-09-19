import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAllStories } from '../utils/localDataUtils';
import StoryCard from '../components/StoryCard';
import CategoryFilter from '../components/CategoryFilter';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';

const Stories = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  // 스토리 데이터 불러오기
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoading(true);
        let fetchedStories;
        
        // 모든 스토리 가져오기 (카테고리 목록 추출용)
        const allStories = await getAllStories();
        
        // 고유한 카테고리 목록 추출 (모든 스토리 기준)
        const uniqueCategories = [...new Set(allStories.map(story => story.category))];
        setCategories(uniqueCategories);

        // 필터링 적용
        if (activeCategory === 'all') {
          fetchedStories = allStories;
        } else {
          fetchedStories = allStories.filter(story => story.category === activeCategory);
        }
        
        setStories(fetchedStories);
        
        setLoading(false);
      } catch (error) {
        console.error('스토리 불러오기 오류:', error);
        setError('스토리를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    fetchStories();
  }, [activeCategory]);

  // 카테고리 필터 변경 핸들러
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-8 pb-12">
        <h1 className="text-heading-1 font-title mb-8 text-center">스토리</h1>
        <div className="flex justify-center items-center h-64">
          <p className="typo-section-lead">스토리를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 오류 표시
  if (error) {
    return (
      <div className="container mx-auto px-4 pt-8 pb-12">
        <h1 className="text-heading-1 font-title mb-8 text-center">스토리</h1>
        <div className="flex justify-center items-center h-64">
          <p className="typo-section-lead text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  // 스토리가 없을 경우
  if (stories.length === 0) {
    return (
      <div className="container mx-auto px-4 pt-16 pb-12">
        <div className="text-center">
          <div className="text-gray-400 text-2xl mb-4">📭</div>
          <h2 className="typo-card-title mb-4 text-gray-800 dark:text-white">스토리가 없습니다</h2>
          <p className="typo-card-body">
            {activeCategory === 'all' 
              ? '아직 등록된 스토리가 없습니다.'
              : `'${activeCategory}' 카테고리에 등록된 스토리가 없습니다.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-16 pb-12">
      {/* 헤더 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1 
          className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
          {...PAGE_TITLE_ANIMATION}
        >
          스토리
        </motion.h1>
        
        <motion.p
          className="typo-section-lead max-w-2xl mx-auto mb-12 text-center"
          {...PAGE_SUBTITLE_ANIMATION}
        >
          스튜디오 작업과 관련된 다양한 이야기를 만나보세요.
        </motion.p>
        
        {/* 카테고리 필터 */}
        <CategoryFilter
          activeCategory={activeCategory}
          setActiveCategory={handleCategoryChange}
          categories={categories}
        />
        
        {/* 스토리 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stories.map(story => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Stories;
