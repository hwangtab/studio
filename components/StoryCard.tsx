import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { timeAgo } from '../utils/dateUtils';

import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import ResponsiveImage from './ResponsiveImage';
import type { Locale } from '../lib/i18n';

import type { StoryCardData } from '../types/story';

interface StoryCardProps {
  story: StoryCardData;
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
    if (!story.content) return null;
    return extractFirstImageUrl(story.content);
  }, [story.content, story.thumbnail]);

  const plainSummary = React.useMemo(() => {
    if (story.summary) return story.summary;
    if (!story.content) return '';
    return summarizeText(story.content, 120, { stripMarkdown: true });
  }, [story.content, story.summary]);

  const slug = story.slug || story.id;
  const href = `/${locale}/stories/${slug}`;
  const dateText = story.date ? timeAgo(story.date, locale) : labels?.noDate || 'No date';
  const categoryText = labels?.categoryByKey[story.categoryKey] || story.category || labels?.defaultCategory || 'Story';
  const titleText = story.title || labels?.noTitle || 'Untitled';
  const contentText = plainSummary || labels?.noContent || '';

  return (
    // prefetch={false}: stories listing 등에서 다수 카드가 viewport에 동시 존재.
    // 기본 prefetch면 carousel/그리드 한 줄에 표시되는 모든 /stories/[slug] SSG JSON이
    // 동시에 다운로드되어 모바일 데이터·메인스레드 부담. hover/focus 시 prefetch는 유지.
    <Link
      href={href}
      prefetch={false}
      className="block h-full touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep"
    >
      <m.article
        itemScope
        itemType="https://schema.org/BlogPosting"
        className="bg-canvas-soft border border-hairline shadow-card rounded-card overflow-hidden cursor-pointer flex flex-col h-full transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 dark:bg-surface-dark-elevated dark:border-white/10"
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {story.date && <meta itemProp="datePublished" content={story.date} />}
        <link itemProp="url" href={href} />

        {/* 16:9 thumbnail — rounded corners only on top */}
        <div className="aspect-[16/9] bg-canvas-warm overflow-hidden flex-shrink-0 relative rounded-t-card">
          {thumbnailUrl ? (
            <ResponsiveImage
              src={thumbnailUrl}
              alt={story.title}
              className="object-cover transition-transform duration-300 hover:scale-105"
              sizes="(min-width: 1024px) 320px, (min-width: 640px) 260px, 100vw"
              fill={true}
              itemProp="image"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-canvas-warm">
              <div className="text-ink/20 text-6xl font-display font-light">
                {story.category?.charAt(0) || 'S'}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col flex-grow min-w-0">
          <h3
            className="text-title-md text-ink dark:text-on-dark line-clamp-2 mb-2 break-words"
            title={story.title}
            itemProp="headline"
          >
            {titleText}
          </h3>

          <div
            className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft line-clamp-3 mb-4 leading-relaxed"
            itemProp="description"
          >
            {contentText}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 min-w-0">
            <span
              className="text-caption text-ink-muted-40 dark:text-on-dark-soft min-w-0 break-words"
              itemProp="articleSection"
            >
              {categoryText}
            </span>
            <time
              dateTime={story.date}
              className="text-caption text-ink-muted-40 dark:text-on-dark-soft flex-shrink-0"
              itemProp="datePublished"
            >
              {dateText}
            </time>
          </div>
        </div>
      </m.article>
    </Link>
  );
});

StoryCard.displayName = 'StoryCard';

export default StoryCard;
