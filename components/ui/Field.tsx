import React from 'react';
import { cn } from '../../lib/utils';

/**
 * 폼 컨트롤 공용 클래스. 반경·포커스·다크모드는 docs/design-system.md §3·§5가 정본이다.
 * 폼마다 input 클래스 문자열을 새로 만들지 않는다 — 2026-09-11 감사에서 최소 4벌
 * (rounded-md/lg/xl)이 흩어져 있었다.
 */
export const fieldControlClass = cn(
  'w-full rounded-lg border px-3 py-2 typo-body',
  'bg-white text-gray-900 placeholder:text-gray-400',
  'dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500',
  'border-gray-300 dark:border-gray-600',
  'transition-[colors,box-shadow] duration-fast ease-standard',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

const invalidClass = 'border-red-500 dark:border-red-500';

type ControlProps<T> = T & { invalid?: boolean };

export const TextInput = React.forwardRef<HTMLInputElement, ControlProps<React.InputHTMLAttributes<HTMLInputElement>>>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(fieldControlClass, invalid && invalidClass, className)} {...props} />
  ),
);
TextInput.displayName = 'TextInput';

export const TextArea = React.forwardRef<HTMLTextAreaElement, ControlProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>>>(
  ({ className, invalid, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldControlClass, 'min-h-[8rem]', invalid && invalidClass, className)} {...props} />
  ),
);
TextArea.displayName = 'TextArea';

export const Select = React.forwardRef<HTMLSelectElement, ControlProps<React.SelectHTMLAttributes<HTMLSelectElement>>>(
  ({ className, invalid, ...props }, ref) => (
    <select ref={ref} className={cn(fieldControlClass, invalid && invalidClass, className)} {...props} />
  ),
);
Select.displayName = 'Select';

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  /** 컨트롤 엘리먼트 하나. id는 Field의 id와 같아야 레이블이 연결된다. */
  children: React.ReactElement;
}

/**
 * 레이블·필수 표시·도움말·에러를 한 자리에서 배선한다. 컨트롤에는 aria-required·
 * aria-invalid·aria-describedby를 자동으로 붙인다.
 */
export const Field = ({ id, label, required, error, hint, className, children }: FieldProps) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    id,
    'aria-required': required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    invalid: Boolean(error) || undefined,
  });

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="typo-card-meta font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden="true">*</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="typo-caption text-gray-500 dark:text-gray-400">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="typo-caption text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
