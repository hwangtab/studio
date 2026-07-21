import React from 'react';
import { Award } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';

export interface ReleaseProducerStat {
  value: string;
  label: string;
}

interface ReleaseProducerIntroProps {
  sectionTitle: string;
  tagline: string;
  bodyParagraphs: string[];
  stats: ReleaseProducerStat[];
}

const ReleaseProducerIntro = ({
  sectionTitle,
  tagline,
  bodyParagraphs,
  stats,
}: ReleaseProducerIntroProps) => (
  <Section variant="alternate">
    <div className="max-w-3xl mx-auto">
      <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-5">
          <Award size={32} className="text-primary" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-title font-bold text-gray-900 dark:text-white mb-2">
          {sectionTitle}
        </h2>
        <p className="text-sm text-primary font-medium mb-6">
          {tagline}
        </p>
        <div className="text-left sm:text-center space-y-3 max-w-xl mx-auto mb-8">
          {bodyParagraphs.filter(Boolean).map((paragraph, index) => (
            <p key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-100 dark:border-gray-700">
            {stats.map((stat, index) => (
              <div key={`${stat.value}-${index}`}>
                <p className="text-2xl sm:text-3xl font-bold text-primary mb-1">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </Section>
);

export default ReleaseProducerIntro;
