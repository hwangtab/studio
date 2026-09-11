import React from 'react';
import { cn } from '../../lib/utils';

export interface ServicePriceRow {
  id: string;
  label: React.ReactNode;
  subLabel?: React.ReactNode;
  price: React.ReactNode;
  unit?: React.ReactNode;
}

export interface ServicePriceGroup {
  id: string;
  /** 생략하면 그룹 헤더 행을 렌더하지 않는다 (단일 그룹 표에 적합). */
  title?: React.ReactNode;
  rows: ServicePriceRow[];
}

interface ServicePriceTableProps {
  /** 스크린리더 전용 caption. 시각적 제목은 페이지가 SectionHeading으로 별도 렌더. */
  caption: string;
  groups: ServicePriceGroup[];
  serviceColLabel: string;
  priceColLabel: string;
  className?: string;
}

/**
 * pages/[locale]/pricing.tsx의 "한눈에 보는 가격표" 요약 표와 같은 시각 언어를
 * 서비스 랜딩(recording·mixing-mastering)에서 재사용하는 시맨틱 <table>.
 *
 * 데이터는 호출부가 data/pricing.ts SSOT(recordingOffers·mixingOffers·masteringOffers)에서
 * 만들어 넘긴다 — 이 컴포넌트는 가격 리터럴을 갖지 않는다. 카드 섹션과 같은 정보를
 * AI 추출성 좋은 <table> 마크업으로 한 번 더 표현하는 용도.
 */
const ServicePriceTable = ({ caption, groups, serviceColLabel, priceColLabel, className }: ServicePriceTableProps) => (
  <div className={cn('max-w-3xl mx-auto overflow-x-auto', className)}>
    <table className="w-full text-left border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b-2 border-gray-200 dark:border-gray-700">
          <th scope="col" className="py-3 pr-4 typo-card-subtitle">
            {serviceColLabel}
          </th>
          <th scope="col" className="py-3 pl-4 text-right typo-card-subtitle">
            {priceColLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group, groupIndex) => (
          <React.Fragment key={group.id}>
            {group.title && (
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={2}
                  className={cn(
                    'typo-card-title pb-3 text-gray-900 dark:text-white',
                    groupIndex === 0 ? 'pt-5' : 'pt-10'
                  )}
                >
                  {group.title}
                </th>
              </tr>
            )}
            {group.rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                <th scope="row" className="py-3 pr-4 font-normal align-top">
                  <div className="typo-card-body font-medium text-gray-900 dark:text-gray-100">{row.label}</div>
                  {row.subLabel && (
                    <div className="typo-card-meta text-gray-500 dark:text-gray-400 mt-0.5">{row.subLabel}</div>
                  )}
                </th>
                <td className="py-3 pl-4 text-right whitespace-nowrap align-top">
                  <span className="font-bold text-primary dark:text-primary-lighter tabular-nums">{row.price}</span>
                  {row.unit && <span className="typo-card-meta"> {row.unit}</span>}
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
);

export default ServicePriceTable;
