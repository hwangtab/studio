import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { timeAgo } from '../utils/dateUtils';
import { extractFirstImageUrl, summarizeContent } from '../utils/localDataUtils';
import ResponsiveImage from './ResponsiveImage';

const StoryCard = ({ story }) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  
  const thumbnailUrl = story.thumbnail || extractFirstImageUrl(story.content || '');
  const plainSummary = story.summary || summarizeContent(story.content, 120);
  const slug = story.slug || story.id;

  return (
    <Link href={`/stories/${slug}`} className="block h-full">
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer flex flex-col h-full"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ scale: 1.01 }}
      >
        <div className="h-40 bg-gradient-to-br from-primary-light to-secondary-light overflow-hidden flex-shrink-0 relative">
          {thumbnailUrl ? (
            <ResponsiveImage
              src={thumbnailUrl}
              alt={story.title}
              className="object-cover transition-transform duration-300 hover:scale-105"
              sizes="(min-width: 1024px) 320px, (min-width: 640px) 260px, 100vw"
              fill
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-white/80 text-6xl font-bold">
                {story.category?.charAt(0) || 'S'}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 flex flex-col flex-grow">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <span className="typo-card-meta px-2 py-1 bg-primary/10 text-primary-dark rounded-full">
              {story.category || '기본'}
            </span>
            <span className="typo-card-meta text-gray-500 dark:text-gray-400">
              {story.date ? timeAgo(story.date) : '날짜 없음'}
            </span>
          </div>
          
          <h3 className="typo-card-title mb-2 leading-tight flex-shrink-0 truncate">
            {story.title || '제목 없음'}
          </h3>
          
          <div className="typo-card-body leading-snug line-clamp-4 flex-none">
            {plainSummary || '내용 없음'}
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default StoryCard;
