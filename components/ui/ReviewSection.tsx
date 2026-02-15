import React from 'react';
import { m } from 'framer-motion';
import { Star, MessageSquare, Quote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BaseCard from './BaseCard';
import SectionHeading from './SectionHeading';
import { Section, SectionVariant } from './Section';
import { STAGGER_CONTAINER, STAGGER_ITEM } from '../../utils/animationUtils';
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

            <m.div
                className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto"
                variants={STAGGER_CONTAINER}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
            >
                {reviews.map((review) => (
                    <m.div
                        key={`${review.author}-${review.categoryKey}-${review.datePublished}`}
                        className="group"
                        variants={STAGGER_ITEM}
                    >
                        <BaseCard
                            variant="default"
                            enableAnimation={false}
                            className="p-8 h-full relative group"
                        >
                            <div className="absolute top-6 right-8 text-primary/10 group-hover:text-primary/20 transition-colors" aria-hidden="true">
                                <Quote size={60} />
                            </div>

                            <div className="relative z-10">
                                <div
                                    className="flex items-center mb-4"
                                    aria-label={t('reviewSection.ratingAria', {
                                        rating: review.rating,
                                        defaultValue: `평점 ${review.rating}점`,
                                    })}
                                >
                                    {FIVE_STARS.slice(0, review.rating).map((i) => (
                                        <Star key={i} size={18} className="text-yellow-400 fill-yellow-400 mr-1" aria-hidden="true" />
                                    ))}
                                </div>

                                <p className={`typo-card-body text-lg leading-relaxed mb-8 font-pretendard ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
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
                                    </div>
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary" aria-hidden="true">
                                        <MessageSquare size={20} />
                                    </div>
                                </div>
                            </div>
                        </BaseCard>
                    </m.div>
                ))}
            </m.div>
        </Section >
    );
};

export default ReviewSection;
