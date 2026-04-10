import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { timeAgo } from '../utils/dateUtils';

import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import ResponsiveImage from './ResponsiveImage';
import type { Locale } from '../lib/i18n';

import type { Story, StoryListItem } from '../types/story';

interface StoryCardProps {
  story: Story | StoryListItem;
  locale?: Locale;
  labels?: {
    defaultCategory: string;
    noDate: string;
    noTitle: string;
    noContent: string;
    categoryByKey: Record<string, string>;
  };
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const StoryCard = React.memo(({ story, locale = 'ko', labels }: StoryCardProps) => {
  const thumbnailUrl = React.useMemo(() => {
    if (story.thumbnail) return story.thumbnail;
    if (!('content' in story) || !story.content) return null;
    return extractFirstImageUrl(story.content);
  }, [story]);

  const plainSummary = React.useMemo(() => {
    if (story.summary) return story.summary;
    if (!('content' in story) || !story.content) return '';
    return summarizeText(story.content, 120, { stripMarkdown: true });
  }, [story]);

  const slug = story.slug || story.id;
  const href = `/${locale}/stories/${slug}`;
  const dateText = story.date ? timeAgo(story.date, locale) : labels?.noDate || 'No date';
  const categoryText = labels?.categoryByKey[story.categoryKey] || story.category || labels?.defaultCategory || 'Story';
  const titleText = story.title || labels?.noTitle || 'Untitled';
  const contentText = plainSummary || labels?.noContent || '';

  return (
    <Link href={href} className="block h-full touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900">
      <m.div
        className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md cursor-pointer flex flex-col h-full transition-shadow duration-300 hover:shadow-lg"
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
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
              {categoryText}
            </span>
            <div className="flex items-center flex-shrink-0 typo-card-meta text-gray-500 dark:text-gray-400">
              <time dateTime={story.date}>
                {dateText}
              </time>
              {story.readingTime > 0 && (
                <>
                  <span className="text-gray-400 dark:text-gray-500 mx-1" aria-hidden="true">·</span>
                  <span className="flex-shrink-0 text-gray-500 dark:text-gray-400">{story.readingTime}분</span>
                </>
              )}
            </div>
          </div>

          <h3 className="typo-card-title mb-2 leading-tight flex-shrink-0 line-clamp-2 break-words" title={story.title}>
            {titleText}
          </h3>

          <div className="typo-card-body leading-snug line-clamp-4 flex-none">
            {contentText}
          </div>

          {story.tags && story.tags.length > 0 && (
            <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
              {story.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </m.div>
    </Link>
  );
});

StoryCard.displayName = 'StoryCard';

export default StoryCard;
