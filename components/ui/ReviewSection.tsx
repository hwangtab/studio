import React from 'react';
import { Star, MessageSquare, Quote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BaseCard from './BaseCard';
import SectionHeading from './SectionHeading';
import { Section, SectionVariant } from './Section';
import { getReviews } from '../../data/reviews';
import type { Locale } from '../../lib/i18n';


// 별점 5점 고정이므로 상수 배열로 정의 (매 렌더마다 재생성 방지)
const FIVE_STARS = [0, 1, 2, 3, 4] as const;

interface ReviewSectionProps {
    className?: string;
    variant?: SectionVariant;
    locale?: Locale;
}

const ReviewSection = ({ className, variant = "default", locale = 'ko' }: ReviewSectionProps) => {
    const reviews = getReviews(locale);

    const { t } = useTranslation('common', { lng: locale });

    return (
        <Section variant={variant} className={className}>
            <SectionHeading
                icon={MessageSquare}
                title={(
                    <>
                        {t('reviewSection.titlePrefix', { defaultValue: '아티스트와 함께 만드는' })}{' '}
                        <span>{t('reviewSection.titleHighlight', { defaultValue: '감동의 기록' })}</span>
                    </>
                )}
                subtitle={t('reviewSection.subtitle', { defaultValue: '스튜디오 놀을 거쳐간 많은 분들이 증명하는 기술력과 진정성입니다.' })}
                className="mb-16"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                {reviews.map((review, index) => (
                    <div
                        key={`${review.author}-${review.categoryKey}-${review.datePublished}`}
                        itemScope
                        itemType="https://schema.org/Review"
                    >
                        <meta itemProp="datePublished" content={review.datePublished} />
                        <div itemProp="itemReviewed" itemScope itemType="https://schema.org/LocalBusiness">
                            <meta itemProp="name" content="Studio NOL" />
                        </div>
                        <BaseCard
                            variant="default"
                            delay={index * 0.08}
                            className="p-8 h-full relative group"
                        >
                            <div className="absolute top-6 right-8 text-primary/10 group-hover:text-primary/20 transition-colors" aria-hidden="true">
                                <Quote size={60} />
                            </div>

                            <div className="relative z-10">
                                <div
                                    itemProp="reviewRating"
                                    itemScope
                                    itemType="https://schema.org/Rating"
                                    className="flex items-center mb-4"
                                    role="img"
                                    aria-label={t('reviewSection.ratingAria', {
                                        rating: review.rating,
                                        defaultValue: `평점 ${review.rating}점`,
                                    })}
                                >
                                    <meta itemProp="ratingValue" content={String(review.rating)} />
                                    <meta itemProp="bestRating" content="5" />
                                    {FIVE_STARS.slice(0, review.rating).map((i) => (
                                        <Star key={i} size={18} className="text-yellow-400 fill-yellow-400 mr-1" aria-hidden="true" />
                                    ))}
                                </div>

                                <p itemProp="reviewBody" className={`typo-card-body text-lg leading-relaxed mb-8 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                                    &quot;{review.content}&quot;
                                </p>

                                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-6">
                                    <div>
                                        <span
                                            itemProp="author"
                                            itemScope
                                            itemType="https://schema.org/Person"
                                            className="block font-bold typo-card-title text-base mb-1"
                                        >
                                            <span itemProp="name">{review.author}</span>
                                        </span>
                                        <span className="text-sm text-primary font-semibold">
                                            {review.category}
                                        </span>
                                    </div>
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary" aria-hidden="true">
                                        <MessageSquare size={20} />
                                    </div>
                                </div>
                            </div>
                        </BaseCard>
                    </div>
                ))}
            </div>
        </Section >
    );
};

export default ReviewSection;
