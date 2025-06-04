import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { formatDate } from '../utils/dateUtils';

const StoryCard = ({ story }) => {
  const navigate = useNavigate();
  
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
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01 }}
      onClick={handleCardClick}
    >
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
        {story.title || '제목 없음'}
      </h3>
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        {story.date ? formatDate(story.date) : '날짜 없음'}
      </div>
      <div className="text-gray-600 dark:text-gray-300 mb-2 line-clamp-3">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
          {story.summary || '내용 없음'}
        </ReactMarkdown>
      </div>
      <div className="inline-flex items-center text-primary hover:text-primary-dark transition-colors duration-300">
        더 보기 <FaArrowRight className="ml-1" size={12} />
      </div>
    </motion.div>
  );
};

export default StoryCard;
