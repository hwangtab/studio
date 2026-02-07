import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { timeAgo } from '../utils/dateUtils';

import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import ResponsiveImage from './ResponsiveImage';
import type { Locale } from '../lib/i18n';

import type { Story } from '../types/story';

interface StoryCardProps {
  story: Story;
  locale?: Locale;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const StoryCard = React.memo(({ story, locale = 'ko' }: StoryCardProps) => {
  const { t } = useTranslation('common');

  const thumbnailUrl = story.thumbnail || extractFirstImageUrl(story.content || '');
  const plainSummary = story.summary || summarizeText(story.content, 120, { stripMarkdown: true });
  const slug = story.slug || story.id;
  const href = `/${locale}/stories/${slug}`;

  return (
    <Link href={href} className="block h-full touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900">
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-shadow duration-300 hover:shadow-lg cursor-pointer flex flex-col h-full"
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        whileHover={{ scale: 1.01 }}
      >
        <div className="h-40 bg-gradient-to-br from-primary-light to-secondary-light overflow-hidden flex-shrink-0 relative">
          {thumbnailUrl ? (
            <ResponsiveImage
              src={thumbnailUrl}
              alt={story.title}
              className="object-cover transition-transform duration-300 hover:scale-105"
              sizes="(min-width: 1024px) 320px, (min-width: 640px) 260px, 100vw"
              fill={true}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-white/80 text-6xl font-bold">
                {story.category?.charAt(0) || 'S'}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2 flex-shrink-0 min-w-0">
            <span className="typo-card-meta px-2 py-1 bg-primary/10 text-primary-dark rounded-full min-w-0 break-words">
              {story.category || t('stories.list.defaultCategory')}
            </span>
            <span className="typo-card-meta text-gray-500 dark:text-gray-400 flex-shrink-0">
              {story.date ? timeAgo(story.date, locale) : t('stories.list.noDate')}
            </span>
          </div>

          <h3 className="typo-card-title mb-2 leading-tight flex-shrink-0 line-clamp-2 break-words" title={story.title}>
            {story.title || t('stories.list.noTitle')}
          </h3>

          <div className="typo-card-body leading-snug line-clamp-4 flex-none">
            {plainSummary || t('stories.list.noContent')}
          </div>
        </div>
      </motion.div>
    </Link>
  );
});

StoryCard.displayName = 'StoryCard';

export default StoryCard;
