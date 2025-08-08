import React from 'react';
import { motion } from 'framer-motion';

const CategoryFilter = ({ 
  activeCategory, 
  setActiveCategory, 
  categories: propCategories,
  showTitle = false,
  titleIcon: TitleIcon = null,
  titleText = "카테고리",
  buttonSize = "md",
  useCustomColors = false,
  gap = "gap-2"
}) => {
  // 카테고리 데이터 정규화 (스토리와 포트폴리오 호환)
  const categories = propCategories.map(category => {
    // 포트폴리오 형식: {id, name, color}
    if (typeof category === 'object' && category.name) {
      return {
        id: category.id,
        label: category.name,
        color: category.color
      };
    }
    // 스토리 형식: 문자열
    if (typeof category === 'string') {
      return {
        id: category,
        label: category
      };
    }
    // 이미 정규화된 형식: {id, label}
    return category;
  });

  // "전체" 카테고리가 없으면 추가
  if (!categories.find(cat => cat.id === 'all')) {
    categories.unshift({ id: 'all', label: '전체' });
  }

  // 버튼 크기별 패딩
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-2 font-medium'
  };

  return (
    <div className="mb-8">
      {/* 제목 섹션 (선택사항) */}
      {showTitle && (
        <div className="flex items-center mb-6">
          {TitleIcon && <TitleIcon className="text-xl text-primary mr-3" />}
          <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-200">{titleText}</h3>
        </div>
      )}
      
      {/* 필터 버튼 컨테이너 */}
      <div className="relative">
        <div className={`flex ${gap} overflow-x-auto md:flex-wrap md:overflow-x-visible scrollbar-hide pb-2 scroll-smooth`}>
          {categories.map((category) => {
            const isActive = activeCategory === category.id;
            const customStyle = useCustomColors && isActive && category.color 
              ? { backgroundColor: category.color }
              : {};
            
            return (
              <motion.button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`${sizeClasses[buttonSize]} rounded-full transition-all duration-300 min-w-fit whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? useCustomColors && category.color 
                      ? 'text-white shadow-lg transform scale-105'
                      : 'bg-primary text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                style={customStyle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {category.label}
              </motion.button>
            );
          })}
        </div>
        
        {/* 모바일 스크롤 인디케이터 */}
        <div className="md:hidden absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
};

export default CategoryFilter;
