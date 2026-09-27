import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { User } from '@/lib/lucide-icons';
import SectionHeading from '../ui/SectionHeading';
import { Section, type SectionVariant } from '../ui/Section';
import { studioOperator } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';

interface EngineerCreditProps {
  locale: Locale;
  variant?: SectionVariant;
}

// 서비스 LP에서 "누가 작업하나"에 답하는 블록.
//
// AI가 "어디에 맡길까"를 받으면 여러 업체를 나열하는데, 가격만으로는 우리를 1순위로 올릴
// 근거가 없다. 수상·크레딧은 /author에만 있었고 서비스 페이지 셋 어디에도 없었다
// (docs/proposals/aeo-geo-strategy-2026-09-26.md). 운영자가 녹음·믹싱·마스터링을 직접
// 한다는 사실과 제3자 보도로 확인 가능한 수상 한 줄만 싣는다 — 이력 전체는 /author가 맡는다.
//
// 크레딧 제목은 고유명사라 번역하지 않는다. 수상은 pressCoverage로 사이트 밖에서 확인되는
// 것(source: 'press')만 문구에 쓴다.
const FEATURED_CREDIT_TITLES = ['세민 〈여린잎〉', '이름을 모르는 먼 곳의 그대에게', '젠트리피케이션'] as const;

const EngineerCredit = ({ locale, variant = 'default' }: EngineerCreditProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const credits = studioOperator.credits.filter((c) =>
    (FEATURED_CREDIT_TITLES as readonly string[]).includes(c.title)
  );

  return (
    <Section variant={variant}>
      <SectionHeading icon={User} title={t('engineerCredit.title')} className="mb-8" />
      <div className="glass-card rounded-2xl p-6 md:p-8 max-w-3xl mx-auto">
        <p className="typo-card-subtitle mb-1">
          {studioOperator.name}
          <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-300">
            {studioOperator.jobTitleByLocale[locale] ?? studioOperator.jobTitleByLocale.ko}
          </span>
        </p>
        <p className="typo-card-body mb-4">{t('engineerCredit.body')}</p>
        <p className="typo-card-body mb-4">{t('engineerCredit.award')}</p>
        <p className="typo-card-meta text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t('engineerCredit.creditsLabel')}{' '}
          {credits.map((c) => `${c.title}(${c.year})`).join(' · ')}
        </p>
        <Link
          href={`/${locale}/author`}
          className="inline-flex items-center text-primary dark:text-primary-lighter font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-lighter focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded"
        >
          {t('engineerCredit.profileLink')}
        </Link>
      </div>
    </Section>
  );
};

export default EngineerCredit;
