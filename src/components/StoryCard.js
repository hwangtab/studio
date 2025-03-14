import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';

const StoryCard = ({ story }) => {
  const navigate = useNavigate();
  
  // 카테고리 매핑
  const categoryMap = {
    'work': '작업기',
    'interview': '인터뷰',
    'tips': '팁과 정보'
  };

  // 애니메이션 설정
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  
  // 카드 클릭 핸들러
  const handleCardClick = () => {
    navigate(`/stories/${story.id}`);
  };

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl cursor-pointer"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.02 }}
      onClick={handleCardClick}
    >
      {story.imageUrl && (
        <div className="w-full h-48 overflow-hidden">
          <img 
            src={story.imageUrl} 
            alt={story.title} 
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
          />
        </div>
      )}
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
            {categoryMap[story.category] || story.category}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(story.date || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {story.title}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
          {story.summary}
        </p>
        
        <div 
          className="inline-flex items-center text-primary hover:text-primary-dark transition-colors duration-300"
          onClick={(e) => e.stopPropagation()} // 이벤트 버블링 방지
        >
          더 보기 <FaArrowRight className="ml-2" size={14} />
        </div>
      </div>
    </motion.div>
  );
};

export default StoryCard;
