import React from 'react';
import { m } from 'framer-motion';
import { Star, MessageSquare, Quote } from 'lucide-react';
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
    
    // Simple translation for title/subtitle
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

    return (
        <Section variant={variant} className={className}>
            <SectionHeading
                icon={MessageSquare}
                title={
                    locale === 'ko' ? (
                        <>
                            아티스트와 함께 만드는 <span>감동의 기록</span>
                        </>
                    ) : (
                        <>
                            {t("Creating Together:", "Creating Together:", "共同创造:", "Creando Juntos:", "Cùng tạo nên:", "สร้างร่วมกัน:", "Birga yaratamiz:")} <span>{t("Touching Records", "Touching Records", "感动的记录", "Registros Conmovedores", "Những khoảnh khắc lay động", "บันทึกที่ประทับใจ", "Ta’sirli xotiralar")}</span>
                        </>
                    )
                }
                subtitle={t(
                    "스튜디오 놀을 거쳐간 많은 분들이 증명하는 기술력과 진정성입니다.",
                    "Proven technology and sincerity verified by many who have visited Studio NOL.",
                    "这是经过 Studio NOL 的许多人证明的技术力量和真诚。",
                    "Tecnología probada y sinceridad verificada por muchos que han visitado Studio NOL.",
                    "Công nghệ và sự chân thành được nhiều người đã đến Studio NOL chứng thực.",
                    "เทคโนโลยีที่พิสูจน์แล้วและความจริงใจที่ได้รับการยืนยันจากผู้ที่เคยมา Studio NOL",
                    "Studio NOL’dan o‘tgan ko‘plab insonlar tasdiqlagan texnologiya va samimiyat."
                )}
                className="mb-16"
            />

            <m.div
                className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto"
                variants={STAGGER_CONTAINER}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
            >
                {reviews.map((review, index) => (
                    <m.div
                        key={index}
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
                                    aria-label={t(
                                        `평점 ${review.rating}점`,
                                        `Rating ${review.rating} stars`,
                                        `评分 ${review.rating} 分`,
                                        `Calificación ${review.rating} estrellas`,
                                        `Đánh giá ${review.rating} sao`,
                                        `คะแนน ${review.rating} ดาว`,
                                        `${review.rating} yulduzli baho`
                                    )}
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
        </Section>
    );
};

export default ReviewSection;
