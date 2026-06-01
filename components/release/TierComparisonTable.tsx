import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle } from 'lucide-react';
import type { Locale } from '../../lib/i18n';

interface TierComparisonTableProps {
  locale: Locale;
  /**
   * highlightTier: 어느 티어 컬럼을 하이라이트할지. hub 페이지에서는 undefined,
   * 티어 페이지에서는 현재 티어를 전달.
   */
  highlightTier?: 'single' | 'ep' | 'album';
}

type Tier = 'single' | 'ep' | 'album';
const TIERS: Tier[] = ['single', 'ep', 'album'];

/**
 * 3티어(싱글·EP·정규) 비교표 — 호흡·베이스 단가·곡수·페르소나·핵심 포함을 한눈에.
 * Hub 페이지와 Tier 페이지의 결정 보조 컴포넌트로 사용.
 * 모바일에서는 가로 스크롤.
 */
const TierComparisonTable: React.FC<TierComparisonTableProps> = ({ locale, highlightTier }) => {
  const { t } = useTranslation('common', { lng: locale });
  const getLink = (path: string) => `/${locale}${path}`;
  const rowLabels = t('releaseProject.tiers.comparisonTable.rowLabels', { returnObjects: true }) as {
    duration: string;
    basePrice: string;
    trackCount: string;
    persona: string;
    keyDeliverables: string;
  };
  const values = t('releaseProject.tiers.comparisonTable.values', { returnObjects: true }) as Record<
    Tier,
    { trackCount: string; persona: string; keyDeliverables: string }
  >;

  return (
    <div className="max-w-5xl mx-auto overflow-x-auto">
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 p-4 align-bottom w-32" />
            {TIERS.map((tier) => {
              const isHighlight = highlightTier === tier;
              return (
                <th
                  key={tier}
                  className={`text-left p-4 align-bottom ${
                    isHighlight
                      ? 'bg-primary/5 dark:bg-primary/10 rounded-t-2xl border-t-2 border-x-2 border-primary'
                      : ''
                  }`}
                  scope="col"
                >
                  <span className="block text-base font-bold text-gray-900 dark:text-white">
                    {t(`releaseProject.tiers.${tier}.label`)}
                  </span>
                  <span className="block text-xs text-primary font-medium mt-1">
                    {t(`releaseProject.tiers.${tier}.range`)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {(['duration', 'trackCount', 'persona', 'keyDeliverables'] as const).map((rowKey) => (
            <tr key={rowKey} className="border-t border-gray-100 dark:border-gray-700">
              <th
                scope="row"
                className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 p-4 align-top whitespace-nowrap"
              >
                {rowLabels[rowKey]}
              </th>
              {TIERS.map((tier) => {
                const isHighlight = highlightTier === tier;
                let cellValue: string;
                if (rowKey === 'duration') {
                  cellValue = t(`releaseProject.tiers.${tier}.duration`);
                } else {
                  cellValue = values[tier][rowKey];
                }
                return (
                  <td
                    key={tier}
                    className={`text-sm text-gray-700 dark:text-gray-300 p-4 align-top leading-relaxed ${
                      isHighlight ? 'bg-primary/5 dark:bg-primary/10 border-x-2 border-primary' : ''
                    }`}
                  >
                    {rowKey === 'keyDeliverables' ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle size={14} className="text-primary flex-shrink-0 mt-1" />
                        <span>{cellValue}</span>
                      </div>
                    ) : (
                      cellValue
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-gray-100 dark:border-gray-700">
            <th scope="row" className="p-4" />
            {TIERS.map((tier) => {
              const isHighlight = highlightTier === tier;
              return (
                <td
                  key={tier}
                  className={`p-4 align-top ${
                    isHighlight
                      ? 'bg-primary/5 dark:bg-primary/10 border-x-2 border-b-2 border-primary rounded-b-2xl'
                      : ''
                  }`}
                >
                  {highlightTier === tier ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium opacity-60">
                      {t('releaseProject.tiers.detailCta')} (현재)
                    </span>
                  ) : (
                    <Link
                      href={getLink(`/release-project/${tier}`)}
                      className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline underline-offset-2"
                    >
                      {t('releaseProject.tiers.detailCta')} <ArrowRight size={12} />
                    </Link>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TierComparisonTable;
