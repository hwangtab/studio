import React from 'react';
import { cn } from '../../lib/utils';
import { Check } from '@/lib/lucide-icons';

/**
 * 단계 표시 — "1 상품 · 2 주문자 · 3 결제".
 *
 * 2026-10-04 조사: 예약·믹싱은 회색 글자 "STEP 1 / 2", 펀딩은 번호 원, 견적은 없음.
 * 하나로 통일한다. 완료 단계는 체크, 현재 단계는 보라 원 + 옅은 링, 남은 단계는 아웃라인.
 * 모바일에서는 현재 단계 이름만 남긴다(나머지는 `sm:` 이상).
 *
 * `aria-current="step"`과 sr-only 요약("3단계 중 2단계")을 함께 준다 — 색만으로 현재를
 * 알리지 않는다.
 */
export interface StepperProps {
  steps: string[];
  /** 1부터. */
  current: number;
  className?: string;
}

export const Stepper = ({ steps, current, className }: StepperProps) => (
  <nav aria-label="진행 단계" className={className}>
    <p className="sr-only">
      {steps.length}단계 중 {current}단계: {steps[current - 1]}
    </p>
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'current' : 'upcoming';
        return (
          <li key={label} className="flex min-w-0 items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                state === 'done' && 'bg-primary text-white',
                state === 'current' && 'bg-primary text-white ring-4 ring-primary/15 dark:ring-primary-lighter/20',
                state === 'upcoming' && 'border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400',
              )}
            >
              {state === 'done' ? <Check size={16} aria-hidden="true" /> : n}
            </span>
            <span
              className={cn(
                'truncate text-sm',
                state === 'current' ? 'font-semibold text-gray-900 dark:text-white' : 'hidden text-gray-500 dark:text-gray-400 sm:inline',
              )}
            >
              {label}
            </span>
            {n < steps.length && (
              <span aria-hidden="true" className={cn('h-px w-6 shrink-0', state === 'done' ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700')} />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
