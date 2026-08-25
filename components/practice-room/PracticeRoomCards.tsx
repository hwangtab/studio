import React from 'react';
import {
  Check,
  Globe2,
  HandCoins,
  MessageCircle,
  Mic,
  Newspaper,
  Sparkles,
  Speaker,
  ClipboardList,
  Wrench,
} from '@/lib/lucide-icons';
import type { LucideIcon } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import BaseCard from '../ui/BaseCard';

export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
}) => (
  <BaseCard variant="default" delay={delay} className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} aria-hidden="true" />
      </div>
      <h3 className="typo-card-title">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

export const PainPoint = ({
  icon: Icon,
  text,
  delay = 0,
  locale = 'ko',
}: {
  icon: LucideIcon;
  text: string;
  delay?: number;
  locale?: Locale;
}) => (
  <BaseCard variant="default" delay={delay} className="p-5 h-full">
    <div className="flex items-start">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-full mr-4 text-white flex-shrink-0">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className={`typo-card-body whitespace-normal ${locale === 'ko' ? 'break-keep' : 'break-words'}`}>{text}</p>
      </div>
    </div>
  </BaseCard>
);

export const TargetAudience = ({
  title,
  description,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  delay?: number;
}) => (
  <BaseCard variant="default" delay={delay} className="p-6 mb-4">
    <div className="flex items-center mb-2">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
        <Icon className="text-primary dark:text-primary-light" size={24} aria-hidden="true" />
      </div>
      <h3 className="typo-card-subtitle">{title}</h3>
    </div>
    <p className="typo-card-body">{description}</p>
  </BaseCard>
);

export interface BenefitItem {
  title: string;
  points: string[];
  valueBadge?: string;
}

export const BENEFIT_ICONS: LucideIcon[] = [
  Mic,
  Globe2,
  Newspaper,
  Speaker,
  MessageCircle,
  HandCoins,
  ClipboardList,
  Wrench,
];

export const BenefitCard = ({
  icon: Icon,
  title,
  points,
  valueBadge,
  delay = 0,
  locale,
  calendarLinkLabel,
  calendarLinkUrl,
}: {
  icon: LucideIcon;
  title: string;
  points: string[];
  valueBadge?: string;
  delay?: number;
  locale: Locale;
  calendarLinkLabel?: string;
  calendarLinkUrl?: string;
}) => (
  <BaseCard variant="default" delay={delay} className="p-6 h-full">
    <div className="flex items-center mb-4">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-full mr-4 text-white flex-shrink-0">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="typo-card-title">{title}</h3>
    </div>
    {valueBadge && (
      <div className="mb-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary/10 to-secondary/10 text-primary dark:text-primary-light border border-primary/20">
          <Sparkles size={12} aria-hidden="true" />
          {valueBadge}
        </span>
      </div>
    )}
    <ul className="space-y-2">
      {points.map((point, idx) => {
        const showLink =
          calendarLinkLabel && calendarLinkUrl && point.includes(calendarLinkLabel);
        return (
          <li key={idx} className="flex items-start gap-2">
            <Check
              className="text-primary dark:text-primary-light mt-1 flex-shrink-0"
              size={16}
              aria-hidden="true"
            />
            <span
              className={`typo-card-body ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
            >
              {showLink ? (
                <>
                  {point.split(calendarLinkLabel)[0]}
                  <a
                    href={calendarLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    /* URL은 공백이 없어 keep-all에서 끊길 자리가 없다 — 좁은 카드(3~4열
                       그리드)에서 카드 밖으로 넘치던 것을 break-all로 허용 */
                    className="text-primary underline hover:text-primary-dark break-all"
                  >
                    {calendarLinkLabel}
                  </a>
                  {point.split(calendarLinkLabel)[1]}
                </>
              ) : (
                point
              )}
            </span>
          </li>
        );
      })}
    </ul>
  </BaseCard>
);
