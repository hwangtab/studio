import React from 'react';
import { HelpCircle } from 'lucide-react';
import SectionHeading from './SectionHeading';
import { Section, SectionVariant } from './Section';
import BaseCard from './BaseCard';

interface QuickAnswerItem {
  question: string;
  answer: string;
}

interface QuickAnswersProps {
  items: QuickAnswerItem[];
  title?: string;
  subtitle?: string;
  variant?: SectionVariant;
  className?: string;
}

const QuickAnswers = ({
  items,
  title = '빠른 답변',
  subtitle = '자주 묻는 질문을 한눈에 확인하세요.',
  variant = 'default',
  className,
}: QuickAnswersProps) => {
  if (!items || items.length === 0) return null;

  return (
    <Section variant={variant} className={className}>
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          icon={HelpCircle}
          title={title}
          subtitle={subtitle}
          className="mb-8"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, index) => (
            <BaseCard
              key={`${item.question}-${index}`}
              variant="outline"
              className="p-6 h-full"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-3">
                Q{index + 1}
              </div>
              <h3 className="typo-card-title mb-3 text-gray-900 dark:text-gray-100">
                {item.question}
              </h3>
              <p className="typo-card-body text-gray-600 dark:text-gray-300">
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
