import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getStoriesByCategory } from '../utils/localDataUtils';
import StoryCard from '../components/StoryCard';
import CategoryFilter from '../components/CategoryFilter';

const Stories = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // 스토리 데이터 불러오기
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoading(true);
        let fetchedStories;
        
        if (activeCategory === 'all') {
          // 모든 스토리 가져오기
          const { getAllStories } = require('../utils/localDataUtils');
          fetchedStories = await getAllStories();
        } else {
          // 카테고리별 스토리 가져오기
          fetchedStories = await getStoriesByCategory(activeCategory);
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
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">스토리</h1>
        <div className="flex justify-center items-center h-64">
          <p className="text-lg">스토리를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 오류 표시
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">스토리</h1>
        <div className="flex justify-center items-center h-64">
          <p className="text-lg text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  // 스토리가 없을 경우
  if (stories.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <div className="text-gray-400 text-2xl mb-4">📭</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">스토리가 없습니다</h2>
          <p className="text-gray-600 dark:text-gray-300">
            {activeCategory === 'all' 
              ? '아직 등록된 스토리가 없습니다.'
              : `'${activeCategory}' 카테고리에 등록된 스토리가 없습니다.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-8 text-center">스토리</h1>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-12 max-w-2xl mx-auto">
          스튜디오 녹음과 관련된 다양한 이야기, 인터뷰, 그리고 유용한 정보들을 만나보세요.
        </p>
        
        {/* 카테고리 필터 */}
        <CategoryFilter 
          activeCategory={activeCategory} 
          setActiveCategory={handleCategoryChange} 
        />
        
        {/* 스토리 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stories.map(story => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Stories;
