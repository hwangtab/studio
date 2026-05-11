import React from 'react';
import { LucideIcon, Sun, Thermometer, Wind, Lightbulb, Droplets, Coffee, ShieldCheck, MapPin, Sparkles } from 'lucide-react';
import BaseCard from '../ui/BaseCard';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';
import type { Locale } from '../../lib/i18n';

const FACILITIES_ICONS: LucideIcon[] = [Sun, Thermometer, Wind, Lightbulb, Droplets, Coffee, ShieldCheck, MapPin];

export interface FacilityItem {
  title: string;
  description: string;
}

const FacilityCard = ({
  icon: Icon,
  title,
  description,
  delay = 0,
  locale,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
  locale: Locale;
}) => (
  <BaseCard variant="default" delay={delay} className="p-5 h-full">
    <div className="flex items-start gap-3">
      <div className="bg-primary/10 dark:bg-primary/20 p-2.5 rounded-full text-primary dark:text-primary-light flex-shrink-0">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <h3 className={`typo-card-subtitle mb-1 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
          {title}
        </h3>
        <p className={`typo-card-body text-gray-600 dark:text-gray-300 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
          {description}
        </p>
      </div>
    </div>
  </BaseCard>
);

interface FacilitiesGridProps {
  title: string;
  subtitle: string;
  items: FacilityItem[];
  locale: Locale;
}

const FacilitiesGrid = ({ title, subtitle, items, locale }: FacilitiesGridProps) => (
  <Section variant="alternate" defer>
    <SectionHeading
      icon={Sparkles}
      title={title}
      subtitle={subtitle}
      titleClassName="text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
      className="mb-10"
    />
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, idx) => (
        <FacilityCard
          key={idx}
          icon={FACILITIES_ICONS[idx] ?? Sparkles}
          title={item.title}
          description={item.description}
          delay={0.04 * idx}
          locale={locale}
        />
      ))}
    </div>
  </Section>
);

export default FacilitiesGrid;
