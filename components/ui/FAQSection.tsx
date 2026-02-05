import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Minus, HelpCircle } from 'lucide-react';
import SectionHeading from './SectionHeading';
import { Section, SectionVariant } from './Section';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQSectionProps {
    items: FAQItem[];
    title?: string;
    subtitle?: string;
    className?: string;
    variant?: SectionVariant;
}

const FAQSection: React.FC<FAQSectionProps> = ({
    items,
    title = "자주 묻는 질문",
    subtitle = "스튜디오 이용에 대해 궁금한 점들을 모았습니다.",
    className,
    variant = "alternate"
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const toggleAccordion = (index: number) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    return (
        <Section variant={variant} className={className}>
            <div className="max-w-4xl mx-auto">
                <SectionHeading
                    icon={HelpCircle}
                    title={title}
                    subtitle={subtitle}
                    className="mb-12"
                />

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
                                type="button"
                                onClick={() => toggleAccordion(index)}
                                className="w-full text-left px-6 py-5 flex items-start justify-between transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 min-w-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                                aria-expanded={activeIndex === index}
                            >
                                <span className="text-lg font-title font-bold text-gray-800 dark:text-gray-200 leading-tight pr-8 min-w-0 break-words flex-1">
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
        </Section>
    );
};

export default FAQSection;
