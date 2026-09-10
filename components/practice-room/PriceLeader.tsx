import React from 'react';
import { Trophy, Wallet, Gift, Lock, CalendarDays, Check } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';
import type { Locale } from '../../lib/i18n';
import type { LucideIcon } from '@/lib/lucide-icons';

const PRICING_BADGE_ICONS: LucideIcon[] = [Wallet, Gift, Lock, CalendarDays];

export interface PricingBadge {
  label: string;
  caption: string;
}

interface PriceLeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  priceValue: string;
  priceCaption: string;
  badges: PricingBadge[];
  note: string;
  locale: Locale;
}

const PriceLeader = ({
  eyebrow,
  title,
  subtitle,
  priceLabel,
  priceValue,
  priceCaption,
  badges,
  note,
  locale,
}: PriceLeaderProps) => (
  <Section variant="default" className="py-12">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold shadow-sm">
          <Trophy size={14} aria-hidden="true" />
          {eyebrow}
        </span>
        <h2
          className={`text-heading-2 font-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent mt-4 mb-2 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
        >
          {title}
        </h2>
        <p className={`typo-body text-gray-600 dark:text-gray-300 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
          {subtitle}
        </p>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="text-center md:text-left md:border-r md:border-primary/20 md:pr-6">
          <p className="typo-caption text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {priceLabel}
          </p>
          <p className="text-4xl md:text-5xl font-bold text-primary dark:text-primary-light leading-tight">
            {priceValue}
          </p>
          <p className="typo-caption text-gray-500 dark:text-gray-400 mt-2">
            {priceCaption}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {badges.map((badge, idx) => {
            const BadgeIcon = PRICING_BADGE_ICONS[idx] ?? Check;
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-full text-primary dark:text-primary-light flex-shrink-0">
                  <BadgeIcon size={16} aria-hidden="true" />
                </div>
                <div>
                  <p className={`font-semibold text-gray-900 dark:text-gray-100 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {badge.label}
                  </p>
                  <p className={`typo-caption text-gray-600 dark:text-gray-400 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
                    {badge.caption}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className={`text-center typo-caption text-gray-500 dark:text-gray-400 mt-4 italic ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>
        {note}
      </p>
    </div>
  </Section>
);

export default PriceLeader;
