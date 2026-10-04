import React from 'react';
import { cn } from '../../lib/utils';
import { FOCUS_RING } from './focusRing';

/**
 * 단독 체크박스·라디오(동의·옵션 한 줄). 목록에서 고르는 것은 `Choice.tsx`.
 *
 * 2026-10-04 조사: 체크박스 11곳이 세 계열이었다 — `accent-primary`(펀딩),
 * `rounded border-gray-300 text-primary`(예약·연락처 — forms 플러그인이 없어 틴트 무효),
 * 무스타일(개설자). 크기도 h-4·h-5, 포커스도 `focus:`·`focus-visible:` 혼용.
 *
 * - 틴트는 `accent-primary` 하나. 크기 20px, 레이블 포함 터치 영역 44px.
 * - 레이블은 `<label>`로 감싼다 — 글자를 눌러도 토글된다.
 * - `focus-visible` 링은 입력 자체에 준다(단독이라 감쌀 카드가 없다).
 */
export const checkControlClass = cn('h-5 w-5 shrink-0 accent-primary', FOCUS_RING);

interface CheckBaseProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  label: React.ReactNode;
  /** 레이블 아래 작은 설명. */
  hint?: React.ReactNode;
  /** 레이블 색을 강하게(동의 문구처럼 본문 급으로 읽혀야 할 때). 기본은 보조 톤. */
  emphasis?: boolean;
  className?: string;
  /** 입력 엘리먼트의 className. 래퍼는 `className`. */
  inputClassName?: string;
}

const CheckBase = React.forwardRef<HTMLInputElement, CheckBaseProps & { type: 'checkbox' | 'radio' }>(
  ({ type, label, hint, emphasis, className, inputClassName, ...input }, ref) => {
    const hintId = React.useId();
    return (
      <label
        className={cn(
          'flex min-h-[44px] cursor-pointer items-start gap-3 py-2',
          input.disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        <input
          ref={ref}
          type={type}
          className={cn(checkControlClass, 'mt-0.5', inputClassName)}
          aria-describedby={hint ? hintId : input['aria-describedby']}
          {...input}
        />
        <span className="min-w-0">
          <span
            className={cn(
              'block text-sm leading-relaxed',
              emphasis ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200',
            )}
          >
            {label}
          </span>
          {hint && (
            <span id={hintId} className="mt-0.5 block typo-caption">
              {hint}
            </span>
          )}
        </span>
      </label>
    );
  },
);
CheckBase.displayName = 'CheckBase';

export const Checkbox = React.forwardRef<HTMLInputElement, CheckBaseProps>((props, ref) => (
  <CheckBase ref={ref} type="checkbox" {...props} />
));
Checkbox.displayName = 'Checkbox';

export const Radio = React.forwardRef<HTMLInputElement, CheckBaseProps>((props, ref) => (
  <CheckBase ref={ref} type="radio" {...props} />
));
Radio.displayName = 'Radio';
