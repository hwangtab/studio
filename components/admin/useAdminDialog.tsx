import React, { useCallback, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { lightOnlyField } from '../ui/adminFieldClass';
import { DANGER_WEAK_CLASS } from './adminDanger';

/**
 * 관리자 화면의 "입력을 받는 확인창" — `window.prompt`를 대신한다(2026-10-22 운영자 결정).
 *
 * window.prompt는 레이블·검증 메시지·취소 버튼 문구를 고를 수 없고, 휴대폰 사파리에서는 긴 안내문이 잘리며,
 * 여러 칸(금액 + 메모)은 창을 두 번 띄워야 했다. 이 훅은 같은 자리에서 `await ask({...})`로 쓰도록 만들었다 —
 * 취소하면 `null`, 확인하면 칸 이름 → 입력값(문자열) 객체를 돌려준다. 호출부의 API 호출·기본값·의미는 그대로다.
 *
 * - 칸마다 레이블·도움말·필수 여부·검증(`validate`)을 준다. 검증 문구는 그 칸 아래에 뜨고 창은 닫히지 않는다.
 * - `onSubmit`을 주면 확인을 누른 뒤 그 작업이 끝날 때까지 창을 열어 두고 버튼을 "처리 중…"으로 막는다. 작업이 문자열을
 *   돌려주면 실패로 보고 창 안에 띄운다. 주지 않으면 값을 돌려주고 바로 닫는다(호출부의 busy 상태가 이어받는다).
 * - `tone: 'danger'`는 확인 버튼을 빨강으로(되돌릴 수 없는 동작 — adminDanger.ts).
 *
 * 쓰는 법: `const { ask, dialog } = useAdminDialog();` 그리고 JSX 어딘가에 `{dialog}`.
 */
export interface AdminDialogField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'select';
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  /** true면 비었을 때 "…을(를) 적어 주세요". 문자열이면 그 문구. */
  required?: boolean | string;
  options?: Array<{ value: string; label: string }>;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  /** 오류 문구를 돌려주면 막는다. */
  validate?: (value: string, values: Record<string, string>) => string | null;
}

export interface AdminDialogSpec {
  title: string;
  description?: React.ReactNode;
  fields?: AdminDialogField[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** 확인 뒤 창을 연 채로 실행할 작업 — 오류 문구를 돌려주면 창에 띄우고 닫지 않는다. */
  onSubmit?: (values: Record<string, string>) => Promise<string | null | void>;
}

type Pending = AdminDialogSpec & { resolve: (values: Record<string, string> | null) => void };

const initialValues = (fields: AdminDialogField[] = []) => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? '']));

export const useAdminDialog = () => {
  const [pending, setPending] = useState<Pending | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLElement | null>(null);

  const ask = useCallback(
    (spec: AdminDialogSpec) =>
      new Promise<Record<string, string> | null>((resolve) => {
        setValues(initialValues(spec.fields));
        setErrors({});
        setFormError(null);
        setSubmitting(false);
        setPending({ ...spec, resolve });
      }),
    [],
  );

  const close = (result: Record<string, string> | null) => {
    if (!pending) return;
    pending.resolve(result);
    setPending(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pending || submitting) return;
    const nextErrors: Record<string, string> = {};
    for (const field of pending.fields ?? []) {
      const value = values[field.name] ?? '';
      if (field.required && value.trim() === '') {
        nextErrors[field.name] = typeof field.required === 'string' ? field.required : `${field.label}을(를) 적어 주세요.`;
        continue;
      }
      const message = field.validate?.(value, values);
      if (message) nextErrors[field.name] = message;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (pending.onSubmit) {
      setSubmitting(true);
      setFormError(null);
      const failure = await pending.onSubmit(values);
      setSubmitting(false);
      if (typeof failure === 'string' && failure) {
        setFormError(failure);
        return;
      }
    }
    close(values);
  };

  const dialog = pending ? (
    <Modal
      open
      onClose={() => (submitting ? undefined : close(null))}
      title={pending.title}
      size="sm"
      initialFocusRef={(pending.fields?.length ?? 0) > 0 ? firstFieldRef : undefined}
      className="text-gray-900"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {pending.description && <div className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{pending.description}</div>}
        {(pending.fields ?? []).map((field, index) => {
          const id = `admin-dialog-${field.name}`;
          const common = {
            id,
            value: values[field.name] ?? '',
            disabled: submitting,
            invalid: Boolean(errors[field.name]),
            light: true,
            className: 'text-sm',
            ref: index === 0 ? (el: HTMLElement | null) => { firstFieldRef.current = el; } : undefined,
          };
          const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
            setValues((prev) => ({ ...prev, [field.name]: e.target.value }));
          return (
            <Field key={field.name} id={id} label={field.label} required={Boolean(field.required)} hint={field.hint} error={errors[field.name]} className={lightOnlyField}>
              {field.type === 'textarea' ? (
                <TextArea {...common} ref={common.ref as React.Ref<HTMLTextAreaElement>} rows={3} placeholder={field.placeholder} maxLength={field.maxLength} onChange={onChange} className="min-h-0 text-sm" />
              ) : field.type === 'select' ? (
                <Select {...common} ref={common.ref as React.Ref<HTMLSelectElement>} onChange={onChange}>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  {...common}
                  ref={common.ref as React.Ref<HTMLInputElement>}
                  type={field.type === 'date' ? 'date' : 'text'}
                  inputMode={field.type === 'number' ? 'numeric' : field.inputMode}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  onChange={onChange}
                />
              )}
            </Field>
          );
        })}
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" light variant="ghost" disabled={submitting} onClick={() => close(null)}>
            {pending.cancelLabel ?? '취소'}
          </Button>
          <Button
            type="submit"
            light
            variant={pending.tone === 'danger' ? 'weak' : 'solid'}
            className={pending.tone === 'danger' ? DANGER_WEAK_CLASS : undefined}
            disabled={submitting}
          >
            {submitting ? '처리 중…' : (pending.confirmLabel ?? '확인')}
          </Button>
        </div>
      </form>
    </Modal>
  ) : null;

  return { ask, dialog };
};

export default useAdminDialog;
