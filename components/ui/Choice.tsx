import React from 'react';
import { cn } from '../../lib/utils';
import { FOCUS_RING_WITHIN } from './focusRing';

/**
 * "하나(또는 여럿) 고르기" 항목 — 상품·리워드·티어·수단.
 *
 * 2026-10-04 조사에서 같은 역할이 6곳 5가지 모양이었다(예약 `rounded-md p-3`, 후원자 이름
 * `rounded-lg px-3 py-2`, 구독 티어 `rounded-xl p-4 ring-2`, 견적·목표액 알약 2벌 복제…).
 * 선택 상태도 셋, 포커스 링이 없는 곳이 넷, 네이티브 라디오에 `text-primary`를 줘서
 * 크롬 기본 파랑이 뜨는 곳이 둘이었다. 규칙은 하나로 줄인다(docs/design-system.md §4):
 *
 * - 카드 `rounded-xl p-4`, 알약 `rounded-full px-4 py-2`. 테두리 1px gray-200/700.
 * - 선택은 **틴트**(`border-primary bg-primary/5` + `ring-1 ring-primary/30`), 채움이 아니다.
 *   채움(`bg-primary text-white`)은 설명 없는 짧은 라벨(세그먼트·칩)에만 쓴다.
 * - 선택 판정은 `:has(:checked)` — JS 삼항으로 클래스를 바꾸지 않는다. 그래서 `checked`
 *   prop을 넘기든 비제어로 두든 모양이 같다.
 * - 입력 틴트는 `accent-primary`. `text-primary`는 forms 플러그인이 없어 네이티브 입력에
 *   아무 효과가 없다.
 * - 포커스 링은 입력이 아니라 **카드**에 그린다(`FOCUS_RING_WITHIN`).
 */

export type ChoiceVariant = 'card' | 'pill';

const CARD_CLASS = cn(
  'group relative flex cursor-pointer items-start gap-3 rounded-xl border p-4',
  'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
  'hover:border-primary/50 dark:hover:border-primary-lighter/50',
  'has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary/30',
  'dark:has-[:checked]:border-primary-lighter dark:has-[:checked]:bg-primary-lighter/10 dark:has-[:checked]:ring-primary-lighter/30',
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:disabled]:hover:border-gray-200 dark:has-[:disabled]:hover:border-gray-700',
  FOCUS_RING_WITHIN,
);

const PILL_CLASS = cn(
  'relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium',
  'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300',
  'hover:border-primary/50 dark:hover:border-primary-lighter/50',
  'has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-gray-900',
  'dark:has-[:checked]:border-primary-lighter dark:has-[:checked]:bg-primary-lighter/10 dark:has-[:checked]:text-white',
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
  FOCUS_RING_WITHIN,
);

/** 눈에 보이는 라디오·체크박스. 링은 카드가 그리므로 입력 자체의 outline은 끈다. */
const CARD_INPUT_CLASS = 'mt-0.5 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none';

export interface ChoiceCardProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'title' | 'children'> {
  /** 기본은 라디오. 여럿 고르는 목록(추가 옵션 등)은 `checkbox`. */
  type?: 'radio' | 'checkbox';
  variant?: ChoiceVariant;
  /** 항목 이름. 카드에서는 굵게, 알약에서는 라벨 그 자체. */
  title: React.ReactNode;
  /** 카드 전용 — 이름 아래 작은 설명(수량·조건). */
  description?: React.ReactNode;
  /** 카드 전용 — 오른쪽 끝(가격). `tabular-nums`로 자릿수가 맞는다. */
  trailing?: React.ReactNode;
  /** 카드 전용 — 설명 아래 추가 블록(스테퍼·메모). 클릭이 전파되지 않게 안쪽에서 처리할 것. */
  children?: React.ReactNode;
  /** 바깥 label의 className. 카드 간격은 ChoiceGroup이 준다. */
  className?: string;
}

export const ChoiceCard = React.forwardRef<HTMLInputElement, ChoiceCardProps>(
  ({ type = 'radio', variant = 'card', title, description, trailing, children, className, ...input }, ref) => {
    if (variant === 'pill') {
      return (
        <label className={cn(PILL_CLASS, className)}>
          <input ref={ref} type={type} className="sr-only" {...input} />
          <span>{title}</span>
        </label>
      );
    }

    return (
      <label className={cn(CARD_CLASS, className)}>
        <input ref={ref} type={type} className={CARD_INPUT_CLASS} {...input} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="typo-body font-medium text-gray-900 dark:text-white">{title}</span>
            {trailing !== undefined && trailing !== null && (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{trailing}</span>
            )}
          </span>
          {description && <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{description}</span>}
          {children && <span className="mt-3 block">{children}</span>}
        </span>
      </label>
    );
  },
);
ChoiceCard.displayName = 'ChoiceCard';

export interface ChoiceGroupProps {
  /** 그룹 이름(legend). 화면에 보인다 — 숨기려면 `hideLabel`. */
  label: React.ReactNode;
  hideLabel?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  variant?: ChoiceVariant;
  /** 카드 열 수. 알약은 flex-wrap이라 무시한다. */
  columns?: 1 | 2 | 3;
  className?: string;
  children: React.ReactNode;
}

const COLUMNS: Record<NonNullable<ChoiceGroupProps['columns']>, string> = {
  1: 'grid gap-2',
  2: 'grid gap-2 sm:grid-cols-2',
  3: 'grid gap-2 sm:grid-cols-3',
};

/**
 * ChoiceCard 묶음. `fieldset`/`legend`라 스크린리더가 그룹 이름을 각 항목 앞에 읽는다 —
 * `role="radiogroup"` + `aria-labelledby`를 손으로 배선하지 않아도 된다.
 */
export const ChoiceGroup = ({
  label,
  hideLabel,
  hint,
  error,
  variant = 'card',
  columns = 1,
  className,
  children,
}: ChoiceGroupProps) => {
  const errorId = React.useId();
  return (
    <fieldset className={cn('min-w-0', className)} aria-describedby={error ? errorId : undefined}>
      <legend className={cn('mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300', hideLabel && 'sr-only')}>
        {label}
      </legend>
      {hint && <p className="-mt-1 mb-2 typo-caption">{hint}</p>}
      <div className={variant === 'pill' ? 'flex flex-wrap gap-2' : COLUMNS[columns]}>{children}</div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 typo-caption text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
};
