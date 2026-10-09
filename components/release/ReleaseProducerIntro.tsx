import React from 'react';
import { Award } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import ResponsiveImage from '../ResponsiveImage';
import { studioOperator } from '../../data/siteConfig';
import { useDesignEdition } from '../../lib/designEdition';

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
}: ReleaseProducerIntroProps) => {
  const edition = useDesignEdition();

  // v2: 홈 프로듀서 섹션과 같은 문법 — 큰 사진 + 이름을 섹션 제목으로 + 굵은 선 위의 수치.
  // v1(원형 아이콘·가운데 정렬·보라 수치 카드)은 아래 그대로 둔다.
  if (edition === 'v2') {
    return (
      <Section variant="alternate">
        <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 items-center">
          <ResponsiveImage
            src={studioOperator.portrait.src}
            alt={sectionTitle}
            width={studioOperator.portrait.width}
            height={studioOperator.portrait.height}
            sizes="(max-width: 768px) 100vw, 480px"
            containerClassName="aspect-square w-full max-w-md overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
            className="w-full h-full object-cover"
          />
          <div>
            <SectionHeading eyebrow={tagline} title={sectionTitle} className="mb-6 md:mb-8" />
            <div className="space-y-3 mb-10">
              {bodyParagraphs.filter(Boolean).map((paragraph, index) => (
                <p key={index} className="typo-card-body text-gray-700 dark:text-gray-300">
                  {paragraph}
                </p>
              ))}
            </div>
            {stats.length > 0 && (
              <dl className="grid grid-cols-3 gap-6 border-t-2 border-gray-950 dark:border-white pt-6">
                {stats.map((stat, index) => (
                  <div key={`${stat.value}-${index}`} className="flex flex-col-reverse">
                    <dt className="typo-card-meta text-gray-600 dark:text-gray-300 mt-2 break-keep">{stat.label}</dt>
                    <dd className="font-title text-4xl md:text-5xl font-bold tabular-nums leading-none text-gray-950 dark:text-white">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </Section>
    );
  }

  return (
  <Section variant="alternate">
    <div className="max-w-3xl mx-auto">
      <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-5">
          <Award size={32} className="text-gray-700 dark:text-gray-300" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-title font-bold text-gray-900 dark:text-white mb-2">
          {sectionTitle}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-6">
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
                <p className="text-2xl sm:text-3xl font-bold text-gray-950 dark:text-white mb-1">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </Section>
  );
};

export default ReleaseProducerIntro;
