import React from 'react';
import { Star, MessageSquare, Quote } from '@/lib/lucide-icons';
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

    // 집계 평점 — JSON-LD(business.ts aggregateRating)에는 이미 있으나 UI에는 노출되지
    // 않아 사람 방문자가 볼 수 없었음. 스키마와 동일한 값을 화면에도 표시해 신뢰 신호 강화.
    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
        : '0.0';

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
                className="mb-8"
            />

            {reviewCount > 0 && (
                <div
                    className="flex items-center justify-center gap-2 mb-12 text-gray-700 dark:text-gray-200"
                    role="img"
                    aria-label={t('reviewSection.aggregateAria', {
                        rating: avgRating,
                        count: reviewCount,
                        defaultValue: `평균 평점 ${avgRating}점, 후기 ${reviewCount}개`,
                    })}
                >
                    <span className="flex" aria-hidden="true">
                        {FIVE_STARS.map((i) => (
                            <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
                        ))}
                    </span>
                    <span className="font-bold text-lg tabular-nums" aria-hidden="true">{avgRating}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400" aria-hidden="true">
                        · {t('reviewSection.aggregateCount', { count: reviewCount, defaultValue: `실제 이용 후기 ${reviewCount}개` })}
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                {/* 리뷰 schema는 JSON-LD(generateDefaultSchema의 LocalBusiness.review)
                    에서 완전 형태로 이미 출력됨. microdata로 중복 마킹 시 itemReviewed의
                    bare LocalBusiness가 4개씩 생겨 Google Rich Results 검사기 warning 양산.
                    의미 정보는 JSON-LD가 단독으로 모두 표현하므로 microdata 제거. */}
                {reviews.map((review, index) => (
                    <div key={`${review.author}-${review.categoryKey}-${review.datePublished}`}>
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
                                    className="flex items-center mb-4"
                                    role="img"
                                    aria-label={t('reviewSection.ratingAria', {
                                        rating: review.rating,
                                        defaultValue: `평점 ${review.rating}점`,
                                    })}
                                >
                                    {FIVE_STARS.slice(0, review.rating).map((i) => (
                                        <Star key={i} size={18} className="text-yellow-400 fill-yellow-400 mr-1" aria-hidden="true" />
                                    ))}
                                </div>

                                <p className={`typo-card-body text-lg leading-relaxed mb-8 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                                    &quot;{review.content}&quot;
                                </p>

                                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-6">
                                    <div>
                                        <span className="block font-bold typo-card-title text-base mb-1">
                                            {review.author}
                                        </span>
                                        <span className="text-sm text-primary font-semibold">
                                            {review.category}
                                        </span>
                                        {review.datePublished && (
                                            <span className="block text-xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
                                                {review.datePublished.replace(/-/g, '.')}
                                            </span>
                                        )}
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
