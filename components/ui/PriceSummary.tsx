import React from 'react';
import { cn } from '../../lib/utils';
import { formatPriceAmount } from '../../data/pricing';
import { Panel } from './Panel';

/**
 * 금액 요약 — 항목별 줄 + 부가세 + 합계.
 *
 * 2026-10-04 조사: 예약은 "상품가 + VAT = 합계" 한 줄 회색 박스, 펀딩은 항목별 `dl`,
 * 견적은 `text-3xl` 틴트 박스. **합계만 단독 표기 금지**(PriceBreakdown의 원칙)는 지키되
 * 모양을 하나로 모은다. 숫자는 `formatPriceAmount`만 쓴다(리터럴 toLocaleString 금지).
 */
export interface PriceLine {
  label: React.ReactNode;
  /** 줄 금액(단가 × 수량이 끝난 값). 음수는 할인으로 표시한다. */
  amount: number;
  quantity?: number;
  /** 수량 단위("곡"·"개"). quantity가 있을 때만 쓴다. */
  unit?: string;
  note?: React.ReactNode;
}

export interface PriceSummaryProps {
  items: PriceLine[];
  /** 부가세 줄. 없으면 생략(이미 포함가인 펀딩). */
  vat?: number;
  vatLabel?: React.ReactNode;
  total: number;
  totalLabel?: React.ReactNode;
  /** 합계 아래 작은 글(결제 시점·환불 기준 등). */
  note?: React.ReactNode;
  className?: string;
}

const won = (n: number) => `${n < 0 ? '−' : ''}${formatPriceAmount(Math.abs(n))}원`;

export const PriceSummary = ({ items, vat, vatLabel = '부가세', total, totalLabel = '합계', note, className }: PriceSummaryProps) => (
  <Panel className={cn('tabular-nums', className)} aria-label="금액 요약">
    <dl className="space-y-2 text-sm">
      {items.map((line, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4">
          <dt className="min-w-0 text-gray-700 dark:text-gray-300">
            {line.label}
            {line.quantity !== undefined && (
              <span className="text-gray-500 dark:text-gray-400">
                {' '}× {line.quantity}
                {line.unit ?? ''}
              </span>
            )}
            {line.note && <span className="block typo-caption">{line.note}</span>}
          </dt>
          <dd className="shrink-0 text-gray-900 dark:text-white">{won(line.amount)}</dd>
        </div>
      ))}
      {vat !== undefined && (
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-gray-700 dark:text-gray-300">{vatLabel}</dt>
          <dd className="shrink-0 text-gray-900 dark:text-white">{won(vat)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-gray-200 pt-3 dark:border-gray-700">
        <dt className="font-semibold text-gray-900 dark:text-white">{totalLabel}</dt>
        <dd className="shrink-0 text-base font-bold text-gray-900 dark:text-white">{won(total)}</dd>
      </div>
    </dl>
    {note && <p className="mt-3 typo-caption">{note}</p>}
  </Panel>
);
