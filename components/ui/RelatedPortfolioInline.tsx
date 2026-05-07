import React from 'react';
import Link from 'next/link';
import { ArrowRight, Disc } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import PortfolioMiniCard from './PortfolioMiniCard';
import type { PortfolioItem } from '../../types/data';
import type { Locale } from '../../lib/i18n';

interface RelatedPortfolioInlineProps {
  items: PortfolioItem[];
  locale: Locale;
}

/**
 * 스토리 본문과 StoryCTA 사이에 끼워 넣는 portfolio 추천 섹션.
 * 가이드를 읽은 사용자에게 실제 작업 결과물을 보여줘 가이드 → 결과물 → 예약
 * 동선을 잇는 역할을 한다. 비대상 카테고리 스토리는 호출 측에서 items=[] 전달.
 */
const RelatedPortfolioInline = ({ items, locale }: RelatedPortfolioInlineProps) => {
  const { t } = useTranslation('common', { lng: locale });

  if (!items || items.length === 0) return null;

  return (
    <aside
      aria-labelledby="story-related-portfolio-heading"
      className="mb-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-6 sm:p-8"
    >
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center p-2.5 bg-primary/10 dark:bg-primary/20 rounded-full" aria-hidden="true">
            <Disc className="text-primary dark:text-primary-light" size={20} />
          </div>
          <h3
            id="story-related-portfolio-heading"
            className="typo-card-title text-gray-900 dark:text-white"
          >
            {t('stories.detail.relatedPortfolioTitle', { defaultValue: '스튜디오 놀이 작업한 실제 결과물' })}
          </h3>
        </div>
        <Link
          href={`/${locale}/portfolio`}
          prefetch={false}
          className="inline-flex items-center gap-1 typo-card-cta text-primary hover:underline min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          {t('stories.detail.viewAllPortfolio', { defaultValue: '전체 포트폴리오' })}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item) => (
          <PortfolioMiniCard key={item.id} item={item} locale={locale} />
        ))}
      </div>
    </aside>
  );
};

export default RelatedPortfolioInline;
