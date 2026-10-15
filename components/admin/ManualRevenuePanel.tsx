import React, { useState } from 'react';
import { useRouter } from 'next/router';

import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { lightOnlyField } from '../ui/adminFieldClass';

/**
 * 웹사이트를 거치지 않고 계좌·현금으로 받은 매출을 적는 폼과, 이 기간에 적은 기록.
 * 규칙은 lib/ops/manualRevenue.ts. 저장하면 페이지를 다시 읽어 위의 매출 숫자에 바로 합산된다.
 */

export interface ManualRevenueView {
  id: string;
  receivedOn: string;
  typeLabel: string;
  description: string;
  method: string;
  memo: string | null;
  totalAmount: number;
  refundedAmount: number;
}

interface Props {
  today: string;
  types: Array<{ value: string; label: string }>;
  methods: string[];
  entries: ManualRevenueView[];
  periodLabel: string;
  /** 표 조회 실패 사유. 있으면 폼을 닫는다(저장해도 합산되지 않는다). */
  unavailable?: string;
}

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const call = async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<{ ok: boolean; message?: string }> => {
  try {
    const response = await fetch('/api/admin/revenue/manual', {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result?.ok ? { ok: true } : { ok: false, message: result?.message || '처리하지 못했습니다.' };
  } catch {
    return { ok: false, message: '네트워크 오류로 처리하지 못했습니다.' };
  }
};

export const ManualRevenuePanel = ({ today, types, methods, entries, periodLabel, unavailable }: Props) => {
  const router = useRouter();
  const [receivedOn, setReceivedOn] = useState(today);
  const [type, setType] = useState(types[0]?.value ?? 'session');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vatMode, setVatMode] = useState<'included' | 'exempt'>('included');
  const [method, setMethod] = useState(methods[0] ?? '계좌 입금');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = () => router.replace(router.asPath);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const total = Number(amount.replace(/,/g, ''));
    setBusy(true);
    setMessage(null);
    const result = await call('POST', { receivedOn, type, description, totalAmount: total, vatMode, method, memo });
    setBusy(false);
    if (!result.ok) return setMessage({ tone: 'error', text: result.message ?? '저장하지 못했습니다.' });
    setDescription('');
    setAmount('');
    setMemo('');
    setMessage({ tone: 'success', text: `${won(total)}을 기록했습니다.` });
    await refresh();
  };

  const setRefund = async (entry: ManualRevenueView) => {
    const input = window.prompt(`돌려준 금액(누적, 원) — 받은 금액 ${won(entry.totalAmount)} 이하`, String(entry.refundedAmount));
    if (input === null) return;
    const result = await call('PATCH', { id: entry.id, refundedAmount: Number(input.replace(/,/g, '')) });
    if (!result.ok) return setMessage({ tone: 'error', text: result.message ?? '처리하지 못했습니다.' });
    setMessage({ tone: 'success', text: '환불 금액을 고쳤습니다.' });
    await refresh();
  };

  const remove = async (entry: ManualRevenueView) => {
    if (!window.confirm(`"${entry.description}" ${won(entry.totalAmount)} 기록을 지울까요? 되돌릴 수 없습니다.`)) return;
    const result = await call('DELETE', { id: entry.id });
    if (!result.ok) return setMessage({ tone: 'error', text: result.message ?? '지우지 못했습니다.' });
    setMessage({ tone: 'success', text: '기록을 지웠습니다.' });
    await refresh();
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm md:p-8">
      <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">직접 받은 매출 기록</h2>
      <p className="mb-4 text-xs text-gray-500">
        카톡·전화로 받아 사이트를 거치지 않고 계좌·현금으로 들어온 돈을 적습니다. 위 매출 숫자에 바로 합산됩니다. 예약 일정·메일은 만들지 않습니다.
        이름·연락처 칸은 없으니 필요하면 내용에 적어 주세요.
      </p>

      {unavailable ? (
        <Notice tone="error" light>
          {unavailable}
        </Notice>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Field id="mr-date" label="받은 날" required className={`md:col-span-2 ${lightOnlyField}`}>
            <TextInput type="date" value={receivedOn} max={today} onChange={(e) => setReceivedOn(e.target.value)} required light />
          </Field>
          <Field id="mr-type" label="유형" required className={`md:col-span-2 ${lightOnlyField}`}>
            <Select value={type} onChange={(e) => setType(e.target.value)} light>
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="mr-method" label="받은 방법" required className={`md:col-span-2 ${lightOnlyField}`}>
            <Select value={method} onChange={(e) => setMethod(e.target.value)} light>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="mr-desc" label="내용" required hint="예: 녹음 3시간 — 김OO" className={`md:col-span-3 ${lightOnlyField}`}>
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} required light />
          </Field>
          <Field id="mr-amount" label="받은 금액 (원)" required hint="부가세 포함 총액" className={`md:col-span-2 ${lightOnlyField}`}>
            <TextInput inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} required light />
          </Field>
          <Field id="mr-vat" label="부가세" required className={`md:col-span-1 ${lightOnlyField}`}>
            <Select value={vatMode} onChange={(e) => setVatMode(e.target.value as 'included' | 'exempt')} light>
              <option value="included">과세 (포함)</option>
              <option value="exempt">면세·없음</option>
            </Select>
          </Field>
          <Field id="mr-memo" label="메모" className={`md:col-span-6 ${lightOnlyField}`}>
            <TextInput value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} light />
          </Field>
          <div className="md:col-span-6">
            <Button light type="submit" disabled={busy}>
              {busy ? '저장 중…' : '기록하기'}
            </Button>
          </div>
        </form>
      )}

      {message && (
        <Notice tone={message.tone} light className="mt-4">
          {message.text}
        </Notice>
      )}

      <h3 className="mb-2 mt-8 text-sm font-bold text-gray-900 dark:text-gray-900">{periodLabel}에 적은 기록 ({entries.length}건)</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">이 기간에 직접 기록한 매출이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {entry.description} <span className="font-normal text-gray-500">· {entry.typeLabel}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {entry.receivedOn} · {entry.method}
                  {entry.memo ? ` · ${entry.memo}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-gray-900">
                  {won(entry.totalAmount)}
                  {entry.refundedAmount > 0 && <span className="text-red-700"> (환불 -{won(entry.refundedAmount)})</span>}
                </span>
                <button type="button" onClick={() => setRefund(entry)} className="text-xs text-primary hover:underline">
                  환불 기록
                </button>
                <button type="button" onClick={() => remove(entry)} className="text-xs text-red-700 hover:underline">
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
