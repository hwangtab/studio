import React, { useRef, useState, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { timeAgo } from '../utils/dateUtils';
import { extractFirstImageUrl, summarizeContent } from '../utils/localDataUtils';

const StoryCard = ({ story }) => {
  const navigate = useNavigate();
  const titleRef = useRef(null);
  const [summaryLineClamp, setSummaryLineClamp] = useState(3);

  useLayoutEffect(() => {
    const checkTitleLines = () => {
      if (titleRef.current) {
        const titleElement = titleRef.current;
        const lineHeight = parseFloat(getComputedStyle(titleElement).lineHeight);
        const titleHeight = titleElement.scrollHeight;
        const lines = Math.round(titleHeight / lineHeight);
        
        if (lines > 1) {
          setSummaryLineClamp(2);
        } else {
          setSummaryLineClamp(3);
        }
      }
    };

    checkTitleLines();
    window.addEventListener('resize', checkTitleLines);
    return () => window.removeEventListener('resize', checkTitleLines);
  }, [story.title]);
  
  // 애니메이션 설정
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  
  // 카드 클릭 핸들러
  const handleCardClick = () => {
    navigate(`/stories/${story.id}`);
  };
  
  // 썸네일 이미지 URL 추출
  const thumbnailUrl = extractFirstImageUrl(story.content);
  
  // 평문 요약 생성
  const plainSummary = summarizeContent(story.content, 120);

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer h-96 flex flex-col"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01 }}
      onClick={handleCardClick}
    >
      {/* 썸네일 이미지 */}
      <div className="h-40 bg-gradient-to-br from-primary-light to-secondary-light overflow-hidden flex-shrink-0">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={story.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              // 이미지 로드 실패 시 기본 그라디언트 표시
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white/80 text-6xl font-bold">
              {story.category?.charAt(0) || 'S'}
            </div>
          </div>
        )}
      </div>
      
      {/* 콘텐츠 영역 */}
      <div className="p-4 flex flex-col flex-grow">
        {/* 카테고리 및 날짜 */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="typo-card-meta px-2 py-1 bg-primary/10 text-primary-dark rounded-full">
            {story.category || '기본'}
          </span>
          <span className="typo-card-meta text-gray-500 dark:text-gray-400">
            {story.date ? timeAgo(story.date) : '날짜 없음'}
          </span>
        </div>
        
        {/* 제목 */}
        <h3
          ref={titleRef}
          className="typo-card-title mb-2 line-clamp-2 leading-tight flex-shrink-0"
        >
          {story.title || '제목 없음'}
        </h3>
        
        {/* 요약 */}
        <div
          className="typo-card-body leading-snug mb-0 flex-grow"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: summaryLineClamp,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {plainSummary || '내용 없음'}
        </div>
      </div>
    </motion.div>
  );
};

export default StoryCard;
