import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { lightOnlyField } from '../ui/adminFieldClass';
import type { ValidationError } from '../../lib/contracts/validation';
import {
  buildDefaultProductionTerms,
  KIND_LABEL,
  parseStoredTerms,
  SONG_COUNT_RANGE,
  type ProductionKind,
  type ProductionTerms,
  type RefundItemKey,
  type RevisionStage,
} from '../../lib/contracts/production/terms';

/**
 * 제작 계약 작성·수정 폼. 연습실 ContractForm과 같은 약속을 지킨다 — 검증은 서버가 하고(여기는 합계를
 * 미리 보여 줄 뿐), 작성 중 이탈은 확인을 받고, 생년월일·주소는 받지 않는다(서명자가 채운다).
 *
 * 숫자 칸은 terms를 그대로 들고 다닌다. 잔금은 계약금액 − 계약금으로 따라가게 해, 제3조의 두 금액이 어긋난
 * 계약서를 만들 길을 화면에서 먼저 막는다.
 */
export interface ProductionContractFormValues {
  kind: ProductionKind;
  title: string;
  clientName: string;
  clientStageName: string;
  clientEmail: string;
  clientPhone: string;
  /** null이면 법정대리인 없음(성년 의뢰인). */
  guardian: { name: string; relation: string; email: string; phone: string } | null;
  terms: ProductionTerms;
}

export const emptyProductionFormValues = (): ProductionContractFormValues => ({
  kind: 'single',
  title: '',
  clientName: '',
  clientStageName: '',
  clientEmail: '',
  clientPhone: '',
  guardian: null,
  terms: buildDefaultProductionTerms(),
});

/**
 * 저장된 계약을 폼 값으로. 수정 화면과 복제 화면이 같은 변환을 쓴다(연습실 form-values.ts와 같은 이유 —
 * 한쪽만 필드를 빠뜨리면 그 값이 조용히 기본값으로 돌아간다).
 */
export const productionContractToFormValues = (contract: {
  kind: ProductionKind;
  title: string;
  clientName: string;
  clientStageName: string | null;
  clientEmail: string;
  clientPhone: string;
  termsJson: string;
}, guardian?: { name: string; relation: string | null; email: string; phone: string | null } | null): ProductionContractFormValues => ({
  kind: contract.kind,
  title: contract.title,
  clientName: contract.clientName,
  clientStageName: contract.clientStageName ?? '',
  clientEmail: contract.clientEmail,
  clientPhone: contract.clientPhone,
  guardian: guardian
    ? { name: guardian.name, relation: guardian.relation ?? '', email: guardian.email, phone: guardian.phone ?? '' }
    : null,
  terms: parseStoredTerms(contract.termsJson),
});

export const toProductionPayload = (values: ProductionContractFormValues): Record<string, unknown> => ({
  kind: values.kind,
  title: values.title.trim(),
  clientName: values.clientName.trim(),
  clientStageName: values.clientStageName.trim() || undefined,
  clientEmail: values.clientEmail.trim(),
  clientPhone: values.clientPhone.trim(),
  guardian: values.guardian
    ? {
        name: values.guardian.name.trim(),
        relation: values.guardian.relation.trim(),
        email: values.guardian.email.trim(),
        phone: values.guardian.phone.trim(),
      }
    : null,
  terms: {
    ...values.terms,
    albumTitle: values.kind === 'single' ? null : values.terms.albumTitle?.trim() || null,
    songs: values.terms.songs.map((song) => ({ title: song.title?.trim() || null })),
  },
});

const ADMIN_FIELD = lightOnlyField;
const won = (amount: number) => amount.toLocaleString('ko-KR');
const digits = (raw: string): number => Number(raw.replace(/[^0-9]/g, '') || '0');

const STAGE_LABEL: Record<RevisionStage, string> = { arrangement: '편곡', mixing: '믹싱', mastering: '마스터링' };

/** 종류를 처음 고를 때의 곡 수 — 번들 가격의 기준 곡 수(EP 4곡, 정규 8곡, data/pricing.ts). */
const DEFAULT_SONG_COUNT: Record<ProductionKind, number> = { single: 1, ep: 4, album: 8 };

/** 곡 목록을 n곡으로 — 있던 제목은 남긴다. */
const resizeSongs = (songs: ProductionTerms['songs'], count: number) =>
  Array.from({ length: count }, (_, index) => songs[index] ?? { title: null });
