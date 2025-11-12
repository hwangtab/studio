import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { timeAgo } from '../utils/dateUtils';
import { extractFirstImageUrl, summarizeContent } from '../utils/localDataUtils';
import ResponsiveImage from './ResponsiveImage';

const StoryCard = ({ story }) => {
  const titleRef = useRef(null);
  const summaryRef = useRef(null);
  const [summaryLineClamp] = useState(4);

  useEffect(() => {
    const fitTitleToOneLine = () => {
      const el = titleRef.current;
      if (!el) return;
      el.style.whiteSpace = 'normal';
      el.style.fontSize = '';
      let comp = getComputedStyle(el);
      let size = parseFloat(comp.fontSize || '16');
      const min = Math.max(12, Math.round(size * 0.75));
      const getLines = () => (el.getClientRects ? el.getClientRects().length : 1);
      let guard = 40;
      while (getLines() > 1 && size > min && guard-- > 0) {
        size -= 1;
        el.style.fontSize = size + 'px';
        comp = getComputedStyle(el);
      }
      el.style.whiteSpace = 'nowrap';
      el.style.overflow = 'hidden';
      el.style.textOverflow = 'ellipsis';
    };
    const enforceSummaryFourLines = () => {
      const s = summaryRef.current;
      if (!s) return;
      const cs = getComputedStyle(s);
      const lh = parseFloat(cs.lineHeight || '0') || 0;
      if (!lh) return;
      const max = Math.ceil(lh * 4 + 0.5);
      s.style.maxHeight = max + 'px';
      s.style.overflow = 'hidden';
    };

    fitTitleToOneLine();
    enforceSummaryFourLines();
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready
        .then(() => requestAnimationFrame(() => { fitTitleToOneLine(); enforceSummaryFourLines(); }))
        .catch(() => {});
    }
    const onResize = () => { fitTitleToOneLine(); enforceSummaryFourLines(); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [story.title]);
  
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
          
          <h3
            ref={titleRef}
            className="typo-card-title mb-2 leading-tight flex-shrink-0"
          >
            {story.title || '제목 없음'}
          </h3>
          
          <div
            ref={summaryRef}
            className={`typo-card-body leading-snug ${summaryLineClamp === 4 ? 'line-clamp-4' : 'line-clamp-2'} flex-none`}
          >
            {plainSummary || '내용 없음'}
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default StoryCard;
