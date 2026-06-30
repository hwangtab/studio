import React from 'react';
import { Quote, Star } from '@/lib/lucide-icons';
import type { ReviewItem } from '../../types/data';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';

type ReleaseReview = ReviewItem & {
  category?: string;
};

interface ReleaseReviewsSectionProps {
  title: string;
  subtitle: string;
  reviews: ReleaseReview[];
  variant?: 'default' | 'alternate';
}

const ReleaseReviewsSection = ({
  title,
  subtitle,
  reviews,
  variant = 'default',
}: ReleaseReviewsSectionProps) => {
  if (reviews.length === 0) return null;

  return (
    <Section variant={variant}>
      <SectionHeading
        icon={Quote}
        title={title}
        subtitle={subtitle}
        className="mb-10"
      />
      <div className={`grid grid-cols-1 ${reviews.length > 1 ? 'md:grid-cols-2' : ''} gap-5 max-w-4xl mx-auto`}>
        {reviews.map((review) => (
          <figure
            key={review.id}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-7 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col"
          >
            <div className="flex items-center gap-1 mb-3" aria-label={`${review.rating} / 5`}>
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" aria-hidden="true" />
              ))}
            </div>
            <blockquote className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4 flex-1">
              &ldquo;{review.content}&rdquo;
            </blockquote>
            <figcaption className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="font-medium text-gray-700 dark:text-gray-300">{review.author}</span>
              <span>{review.category || review.categoryKey}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
};

export default ReleaseReviewsSection;
