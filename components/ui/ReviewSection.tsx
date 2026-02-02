import React from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, Quote } from 'lucide-react';
import BaseCard from './BaseCard';

interface Review {
    author: string;
    rating: number;
    content: string;
    category?: string;
}

export const reviews: Review[] = [
    {
        author: "김*준",
        rating: 5,
        category: "음반 프로덕션",
        content: "단순히 녹음만 하는 곳이 아니라, 아티스트가 가진 의도를 깊게 이해하고 제가 원하는 음악적 방향으로 갈 수 있게 세심하게 가이드해주십니다. 덕분에 첫 음반임에도 불구하고 생각했던 것 이상으로 멋진 결과물이 나왔어요."
    },
    {
        author: "이*정",
        rating: 5,
        category: "셀프 축가 녹음",
        content: "결혼식 셀프 축가 녹음은 처음이라 긴장을 많이 했는데, 단순한 녹음을 넘어 곡의 감정선까지 잘 잡아주셨어요. 제가 원했던 따뜻한 느낌이 소리에 고스란히 담길 수 있도록 디렉팅해주신 덕분에 평생 잊지 못할 선물을 만들었습니다."
    },
    {
        author: "박*현",
        rating: 5,
        category: "믹싱 & 마스터링",
        content: "추상적으로 표현한 아이디어들을 소리로 구체화하는 능력이 탁월하십니다. 믹싱 과정에서도 소통이 정말 잘 돼서 제가 머릿속으로만 그리던 사운드를 실제로 듣게 됐을 때 전율이 돋았네요. 아티스트의 고집과 대중성 사이의 밸런스를 정말 잘 잡아주십니다."
    },
    {
        author: "최*민",
        rating: 5,
        category: "방음 연습실",
        content: "여러 연습실을 다녀봤지만, 여기만큼 작업에만 몰입할 수 있는 쾌적한 곳은 없었습니다. 특히 공조 시스템이 완벽해서 장시간 작업해도 머리가 아프지 않고, 방음 퀄리티가 전문 스튜디오 급이라 새벽에도 소음 걱정 없이 작업할 수 있어요."
    }
];

const ReviewSection = () => {
    return (
        <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="typo-section-title mb-4 dark:text-white">
                            아티스트와 함께 만드는 <span className="text-primary italic">감동의 기록</span>
                        </h2>
                        <p className="typo-section-lead text-gray-600 dark:text-gray-400">
                            스튜디오 놀을 거쳐간 많은 분들이 증명하는 기술력과 진정성입니다.
                        </p>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                    {reviews.map((review, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <BaseCard
                                variant="default"
                                className="p-8 h-full relative border border-gray-100 dark:border-gray-800 hover:shadow-2xl transition-all duration-500 group"
                            >
                                <div className="absolute top-6 right-8 text-primary/10 group-hover:text-primary/20 transition-colors">
                                    <Quote size={60} />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center mb-4">
                                        {[...Array(review.rating)].map((_, i) => (
                                            <Star key={i} size={18} className="text-yellow-400 fill-yellow-400 mr-1" />
                                        ))}
                                    </div>

                                    <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed mb-8 font-pretendard break-keep">
                                        &quot;{review.content}&quot;
                                    </p>

                                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-6">
                                        <div>
                                            <span className="block font-bold text-gray-900 dark:text-white mb-1">
                                                {review.author} 님
                                            </span>
                                            <span className="text-sm text-primary font-semibold">
                                                {review.category}
                                            </span>
                                        </div>
                                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                            <MessageSquare size={20} />
                                        </div>
                                    </div>
                                </div>
                            </BaseCard>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ReviewSection;
