import React from 'react';
import { HelpCircle } from '@/lib/lucide-icons';
import SectionHeading from './SectionHeading';
import { Section, SectionVariant } from './Section';
import RuleList from './RuleList';

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
        {/* 라이너 노트 §3-5: 카드 세 장 → 괘선 목록(홈 "이유" 절과 같은 문법). 읽는 것은 카드가 아니다. */}
        <RuleList
          numbered
          labelPrefix="Q"
          columns={3}
          items={items.map((item) => ({ heading: item.question, body: item.answer }))}
        />
      </div>
    </Section>
  );
};

export default QuickAnswers;
