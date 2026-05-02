import React, { useState } from 'react';
import { m } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import SectionHeading from './SectionHeading';

import { createInViewEnterAnimation } from '../../utils/animationUtils';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQSectionProps {
    items: FAQItem[];
    title?: string;
    subtitle?: string;
    className?: string;
    /** @deprecated — FAQSection no longer wraps a Section; pass tone to the parent Section. Kept for backward compat. */
    variant?: string;
}

const FAQ_PANEL_OPEN = { height: 'auto' as const, opacity: 1 };
const FAQ_PANEL_CLOSED = { height: 0, opacity: 0 };
const FAQ_PANEL_TRANSITION = { duration: 0.3, ease: 'easeInOut' as const };

const FAQSection: React.FC<FAQSectionProps> = ({
    items,
    title = "FAQ",
    subtitle = "Common questions about the studio.",
    className,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    variant: _variant,
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const toggleAccordion = (index: number) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    return (
        <div className={className}>
            <SectionHeading
                title={title}
                lead={subtitle}
                align="center"
            />

            <div className="max-w-3xl mx-auto">
                {items.map((item, index) => (
                    <m.div
                        key={index}
                        {...createInViewEnterAnimation({ distance: 10, delay: index * 0.05 })}
                        className="border-b border-hairline dark:border-white/10 last:border-b-0 py-4"
                    >
                        <button
                            id={`faq-button-${index}`}
                            type="button"
                            onClick={() => toggleAccordion(index)}
                            className="flex items-center justify-between w-full text-left text-title-sm text-ink dark:text-on-dark hover:text-ink-muted-80 transition-colors min-w-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
                            aria-expanded={activeIndex === index}
                            aria-controls={`faq-panel-${index}`}
                        >
                            <span className="leading-tight pr-6 min-w-0 break-words flex-1">
                                {item.question}
                            </span>
                            <ChevronDown
                                className={`flex-shrink-0 w-5 h-5 text-ink-muted-60 dark:text-on-dark-soft transition-transform duration-300 ${activeIndex === index ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                            />
                        </button>

                        <m.div
                            id={`faq-panel-${index}`}
                            role="region"
                            aria-labelledby={`faq-button-${index}`}
                            initial={false}
                            animate={activeIndex === index ? FAQ_PANEL_OPEN : FAQ_PANEL_CLOSED}
                            transition={FAQ_PANEL_TRANSITION}
                            className="overflow-hidden"
                            aria-hidden={activeIndex !== index}
                        >
                            <p className="text-ink-muted-80 dark:text-on-dark-soft leading-[1.7] mt-3 pb-2">
                                {item.answer}
                            </p>
                        </m.div>
                        {/* SSR-visible answer for crawlers (visually hidden when JS loads) */}
                        <noscript>
                            <p className="text-ink-muted-80 dark:text-on-dark-soft leading-[1.7] mt-3 pb-2">
                                {item.answer}
                            </p>
                        </noscript>
                    </m.div>
                ))}
            </div>
        </div>
    );
};

export default FAQSection;
