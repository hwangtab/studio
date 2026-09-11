import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { lightOnlyField } from '../ui/adminFieldClass';
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

const ADMIN_FIELD = lightOnlyField;

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

  /**
   * 특약사항 각 행에 붙이는 안정적 로컬 id. 서버로 보내는 형식(string[])은 그대로 두고,
   * 렌더링 key만 index 대신 이 id를 쓴다 — 중간 행을 삭제해도 React가 남은 행의 DOM을
   * 잘못 재사용해 입력 중이던 값이 다른 항목 것으로 보이는 문제를 막는다.
   */
  const makeTermId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `term-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const [specialTermIds, setSpecialTermIds] = useState<string[]>(() =>
    initialValues.specialTerms.map(() => makeTermId()),
  );

  /**
   * 작성 중인 내용을 실수로 날리지 않게 한다.
   *
   * 계약 폼은 14개 항목이라 다 채우는 데 몇 분이 걸린다. 그 상태에서 뒤로 가기나 탭 닫기를
   * 누르면 아무 확인 없이 전부 사라졌다. 브라우저가 주는 확인창을 붙여 둔다 — 사용자가
   * 무언가 입력한 뒤에만, 그리고 저장하는 중에는 방해하지 않는다.
   */
  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues],
  );

  /**
   * initialValues가 바뀌면 폼을 다시 채운다.
   *
   * `/admin/contracts/new?from=A` → `?from=B`처럼 쿼리만 바뀌는 이동은 Pages Router에서
   * 컴포넌트를 remount하지 않고 getServerSideProps만 다시 돌린다(pages/_app.tsx의 remount
   * key가 쿼리스트링을 뺀 경로 기준이라). 그 결과 이 폼은 A의 initialValues로 만든 useState를
   * 그대로 들고 있는데 부모가 내려주는 initialValues prop만 B로 바뀐다 — "B님 계약을
   * 복제했습니다" 배너 아래 A의 이름·연락처·금액이 남아, 다른 고객 정보로 계약이 생성될 수
   * 있었다. 호출부(new.tsx)에서 key를 바꿔 remount를 강제하는 쪽이 더 안전하지만 이 작업의
   * 수정 범위가 이 파일로 한정돼 있어, 대신 initialValues 참조가 바뀔 때 values를 다시
   * 동기화한다. 이 페이지에서 initialValues가 바뀌는 경로는 실제로 새 서버 렌더(새 ?from=
   * 이동)뿐이라 "편집 중이던 값을 덮어쓴다"는 부작용은 실질적으로 발생하지 않는다 — 그
   * 이동이 일어난 시점엔 아직 이 폼에 아무것도 입력하지 않은 새 화면이기 때문이다.
   */
  const initialValuesRef = useRef(initialValues);
  useEffect(() => {
    if (initialValuesRef.current === initialValues) return;
    initialValuesRef.current = initialValues;
    setValues(initialValues);
    setSpecialTermIds(initialValues.specialTerms.map(() => makeTermId()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  useEffect(() => {
    if (!isDirty || submitting) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 브라우저는 문구를 무시하고 자체 확인창을 띄운다. 값을 넣는 것 자체가 신호다.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, submitting]);

  const handleCancel = () => {
    if (isDirty && !window.confirm('작성 중인 내용이 사라집니다. 나가시겠습니까?')) return;
    onCancel();
  };

  const errorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const error of errors) map[error.field] = error.message;
    return map;
  }, [errors]);

  const set = <K extends keyof ContractFormValues>(key: K, value: ContractFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * 계약서 제5조 ①이 "보증금은 월 이용료와 동일한 금액"이라고 정하므로 항상 따라가게 한다.
   *
   * 예전에는 두 값이 같을 때만 동기화해서, 보증금을 한 번 손대면 그 뒤로는 월 이용료를
   * 고쳐도 따라오지 않았다. 서버 검증이 다른 값을 거부하므로 저장 단계에서야 막히는데,
   * 그때는 무엇이 어긋났는지 알기 어렵다.
   */
  const handleMonthlyRentChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setValues((prev) => ({ ...prev, monthlyRent: digitsOnly, depositAmount: digitsOnly }));
  };

  const addSpecialTerm = () => {
    setValues((prev) => ({ ...prev, specialTerms: [...prev.specialTerms, ''] }));
    setSpecialTermIds((prev) => [...prev, makeTermId()]);
  };

  const updateSpecialTerm = (index: number, value: string) => {
    setValues((prev) => {
      const next = [...prev.specialTerms];
      next[index] = value;
      return { ...prev, specialTerms: next };
    });
  };

  const removeSpecialTerm = (index: number) => {
    setValues((prev) => ({
      ...prev,
      specialTerms: prev.specialTerms.filter((_, i) => i !== index),
    }));
    setSpecialTermIds((prev) => prev.filter((_, i) => i !== index));
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
          <Field label="성명" id="customerName" error={errorMap.customerName} required className={ADMIN_FIELD}>
            <TextInput
              light
              className="text-sm"
              value={values.customerName}
              onChange={(e) => set('customerName', e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label="이메일" id="customerEmail" error={errorMap.customerEmail} required
            hint="이 주소로 서명 링크가 발송됩니다."
            className={ADMIN_FIELD}>
            <TextInput
              type="email"
              light
              className="text-sm"
              value={values.customerEmail}
              onChange={(e) => set('customerEmail', e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label="연락처" id="customerPhone" error={errorMap.customerPhone} required
            hint="뒤 4자리가 고객의 본인 확인에 쓰입니다."
            className={ADMIN_FIELD}>
            <TextInput
              light
              className="text-sm"
              value={values.customerPhone}
              onChange={(e) => set('customerPhone', e.target.value)}
              autoComplete="off"
            />
          </Field>

          {/*
            생년월일·주소는 받지 않는다 — 운영자가 알 수 없는 값이라 당사자가 서명 화면에서
            직접 채운다(pages/[locale]/contracts/[id]/sign.tsx). 없는 칸을 화면에서 설명하지는
            않는다. 연락처만 본인 확인에 쓰이므로 그 사실을 힌트에 남긴다.
          */}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">이용 대상 및 기간</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="호실" id="roomNumber" error={errorMap.roomNumber} required hint="예: A, 201" className={ADMIN_FIELD}>
            <TextInput
              light
              className="text-sm"
              value={values.roomNumber}
              onChange={(e) => set('roomNumber', e.target.value)}
            />
          </Field>

          <Field label="면적" id="roomArea" error={errorMap.roomArea} className={ADMIN_FIELD}>
            <TextInput
              light
              className="text-sm"
              value={values.roomArea}
              onChange={(e) => set('roomArea', e.target.value)}
            />
          </Field>

          <Field label="시작일" id="startDate" error={errorMap.startDate} required className={ADMIN_FIELD}>
            <TextInput
              type="date"
              light
              className="text-sm"
              value={values.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>

          <Field label="종료일" id="endDate" error={errorMap.endDate} required className={ADMIN_FIELD}>
            <TextInput
              type="date"
              light
              className="text-sm"
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
          <Field label="월 이용료" id="monthlyRent" error={errorMap.monthlyRent} required hint="원 단위 숫자" className={ADMIN_FIELD}>
            <TextInput
              inputMode="numeric"
              light
              className="text-sm"
              value={values.monthlyRent}
              onChange={(e) => handleMonthlyRentChange(e.target.value)}
            />
          </Field>

          {/* required를 주지 않는다 — 아래 컨트롤은 readOnly + tabIndex={-1}이라 포커스도 입력도
              할 수 없다. 거기에 aria-required="true"가 붙으면 스크린리더가 "채울 수 없는 필수
              칸"을 알리게 된다. 값의 출처는 hint가 설명한다. */}
          <Field
            label="보증금"
            id="depositAmount"
            error={errorMap.depositAmount}
            hint="제5조에 따라 월 이용료와 같은 금액이며, 계약 시 납부를 면제합니다"
            className={ADMIN_FIELD}
          >
            {/* 제5조가 금액을 정하고 있어 따로 받지 않는다. 다른 값을 넣으면 계약서 안에서
                요약표와 제5조가 서로 다른 말을 하게 된다. */}
            <TextInput
              inputMode="numeric"
              readOnly
              tabIndex={-1}
              light
              className="text-sm bg-gray-50 text-gray-600 dark:bg-gray-50 dark:text-gray-600 cursor-not-allowed"
              value={values.depositAmount}
            />
          </Field>

          <Field
            label="납부일"
            id="paymentDay"
            error={errorMap.paymentDay}
            className={ADMIN_FIELD}
            // 29~31일은 없는 달이 있어 계약서에 그대로 적히면 이행 시점이 모호해진다.
            hint={
              Number(values.paymentDay) >= 29
                ? '29~31일은 없는 달이 있습니다. 그런 달은 말일에 납부하게 됩니다.'
                : '매월 며칠(선불)'
            }
          >
            <TextInput
              inputMode="numeric"
              light
              className="text-sm"
              value={values.paymentDay}
              onChange={(e) => set('paymentDay', e.target.value.replace(/[^0-9]/g, ''))}
            />
          </Field>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">특약사항</h2>
          <Button light
            type="button"
            size="sm"
            variant="outline"
            onClick={addSpecialTerm}
          >
            추가
          </Button>
        </div>

        {values.specialTerms.length === 0 ? (
          <p className="text-sm text-gray-500">별도 합의 사항이 있으면 추가하세요. (선택)</p>
        ) : (
          <div className="space-y-2">
            {values.specialTerms.map((term, index) => (
              <div key={specialTermIds[index] ?? index} className="flex gap-2">
                <TextInput
                  light
              className="text-sm"
                  value={term}
                  placeholder={`특약 ${index + 1}`}
                  onChange={(e) => updateSpecialTerm(index, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeSpecialTerm(index)}
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
          id="title"
          error={errorMap.title}
          hint="비워 두면 “○○○님 음악연습실 이용계약”으로 저장됩니다."
          className={ADMIN_FIELD}
        >
          <TextInput
            light
              className="text-sm"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
      </section>

      {generalError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{generalError}</div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
        <Button light type="submit" size="lg" disabled={submitting}>
          {submitting ? '저장 중...' : submitLabel}
        </Button>
        <Button light type="button" size="lg" variant="outline" onClick={handleCancel} disabled={submitting}>
          취소
        </Button>
      </div>
    </form>
  );
}
