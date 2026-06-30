import React from 'react';
import type { LucideIcon } from '@/lib/lucide-icons';
import BaseCard from './BaseCard';
import SectionHeading from './SectionHeading';
import { Section } from './Section';

interface HubLocaleContentItem {
  heading: string;
  body: string;
}

interface HubLocaleContent {
  title: string;
  items: HubLocaleContentItem[];
}

interface HubLocaleContentSectionProps {
  content: HubLocaleContent | null | undefined;
  icon: LucideIcon;
  variant?: 'default' | 'alternate';
}

const HubLocaleContentSection: React.FC<HubLocaleContentSectionProps> = ({
  content,
  icon,
  variant = 'alternate',
}) => {
  if (!content) return null;

  return (
    <Section variant={variant}>
      <SectionHeading
        icon={icon}
        title={content.title}
        className="mb-8"
      />
      <div className="max-w-4xl mx-auto space-y-6">
        {content.items.map((item) => (
          <BaseCard key={item.heading} variant="default" className="p-6">
            <h3 className="typo-card-title mb-3 text-primary">{item.heading}</h3>
            <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>
          </BaseCard>
        ))}
      </div>
    </Section>
  );
};

export default HubLocaleContentSection;
