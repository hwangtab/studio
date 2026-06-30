import React from 'react';
import { MessageCircle } from '@/lib/lucide-icons';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';

export interface ReleaseConsultationStep {
  num: string;
  title: string;
  desc: string;
}

interface ReleaseConsultationStepsProps {
  title: string;
  subtitle: string;
  steps: ReleaseConsultationStep[];
  variant?: 'default' | 'alternate';
}

const ReleaseConsultationSteps = ({
  title,
  subtitle,
  steps,
  variant = 'default',
}: ReleaseConsultationStepsProps) => {
  if (steps.length === 0) return null;

  return (
    <Section variant={variant}>
      <SectionHeading
        icon={MessageCircle}
        title={title}
        subtitle={subtitle}
        className="mb-10"
      />
      <div className="max-w-xl mx-auto">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <div key={`${step.num}-${index}`} className="flex gap-4">
              <div className="flex-shrink-0 flex flex-col items-center self-stretch">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step.num}
                </div>
                {!isLast && (
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1.5" />
                )}
              </div>
              <div className={`flex-1 pt-1 ${!isLast ? 'pb-6' : ''}`}>
                <p className="font-bold text-gray-900 dark:text-white mb-1">{step.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
};

export default ReleaseConsultationSteps;
