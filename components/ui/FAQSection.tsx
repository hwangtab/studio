import React, { useState } from 'react';
import { motion, AnimatePresence as AnimatePresenceOrig } from 'framer-motion';
const AnimatePresence = AnimatePresenceOrig as any;
import { Plus, Minus, HelpCircle } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQSectionProps {
    items: FAQItem[];
    title?: string;
    subtitle?: string;
    className?: string;
}

const FAQSection: React.FC<FAQSectionProps> = ({
    items,
    title = "자주 묻는 질문",
    subtitle = "스튜디오 이용에 대해 궁금한 점들을 모았습니다.",
    className = "py-24 bg-gray-50 dark:bg-gray-800/30"
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const toggleAccordion = (index: number) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    return (
        <section className={className}>
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-primary/10 text-primary dark:text-primary-light"
                    >
                        <HelpCircle size={32} />
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="typo-section-title font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
                    >
                        {title}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="typo-section-lead text-gray-600 dark:text-gray-400"
                    >
                        {subtitle}
                    </motion.p>
                </div>

                <div className="space-y-4">
                    {items.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <button
                                onClick={() => toggleAccordion(index)}
                                className="w-full text-left px-6 py-5 flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-gray-750"
                                aria-expanded={activeIndex === index}
                            >
                                <span className="text-lg font-title font-bold text-gray-800 dark:text-gray-200 leading-tight pr-8">
                                    {item.question}
                                </span>
                                <span className="flex-shrink-0 text-primary dark:text-primary-light">
                                    {activeIndex === index ? (
                                        <Minus className="w-6 h-6" />
                                    ) : (
                                        <Plus className="w-6 h-6" />
                                    )}
                                </span>
                            </button>

                            <AnimatePresence initial={false}>
                                {activeIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                    >
                                        <div className="px-6 pb-6 pt-2 text-gray-600 dark:text-gray-400 text-lg leading-relaxed border-t border-gray-100 dark:border-gray-750">
                                            {item.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FAQSection;
