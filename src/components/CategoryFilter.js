import React from 'react';
import { motion } from 'framer-motion';

const CategoryFilter = ({ activeCategory, setActiveCategory }) => {
  // 카테고리 목록 (메모리에서 언급된 세 가지 카테고리로 변경)
  const categories = [
    { id: 'all', label: '전체' },
    { id: 'work', label: '작업기' },
    { id: 'interview', label: '인터뷰' },
    { id: 'tips', label: '팁과 정보' }
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => setActiveCategory(category.id)}
          className={`px-4 py-2 rounded-full transition-colors duration-300 ${activeCategory === category.id 
            ? 'bg-primary text-white' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {category.label}
        </motion.button>
      ))}
    </div>
  );
};

export default CategoryFilter;