const REFUND_SHORT_LABEL: Record<RefundItemKey, string> = {
  arrangement: '편곡',
  recording: '보컬 녹음',
  tuning: '음정·박자 보정',
  mixmaster: '믹싱·마스터링',
  planning: '기획·유통·홍보',
};

interface ProductionContractFormProps {
  initialValues: ProductionContractFormValues;
  submitLabel: string;
  submitting: boolean;
  errors: ValidationError[];
  generalError?: string | null;
  onSubmit: (values: ProductionContractFormValues) => void;
  onCancel: () => void;
  /** 입력이 바뀔 때마다 — 폼 밖에서 지금 값을 이어 쓸 때(견적 붙여 넣기). */
  onChange?: (values: ProductionContractFormValues) => void;
}

export default function ProductionContractForm({
  initialValues,
  submitLabel,
  submitting,
  errors,
  generalError,
  onSubmit,
  onCancel,
  onChange,
}: ProductionContractFormProps) {
  const [values, setValues] = useState<ProductionContractFormValues>(initialValues);
  // 곡 수는 입력 중엔 글자 그대로 들고 있다가 범위 안일 때만 반영한다 — 키마다 범위로 묶으면 "12"를 칠 수 없다.
  const [songCountText, setSongCountText] = useState<string | null>(null);

  useEffect(() => {
    onChange?.(values);
  }, [values, onChange]);

  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initialValues), [values, initialValues]);

  // 작성 중 탭을 닫거나 뒤로 가면 확인을 받는다(연습실 ContractForm과 같다).
  useEffect(() => {
    if (!isDirty || submitting) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, submitting]);

  const errorMap = useMemo(() => Object.fromEntries(errors.map((error) => [error.field, error.message])), [errors]);

  const set = <K extends keyof ProductionContractFormValues>(key: K, value: ProductionContractFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const setTerms = (update: (terms: ProductionTerms) => ProductionTerms) =>
    setValues((prev) => ({ ...prev, terms: update(prev.terms) }));

  /** 계약금액·계약금이 바뀌면 잔금이 따라간다. */
  const setAmount = (key: 'total' | 'deposit', raw: string) =>
    setTerms((terms) => {
      const amount = { ...terms.amount, [key]: digits(raw) };
      return { ...terms, amount: { ...amount, balance: Math.max(0, amount.total - amount.deposit) } };
    });

  /**
   * 종류를 바꾸면 곡 목록만 그 종류의 범위로 맞춘다. 금액은 건드리지 않는다 — 운영자가 견적대로 고친 금액을 종류
   * 라디오 한 번에 날리지 않게, 기본값 채우기는 따로 누른다(fillDefaults).
   */
  const changeKind = (kind: ProductionKind) =>
    setValues((prev) => ({
      ...prev,
      kind,
      terms: {
        ...prev.terms,
        albumTitle: kind === 'single' ? null : prev.terms.albumTitle,
        songs: resizeSongs(prev.terms.songs, kind === prev.kind ? prev.terms.songs.length : DEFAULT_SONG_COUNT[kind]),
      },
    }));

  const setSongTitle = (index: number, title: string) =>
    setTerms((t) => ({ ...t, songs: t.songs.map((song, i) => (i === index ? { title } : song)) }));

  /** 종류·곡 수의 기본 조건으로 다시 채운다. 곡·음반 제목, 입금 계좌, 크레딧은 남긴다. */
  const fillDefaults = () =>
    setTerms((t) => ({
      ...buildDefaultProductionTerms(values.kind, t.songs.length),
      albumTitle: t.albumTitle,
      songs: t.songs,
      payment: t.payment,
      credits: t.credits,
    }));

  const { terms } = values;
  const refundSum = terms.refundSchedule.reduce((sum, item) => sum + item.amount, 0);

  const numberInput = (
    id: string,
    label: string,
    value: number,
    onChange: (raw: string) => void,
    hint?: string,
  ) => (
    <Field label={label} id={id} error={errorMap[id]} hint={hint} className={ADMIN_FIELD}>
      <TextInput inputMode="numeric" light className="text-sm" value={String(value)} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const title =
      values.title.trim() || (values.clientName.trim() ? `${values.clientName.trim()}님 음원 제작 용역 계약` : '');
    onSubmit({ ...values, title });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">의뢰인</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="성명(실명)" id="clientName" error={errorMap.clientName} required className={ADMIN_FIELD}>
            <TextInput light className="text-sm" value={values.clientName} onChange={(e) => set('clientName', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="활동명" id="clientStageName" error={errorMap.clientStageName} hint="크레딧·유통 정보에 쓰는 이름 (선택)" className={ADMIN_FIELD}>
            <TextInput light className="text-sm" value={values.clientStageName} onChange={(e) => set('clientStageName', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="이메일" id="clientEmail" error={errorMap.clientEmail} required hint="이 주소로 서명 링크가 발송됩니다." className={ADMIN_FIELD}>
            <TextInput type="email" light className="text-sm" value={values.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="연락처" id="clientPhone" error={errorMap.clientPhone} required hint="뒤 4자리가 의뢰인의 본인 확인에 쓰입니다." className={ADMIN_FIELD}>
            <TextInput light className="text-sm" value={values.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} autoComplete="off" />
          </Field>
        </div>
      </section>

      <section>
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-primary"
            checked={values.guardian !== null}
            onChange={(e) => set('guardian', e.target.checked ? { name: '', relation: '', email: '', phone: '' } : null)}
          />
          <span>
            의뢰인이 미성년자예요 — 법정대리인이 함께 서명해야 계약이 성립해요(제14조). 대리인에게 따로 서명 링크가 가고,
            대리인은 자기 연락처 뒷자리로 본인 확인을 해요.
          </span>
        </label>
        {values.guardian && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                ['name', '법정대리인 성명', ''],
                ['relation', '관계', '예: 부, 모, 후견인'],
                ['email', '법정대리인 이메일', '이 주소로 대리인 서명 링크가 갑니다.'],
                ['phone', '법정대리인 연락처', '뒤 4자리가 대리인의 본인 확인에 쓰입니다. 의뢰인과 다른 번호여야 해요.'],
              ] as const
            ).map(([key, label, hint]) => (
              <Field key={key} label={label} id={`guardian.${key}`} error={errorMap[`guardian.${key}`]} hint={hint || undefined} required className={ADMIN_FIELD}>
                <TextInput
                  light
                  className="text-sm"
                  autoComplete="off"
                  value={values.guardian?.[key] ?? ''}
                  onChange={(e) => setValues((prev) => (prev.guardian ? { ...prev, guardian: { ...prev.guardian, [key]: e.target.value } } : prev))}
                />
              </Field>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">계약 종류</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(KIND_LABEL) as ProductionKind[]).map((kind) => (
            <label key={kind} className="flex items-center gap-2">
              <input type="radio" className="h-4 w-4 accent-primary" name="kind" checked={values.kind === kind} onChange={() => changeKind(kind)} />
              {KIND_LABEL[kind]}
              {kind !== 'single' && ` (${SONG_COUNT_RANGE[kind].min}~${SONG_COUNT_RANGE[kind].max}곡)`}
            </label>
          ))}
        </div>
        {values.kind !== 'single' && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="음반 제목" id="terms.albumTitle" error={errorMap['terms.albumTitle']} hint="미정이면 비워 두세요." className={ADMIN_FIELD}>
                <TextInput light className="text-sm" value={terms.albumTitle ?? ''} onChange={(e) => setTerms((t) => ({ ...t, albumTitle: e.target.value }))} />
              </Field>
              <Field label="곡 수" id="terms.songs" error={errorMap['terms.songs']} hint={`${SONG_COUNT_RANGE[values.kind].min}~${SONG_COUNT_RANGE[values.kind].max}곡`} className={ADMIN_FIELD}>
                <TextInput
                  light
                  inputMode="numeric"
                  className="text-sm"
                  value={songCountText ?? String(terms.songs.length)}
                  onChange={(e) => {
                    const range = SONG_COUNT_RANGE[values.kind];
                    const text = e.target.value.replace(/\D/g, '');
                    setSongCountText(text);
                    const count = Number(text);
                    if (text !== '' && count >= range.min && count <= range.max) {
                      setTerms((t) => ({ ...t, songs: resizeSongs(t.songs, count) }));
                    }
                  }}
                  onBlur={() => {
                    const range = SONG_COUNT_RANGE[values.kind];
                    if (songCountText !== null && songCountText !== '') {
                      const count = Math.min(Math.max(Number(songCountText), range.min), range.max);
                      setTerms((t) => ({ ...t, songs: resizeSongs(t.songs, count) }));
                    }
                    setSongCountText(null);
                  }}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {terms.songs.map((song, index) => (
                <Field key={index} label={`${index + 1}번 곡 제목`} id={`terms.songs.${index}`} error={errorMap[`terms.songs.${index}`]} className={ADMIN_FIELD}>
                  <TextInput light className="text-sm" value={song.title ?? ''} onChange={(e) => setSongTitle(index, e.target.value)} />
                </Field>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Button light type="button" variant="weak" size="sm" onClick={fillDefaults}>
            {KIND_LABEL[values.kind]} {terms.songs.length}곡 기본 조건으로 채우기
          </Button>
          <span className="text-gray-500">
            금액·환불 항목표·작업 기간을 정본 가격 × 곡 수로 다시 채워요. 종류나 곡 수를 바꾼 뒤 누르세요 — 직접 고친 금액은 덮어써요.
          </span>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">작업 범위</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {values.kind === 'single' && (
            <Field label="곡 제목" id="terms.songs.0" error={errorMap['terms.songs.0']} hint="미정이면 비워 두세요. 계약서에 “1곡 (제목 미정)”으로 적힙니다." className={ADMIN_FIELD}>
              <TextInput light className="text-sm" value={terms.songs[0]?.title ?? ''} onChange={(e) => setSongTitle(0, e.target.value)} />
            </Field>
          )}
          {numberInput('terms.workWeeks', '작업 기간(주)', terms.workWeeks, (raw) => setTerms((t) => ({ ...t, workWeeks: digits(raw) })))}
          {numberInput('terms.scope.arrangementTracks', '곡당 편곡 트랙 수(이하)', terms.scope.arrangementTracks, (raw) =>
            setTerms((t) => ({ ...t, scope: { ...t.scope, arrangementTracks: digits(raw) } })),
          )}
          {numberInput('terms.scope.mixingTracks', '곡당 믹싱 트랙 수(이하)', terms.scope.mixingTracks, (raw) =>
            setTerms((t) => ({ ...t, scope: { ...t.scope, mixingTracks: digits(raw) } })),
          )}
          {numberInput('terms.scope.recordingHours', '곡당 보컬 녹음 시간', terms.scope.recordingHours, (raw) =>
            setTerms((t) => ({ ...t, scope: { ...t.scope, recordingHours: digits(raw) } })),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">금액 (부가세 포함)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {numberInput('terms.amount.total', '계약금액', terms.amount.total, (raw) => setAmount('total', raw), '원 단위 숫자')}
          {numberInput('terms.amount.deposit', '계약금', terms.amount.deposit, (raw) => setAmount('deposit', raw))}
          <Field label="잔금" id="terms.amount.balance" error={errorMap['terms.amount.balance']} hint="계약금액 − 계약금" className={ADMIN_FIELD}>
            <TextInput readOnly tabIndex={-1} light className="text-sm bg-gray-50 text-gray-600 dark:bg-gray-50 dark:text-gray-600 cursor-not-allowed" value={won(terms.amount.balance)} />
          </Field>
          {numberInput('terms.amount.depositDueDays', '계약금 기한(체결 후 일)', terms.amount.depositDueDays, (raw) =>
            setTerms((t) => ({ ...t, amount: { ...t.amount, depositDueDays: digits(raw) } })),
          )}
          {numberInput('terms.amount.balanceDueDays', '잔금 기한(최종 승인 후 일)', terms.amount.balanceDueDays, (raw) =>
            setTerms((t) => ({ ...t, amount: { ...t.amount, balanceDueDays: digits(raw) } })),
          )}
        </div>

        <h3 className="mt-6 mb-2 font-semibold text-gray-900 dark:text-gray-900">해지 시 공제 항목표 (제10조)</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {terms.refundSchedule.map((item, index) => (
            <Field key={item.key} label={REFUND_SHORT_LABEL[item.key]} id={`terms.refundSchedule.${item.key}`} error={errorMap[`terms.refundSchedule.${item.key}`]} className={ADMIN_FIELD}>
              <TextInput
                inputMode="numeric"
                light
                className="text-sm"
                value={String(item.amount)}
                onChange={(e) =>
                  setTerms((t) => ({
                    ...t,
                    refundSchedule: t.refundSchedule.map((row, i) => (i === index ? { ...row, amount: digits(e.target.value) } : row)),
                  }))
                }
              />
            </Field>
          ))}
        </div>
        <p className={`mt-2 text-sm ${refundSum === terms.amount.total ? 'text-gray-500' : 'text-red-600'}`}>
          합계 {won(refundSum)}원 {refundSum === terms.amount.total ? '— 계약금액과 같습니다.' : `— 계약금액(${won(terms.amount.total)}원)과 같아야 합니다.`}
        </p>
        {errorMap['terms.refundSchedule'] && <p className="mt-1 text-xs text-red-600">{errorMap['terms.refundSchedule']}</p>}
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">수정 (제5조)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(STAGE_LABEL) as RevisionStage[]).map((stage) => (
            <React.Fragment key={stage}>
              {numberInput(`terms.revisions.${stage}`, `${STAGE_LABEL[stage]} 무료 수정(${stage === 'mastering' ? '음반 전체' : '곡당'} 회)`, terms.revisions[stage], (raw) =>
                setTerms((t) => ({ ...t, revisions: { ...t.revisions, [stage]: digits(raw) } })),
              )}
            </React.Fragment>
          ))}
          {(Object.keys(STAGE_LABEL) as RevisionStage[]).map((stage) => (
            <React.Fragment key={`fee-${stage}`}>
              {numberInput(`terms.extraRevisionFees.${stage}`, `${STAGE_LABEL[stage]} 초과 수정(회당 원)`, terms.extraRevisionFees[stage], (raw) =>
                setTerms((t) => ({ ...t, extraRevisionFees: { ...t.extraRevisionFees, [stage]: digits(raw) } })),
              )}
            </React.Fragment>
          ))}
          {numberInput('terms.deemedApprovalDays', '승인 간주(전달 후 일)', terms.deemedApprovalDays, (raw) =>
            setTerms((t) => ({ ...t, deemedApprovalDays: digits(raw) })),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">해지 기준 (제10조·제12조)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {numberInput('terms.clientUnresponsiveDays', '의뢰인 무응답(일)', terms.clientUnresponsiveDays, (raw) =>
            setTerms((t) => ({ ...t, clientUnresponsiveDays: digits(raw) })),
          )}
          {numberInput('terms.paymentDelayDays', '대금 지체(일)', terms.paymentDelayDays, (raw) =>
            setTerms((t) => ({ ...t, paymentDelayDays: digits(raw) })),
          )}
          {numberInput('terms.studioDelayWeeks', '스튜디오 지연(주)', terms.studioDelayWeeks, (raw) =>
            setTerms((t) => ({ ...t, studioDelayWeeks: digits(raw) })),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">입금 계좌·크레딧</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="은행" id="terms.payment.bank" error={errorMap['terms.payment.bank']} className={ADMIN_FIELD}>
            <TextInput light className="text-sm" value={terms.payment.bank} onChange={(e) => setTerms((t) => ({ ...t, payment: { ...t.payment, bank: e.target.value } }))} />
          </Field>
          <Field label="계좌번호" id="terms.payment.account" error={errorMap['terms.payment.account']} className={ADMIN_FIELD}>
            <TextInput light className="text-sm" value={terms.payment.account} onChange={(e) => setTerms((t) => ({ ...t, payment: { ...t.payment, account: e.target.value } }))} />
          </Field>
          <Field label="예금주" id="terms.payment.holder" error={errorMap['terms.payment.holder']} className={ADMIN_FIELD}>
            <TextInput light className="text-sm" value={terms.payment.holder} onChange={(e) => setTerms((t) => ({ ...t, payment: { ...t.payment, holder: e.target.value } }))} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="크레딧 표기 (제7조 3항)" id="terms.credits" error={errorMap['terms.credits']} className={ADMIN_FIELD}>
            <TextInput light className="text-sm" value={terms.credits} onChange={(e) => setTerms((t) => ({ ...t, credits: e.target.value }))} />
          </Field>
        </div>
      </section>

      <section>
        <Field label="계약 제목" id="title" error={errorMap.title} hint="비워 두면 “○○○님 음원 제작 용역 계약”으로 저장됩니다." className={ADMIN_FIELD}>
          <TextInput light className="text-sm" value={values.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
      </section>

      {generalError && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{generalError}</div>}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
        <Button light type="submit" size="lg" disabled={submitting}>
          {submitting ? '저장 중...' : submitLabel}
        </Button>
        <Button
          light
          type="button"
          size="lg"
          variant="weak"
          disabled={submitting}
          onClick={() => {
            if (isDirty && !window.confirm('작성 중인 내용이 사라집니다. 나가시겠습니까?')) return;
            onCancel();
          }}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
