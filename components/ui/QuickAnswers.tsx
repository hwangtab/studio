import React from 'react';
import SectionHeading from './SectionHeading';
import Section from './Section';
import BaseCard from './BaseCard';

interface QuickAnswerItem {
  question: string;
  answer: string;
}

type QuickAnswersTone = 'canvas' | 'warm' | 'deep';

interface QuickAnswersProps {
  items: QuickAnswerItem[];
  title?: string;
  subtitle?: string;
  /** @deprecated use tone instead */
  variant?: string;
  tone?: QuickAnswersTone;
  className?: string;
}

const QuickAnswers = ({
  items,
  title = '빠른 답변',
  subtitle = '자주 묻는 질문을 한눈에 확인하세요.',
  tone = 'canvas',
  className,
}: QuickAnswersProps) => {
  if (!items || items.length === 0) return null;

  return (
    <Section tone={tone} className={className}>
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          eyebrow="Quick Answers"
          title={title}
          lead={subtitle}
          align="center"
          className="mb-8"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, index) => (
            <BaseCard
              key={`${item.question}-${index}`}
              variant="default"
              hover
              className="p-6 h-full flex flex-col bg-canvas-warm border-hairline"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-muted-60 dark:text-on-dark-soft mb-3">
                Q{index + 1}
              </div>
              <h3 className="text-title-md text-ink dark:text-on-dark mb-3 min-h-[3.5rem]">
                {item.question}
              </h3>
              <p className="text-[15px] text-ink-muted-80 dark:text-on-dark-soft leading-[1.6] flex-grow">
                {item.answer}
              </p>
            </BaseCard>
          ))}
        </div>
      </div>
    </Section>
  );
};

export default QuickAnswers;
