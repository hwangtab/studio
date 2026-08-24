import React from 'react';
import { HelpCircle } from '@/lib/lucide-icons';
import SectionHeading from './SectionHeading';
import { Section, SectionVariant } from './Section';
import BaseCard from './BaseCard';

interface QuickAnswerItem {
  question: string;
  answer: string;
}

interface QuickAnswersProps {
  items: QuickAnswerItem[];
  // 기본값 없이 필수 prop으로 강제(코드리뷰 후속) — 한국어 리터럴 기본값이 있으면
  // 새 페이지에서 prop을 빠뜨려도 타입 에러 없이 비-ko 방문자에게 한국어가 샌다.
  title: string;
  subtitle: string;
  variant?: SectionVariant;
  className?: string;
}

const QuickAnswers = ({
  items,
  title,
  subtitle,
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
              className="p-6 h-full flex flex-col"
            >
              {/* text-primary/70은 WCAG AA 미달(3.82:1) — text-primary-dark로 대비 확보. */}
              <div className="text-xs font-semibold uppercase tracking-widest text-primary-dark dark:text-primary-light mb-3">
                Q{index + 1}
              </div>
              <h3 className="typo-card-title mb-3 text-gray-900 dark:text-gray-100 min-h-[3.5rem]">
                {item.question}
              </h3>
              <p className="typo-card-body text-gray-600 dark:text-gray-300 flex-grow">
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
