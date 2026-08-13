import React, { useMemo, useState } from 'react';

import { Button } from '../ui/Button';
import type { ValidationError } from '../../lib/contracts/validation';

export interface ContractFormValues {
  title: string;
  customerName: string;
  customerBirthdate: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  roomNumber: string;
  roomArea: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  depositAmount: string;
  paymentDay: string;
  specialTerms: string[];
}

export const EMPTY_CONTRACT_FORM: ContractFormValues = {
  title: '',
  customerName: '',
  customerBirthdate: '',
  customerEmail: '',
  customerPhone: '',
  customerAddress: '',
  roomNumber: '',
  roomArea: '3m × 2m',
  startDate: '',
  endDate: '',
  monthlyRent: '',
  depositAmount: '',
  paymentDay: '1',
  specialTerms: [],
};

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50';

/** 폼 값(모두 문자열)을 API가 기대하는 타입으로 변환한다. 검증은 서버가 한다. */
export const toContractPayload = (values: ContractFormValues): Record<string, unknown> => ({
  title: values.title.trim(),
  customerName: values.customerName.trim(),
  customerBirthdate: values.customerBirthdate.trim() || undefined,
  customerEmail: values.customerEmail.trim(),
  customerPhone: values.customerPhone.trim(),
  customerAddress: values.customerAddress.trim() || undefined,
  roomNumber: values.roomNumber.trim(),
  roomArea: values.roomArea.trim() || undefined,
  startDate: values.startDate,
  endDate: values.endDate,
  monthlyRent: Number(values.monthlyRent),
  depositAmount: Number(values.depositAmount),
  paymentDay: values.paymentDay === '' ? undefined : Number(values.paymentDay),
  specialTerms: values.specialTerms.map((term) => term.trim()).filter((term) => term !== ''),
});

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

const Field = ({ label, htmlFor, error, hint, required, children }: FieldProps) => (
  <div>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

/**
 * 기간 버튼이 채우는 종료일. 말일 보정(1/31 + 1개월 = 2/28)을 포함한다.
 *
 * 여기서 만든 값은 서버 검증(lib/contracts/validation.ts)을 그대로 통과해야 한다. 한때
 * 종료일을 세는 기준이 서로 달라([1개월] 버튼이 만든 9/1~9/30을 서버가 "1개월 미만"으로
 * 거부했다) 폼이 제안한 값을 서버가 거부하는 상태였다. 그 정합은 validation.test.ts가
 * 이 함수를 직접 불러 확인한다.
 */
export const addMonths = (dateString: string, months: number): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate();
  const shifted = new Date(date);
  shifted.setDate(1);
  shifted.setMonth(shifted.getMonth() + months);

  const lastDayOfMonth = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, lastDayOfMonth));

  // 이용 기간의 종료일은 "시작일 + N개월"의 전날이다(3개월 계약 = 1/1 ~ 3/31).
  shifted.setDate(shifted.getDate() - 1);

  const yyyy = shifted.getFullYear();
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface ContractFormProps {
  initialValues?: ContractFormValues;
  submitLabel: string;
  submitting: boolean;
  errors: ValidationError[];
  generalError?: string | null;
  onSubmit: (values: ContractFormValues) => void;
  onCancel: () => void;
}

