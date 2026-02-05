import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { timeAgo } from '../utils/dateUtils';
import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import ResponsiveImage from './ResponsiveImage';
import type { Locale } from '../lib/i18n';

interface Story {
  id: string;
  slug?: string;
  title: string;
  content?: string;
  summary?: string;
  thumbnail?: string;
  category?: string;
  date?: string;
}

interface StoryCardProps {
  story: Story;
  locale?: Locale;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const StoryCard = React.memo(({ story, locale = 'ko' }: StoryCardProps) => {
  const t = (ko: string, en: string, zh?: string, es?: string, vi?: string, th?: string, uz?: string) => {
    if (locale === 'ko') return ko;
    if (locale === 'en') return en;
    if (locale === 'zh') return zh || en;
    if (locale === 'es') return es || en;
    if (locale === 'vi') return vi || en;
    if (locale === 'th') return th || en;
    if (locale === 'uz') return uz || en;
    return ko;
  };

  const thumbnailUrl = story.thumbnail || extractFirstImageUrl(story.content || '');
  const plainSummary = story.summary || summarizeText(story.content, 120, { stripMarkdown: true });
  const slug = story.slug || story.id;
  const href = `/${locale}/stories/${slug}`;

  return (
    <Link href={href} className="block h-full">
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer flex flex-col h-full"
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

        <div className="p-4 flex flex-col flex-grow">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <span className="typo-card-meta px-2 py-1 bg-primary/10 text-primary-dark rounded-full">
              {story.category || t('기본', 'Default', '默认', 'Predeterminado', 'Mặc định', 'ค่าเริ่มต้น', 'Standart')}
            </span>
            <span className="typo-card-meta text-gray-500 dark:text-gray-400">
              {story.date ? timeAgo(story.date, locale) : t('날짜 없음', 'No Date', '无日期', 'Sin fecha', 'Không có ngày', 'ไม่มีวันที่', 'Sana yoʻq')}
            </span>
          </div>

          <h3 className="typo-card-title mb-2 leading-tight flex-shrink-0 truncate">
            {story.title || t('제목 없음', 'No Title', '无标题', 'Sin título', 'Không có tiêu đề', 'ไม่มีชื่อเรื่อง', 'Sarlavha yoʻq')}
          </h3>

          <div className="typo-card-body leading-snug line-clamp-4 flex-none">
            {plainSummary || t('내용 없음', 'No Content', '无内容', 'Sin contenido', 'Không có nội dung', 'ไม่มีเนื้อหา', 'Mazmun yoʻq')}
          </div>
        </div>
      </motion.div>
    </Link>
  );
});

StoryCard.displayName = 'StoryCard';

export default StoryCard;
