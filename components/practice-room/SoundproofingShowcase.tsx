import React from 'react';
import { LucideIcon, Shield, Layers, Volume2, Leaf, Sparkles, ShieldCheck } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage';
import { Section } from '../ui/Section';
import type { Locale } from '../../lib/i18n';

const SOUNDPROOFING_ICONS: LucideIcon[] = [Shield, Layers, Volume2, Leaf, Sparkles];

export interface SoundproofingItem {
  title: string;
  description: string;
}

interface SoundproofingShowcaseProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: SoundproofingItem[];
  locale: Locale;
}

const SoundproofingShowcase = ({
  eyebrow,
  title,
  subtitle,
  items,
  locale,
}: SoundproofingShowcaseProps) => (
  <Section variant="alternate" defer>
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold shadow-sm">
          <ShieldCheck size={14} aria-hidden="true" />
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
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-center">
        <div className="rounded-2xl overflow-hidden shadow-lg aspect-[4/3] md:aspect-auto md:h-full">
          <ResponsiveImage
            src="/images/room5.webp"
            alt={title}
            className="w-full h-full object-cover"
            pictureClassName="block h-full"
            loading="lazy"
            sizes="(min-width: 768px) 42vw, 100vw"
            fill
          />
        </div>
        <ul className="space-y-4">
          {items.map((item, idx) => {
            const Icon = SOUNDPROOFING_ICONS[idx] ?? Shield;
            return (
              <li key={idx} className="flex items-start gap-3">
                <div className="bg-gradient-to-br from-primary to-secondary p-2.5 rounded-full text-white flex-shrink-0">
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <p
                    className={`font-semibold text-gray-900 dark:text-gray-100 mb-0.5 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
                  >
                    {item.title}
                  </p>
                  <p
                    className={`typo-card-body text-gray-600 dark:text-gray-300 ${locale === 'ko' ? 'break-keep' : 'break-words'}`}
                  >
                    {item.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  </Section>
);

export default SoundproofingShowcase;