export default function ContractForm({
  initialValues = EMPTY_CONTRACT_FORM,
  submitLabel,
  submitting,
  errors,
  generalError,
  onSubmit,
  onCancel,
}: ContractFormProps) {
  const [values, setValues] = useState<ContractFormValues>(initialValues);

  const errorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const error of errors) map[error.field] = error.message;
    return map;
  }, [errors]);

  const set = <K extends keyof ContractFormValues>(key: K, value: ContractFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // 제5조에 따라 보증금은 월 이용료와 같은 금액이다. 따로 입력받지 않고 따라가게 한다.
  const handleMonthlyRentChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setValues((prev) => ({
      ...prev,
      monthlyRent: digitsOnly,
      depositAmount: prev.monthlyRent === prev.depositAmount ? digitsOnly : prev.depositAmount,
    }));
  };

  const applyTerm = (months: number) => {
    if (!values.startDate) return;
    set('endDate', addMonths(values.startDate, months));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const title =
      values.title.trim() ||
      (values.customerName.trim() ? `${values.customerName.trim()}님 음악연습실 이용계약` : '');
    onSubmit({ ...values, title });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">이용자 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="성명" htmlFor="customerName" error={errorMap.customerName} required>
            <input
              id="customerName"
              className={INPUT_CLASS}
              value={values.customerName}
              onChange={(e) => set('customerName', e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field
            label="생년월일"
            htmlFor="customerBirthdate"
            error={errorMap.customerBirthdate}
            hint="예: 1990-01-01"
          >
            <input
              id="customerBirthdate"
              type="date"
              className={INPUT_CLASS}
              value={values.customerBirthdate}
              onChange={(e) => set('customerBirthdate', e.target.value)}
            />
          </Field>

          <Field label="이메일" htmlFor="customerEmail" error={errorMap.customerEmail} required
            hint="이 주소로 서명 링크가 발송됩니다.">
            <input
              id="customerEmail"
              type="email"
              className={INPUT_CLASS}
              value={values.customerEmail}
              onChange={(e) => set('customerEmail', e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label="연락처" htmlFor="customerPhone" error={errorMap.customerPhone} required
            hint="예: 010-1234-5678">
            <input
              id="customerPhone"
              className={INPUT_CLASS}
              value={values.customerPhone}
              onChange={(e) => set('customerPhone', e.target.value)}
              autoComplete="off"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="주소" htmlFor="customerAddress" error={errorMap.customerAddress}>
              <input
                id="customerAddress"
                className={INPUT_CLASS}
                value={values.customerAddress}
                onChange={(e) => set('customerAddress', e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">이용 대상 및 기간</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="호실" htmlFor="roomNumber" error={errorMap.roomNumber} required hint="예: A, 201">
            <input
              id="roomNumber"
              className={INPUT_CLASS}
              value={values.roomNumber}
              onChange={(e) => set('roomNumber', e.target.value)}
            />
          </Field>

          <Field label="면적" htmlFor="roomArea" error={errorMap.roomArea}>
            <input
              id="roomArea"
              className={INPUT_CLASS}
              value={values.roomArea}
              onChange={(e) => set('roomArea', e.target.value)}
            />
          </Field>

          <Field label="시작일" htmlFor="startDate" error={errorMap.startDate} required>
            <input
              id="startDate"
              type="date"
              className={INPUT_CLASS}
              value={values.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>

          <Field label="종료일" htmlFor="endDate" error={errorMap.endDate} required>
            <input
              id="endDate"
              type="date"
              className={INPUT_CLASS}
              value={values.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>

          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">기간 빠른 설정:</span>
              {[1, 3, 6, 12].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => applyTerm(months)}
                  disabled={!values.startDate}
                  className={`px-3 py-1.5 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                    months === 6
                      ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {months}개월
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              최소 1개월부터 가능하며, <strong className="text-primary">6개월 이상</strong>을 권합니다.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">이용료</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="월 이용료" htmlFor="monthlyRent" error={errorMap.monthlyRent} required hint="원 단위 숫자">
            <input
              id="monthlyRent"
              inputMode="numeric"
              className={INPUT_CLASS}
              value={values.monthlyRent}
              onChange={(e) => handleMonthlyRentChange(e.target.value)}
            />
          </Field>

          <Field
            label="보증금"
            htmlFor="depositAmount"
            error={errorMap.depositAmount}
            required
            hint="제5조에 따라 계약 시 납부 면제"
          >
            <input
              id="depositAmount"
              inputMode="numeric"
              className={INPUT_CLASS}
              value={values.depositAmount}
              onChange={(e) => set('depositAmount', e.target.value.replace(/[^0-9]/g, ''))}
            />
          </Field>

          <Field
            label="납부일"
            htmlFor="paymentDay"
            error={errorMap.paymentDay}
            // 29~31일은 없는 달이 있어 계약서에 그대로 적히면 이행 시점이 모호해진다.
            hint={
              Number(values.paymentDay) >= 29
                ? '29~31일은 없는 달이 있습니다. 그런 달은 말일에 납부하게 됩니다.'
                : '매월 며칠(선불)'
            }
          >
            <input
              id="paymentDay"
              inputMode="numeric"
              className={INPUT_CLASS}
              value={values.paymentDay}
              onChange={(e) => set('paymentDay', e.target.value.replace(/[^0-9]/g, ''))}
            />
          </Field>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">특약사항</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => set('specialTerms', [...values.specialTerms, ''])}
          >
            추가
          </Button>
        </div>

        {values.specialTerms.length === 0 ? (
          <p className="text-sm text-gray-500">별도 합의 사항이 있으면 추가하세요. (선택)</p>
        ) : (
          <div className="space-y-2">
            {values.specialTerms.map((term, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className={INPUT_CLASS}
                  value={term}
                  placeholder={`특약 ${index + 1}`}
                  onChange={(e) => {
                    const next = [...values.specialTerms];
                    next[index] = e.target.value;
                    set('specialTerms', next);
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    set(
                      'specialTerms',
                      values.specialTerms.filter((_, i) => i !== index),
                    )
                  }
                  className="shrink-0 px-3 rounded-lg text-sm text-gray-500 hover:text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
        {errorMap.specialTerms && (
          <p className="mt-1 text-xs text-red-600">{errorMap.specialTerms}</p>
        )}
      </section>

      <section>
        <Field
          label="계약 제목"
          htmlFor="title"
          error={errorMap.title}
          hint="비워 두면 “○○○님 음악연습실 이용계약”으로 저장됩니다."
        >
          <input
            id="title"
            className={INPUT_CLASS}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
      </section>

      {generalError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{generalError}</div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? '저장 중...' : submitLabel}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
      </div>
    </form>
  );
}
