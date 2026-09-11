import React from 'react';
import { Quote, Star } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getReviews } from '../../data/reviews';
import type { Locale } from '../../lib/i18n';

interface InlineReviewCalloutProps {
  id: string;
  locale: Locale;
}

/**
 * 본문 안 후기 인용 카드. %%review:<reviewId>%% short-code로 트리거.
 * reviews.ts에서 id로 lookup — 매칭 실패 시 null.
 */
const InlineReviewCallout = ({ id, locale }: InlineReviewCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const review = React.useMemo(() => {
    const all = getReviews(locale);
    return all.find((r) => r.id === id) ?? null;
  }, [locale, id]);

  if (!review) return null;

  return (
    <aside
      data-inline-callout="review"
      aria-label={t('stories.inline.reviewLabel', { defaultValue: '입주자·고객 후기' })}
      className="my-8 rounded-xl border-l-4 border-l-primary glass-card p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Quote className="text-primary dark:text-primary-lighter flex-shrink-0" size={18} aria-hidden="true" />
        <div className="flex gap-0.5" aria-label={`${review.rating}/5`}>
          {Array.from({ length: review.rating }).map((_, i) => (
            <Star key={i} size={14} className="text-amber-500 fill-amber-500" aria-hidden="true" />
          ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {review.category}
        </span>
      </div>
      <blockquote className="typo-card-body text-gray-800 dark:text-gray-200 italic mb-3">
        {review.content}
      </blockquote>
      <footer className="text-sm text-gray-600 dark:text-gray-400">
        — {review.author}
        {review.datePublished && (
          <time dateTime={review.datePublished} className="ml-2">
            {review.datePublished}
          </time>
        )}
      </footer>
    </aside>
  );
};

export default React.memo(InlineReviewCallout);
