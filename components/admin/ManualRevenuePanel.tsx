import React, { useState } from 'react';
import { useRouter } from 'next/router';

import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { lightOnlyField } from '../ui/adminFieldClass';
import { BUSINESS_LINE_LABELS, BUSINESS_LINES, lineOfType, type BusinessLine } from '../../lib/ops/businessLine';

/**
 * 웹사이트를 거치지 않고 계좌·현금으로 받은 매출을 적는 폼과, 이 기간에 적은 기록.
 * 규칙은 lib/ops/manualRevenue.ts. 저장하면 페이지를 다시 읽어 위의 매출 숫자에 바로 합산된다.
 */

export interface ManualRevenueView {
  id: string;
  receivedOn: string;
  typeLabel: string;
  /** 이 기록이 세어지는 분야 이름(지정 또는 유형의 기본값). */
  lineLabel?: string;
  /** 유형 값(기본 분야 표기용)과 운영자가 고른 분야(없으면 유형대로). 둘 다 있어야 목록에서 분야를 바꿀 수 있다. */
  typeKey?: string;
  assignedLine?: BusinessLine | null;
  /** 중복 의심 설명(manualRevenueDuplicates.ts). 있으면 "중복 아님" 버튼이 뜬다. */
  duplicateOf?: string | null;
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

/** 판매·중개 유형 — 받은 돈 전액이 아니라 스튜디오 수수료 몫만 매출이다(lib/ops/platformFee.ts와 같은 원칙). */
const FEE_ONLY_TYPES = new Set(['funding', 'ticket', 'merch']);

const call = async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<{ ok: boolean; message?: string; warning?: string; code?: string }> => {
  try {
    const response = await fetch('/api/admin/revenue/manual', {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result?.ok
      ? { ok: true, warning: typeof result.warning === 'string' ? result.warning : undefined }
      : { ok: false, message: result?.message || '처리하지 못했습니다.', code: typeof result?.code === 'string' ? result.code : undefined };
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
  /** '' = 유형의 기본 분야. */
  const [businessLine, setBusinessLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = () => router.replace(router.asPath);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const total = Number(amount.replace(/,/g, ''));
    setBusy(true);
    setMessage(null);
    const payload = { receivedOn, type, description, totalAmount: total, vatMode, method, memo, businessLine };
    let result = await call('POST', payload);
    // 같은 돈이 이미 적혀 있을 수 있다는 경고 — 막지 않고 확인을 받는다. 확인하면 메모에 [중복 아님]이 붙어 운영 점검이 다시 묻지 않는다.
    if (!result.ok && result.code === 'possible_duplicate') {
      if (!window.confirm(`${result.message}\n\n다른 거래가 맞으면 "확인"을 눌러 그래도 저장하세요.`)) {
        setBusy(false);
        return setMessage({ tone: 'error', text: '저장하지 않았습니다. 이미 적힌 주문·기록을 확인해 주세요.' });
      }
      result = await call('POST', { ...payload, confirmDuplicate: true });
    }
    setBusy(false);
    if (!result.ok) return setMessage({ tone: 'error', text: result.message ?? '저장하지 못했습니다.' });
    setDescription('');
    setAmount('');
    setMemo('');
    setBusinessLine('');
    setMessage(result.warning ? { tone: 'error', text: result.warning } : { tone: 'success', text: `${won(total)}을 기록했습니다.` });
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

  const changeLine = async (entry: ManualRevenueView, next: string) => {
    const label = next === '' ? `유형대로(${BUSINESS_LINE_LABELS[lineOfType(entry.typeKey ?? 'other')]})` : BUSINESS_LINE_LABELS[next as BusinessLine];
    if (!window.confirm(`"${entry.description}"의 분야를 ${label}(으)로 바꿀까요? 바꾼 사람·날짜가 메모에 남습니다.`)) return;
    const result = await call('PATCH', { id: entry.id, businessLine: next });
    if (!result.ok) return setMessage({ tone: 'error', text: result.message ?? '분야를 바꾸지 못했습니다.' });
    setMessage({ tone: 'success', text: `분야를 ${label}(으)로 바꿨습니다.` });
    await refresh();
  };

  const ackDuplicate = async (entry: ManualRevenueView) => {
    if (!window.confirm(`"${entry.description}"은(는) ${entry.duplicateOf}와 다른 거래가 맞나요? 메모에 [중복 아님]을 남기고 더 묻지 않습니다.`)) return;
    const result = await call('PATCH', { id: entry.id, action: 'ackDuplicate' });
    if (!result.ok) return setMessage({ tone: 'error', text: result.message ?? '처리하지 못했습니다.' });
    setMessage({ tone: 'success', text: '중복 아님으로 표시했습니다.' });
    await refresh();
  };

  const remove = async (entry: ManualRevenueView) => {
    if (!window.confirm(`"${entry.description}" ${won(entry.totalAmount)} 기록을 지울까요? 매출에서 빠지고, 누가 지웠는지는 기록됩니다.`)) return;
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
          <Field
            id="mr-amount"
            label="받은 금액 (원)"
            required
            hint={FEE_ONLY_TYPES.has(type) ? '스튜디오 수수료 몫만 적으세요(받은 전액 아님) · 부가세 포함' : '부가세 포함 총액'}
            className={`md:col-span-2 ${lightOnlyField}`}>
            <TextInput inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} required light />
          </Field>
          <Field id="mr-vat" label="부가세" required className={`md:col-span-1 ${lightOnlyField}`}>
            <Select value={vatMode} onChange={(e) => setVatMode(e.target.value as 'included' | 'exempt')} light>
              <option value="included">과세 (포함)</option>
              <option value="exempt">면세·없음</option>
            </Select>
          </Field>
          <Field
            id="mr-line"
            label="분야"
            hint={type === 'session' ? '연습실 시간제면 분야를 연습실로 고르세요 · 비우면 유형으로 정해요' : '비우면 유형으로 정해요'}
            className={`md:col-span-2 ${lightOnlyField}`}>
            <Select value={businessLine} onChange={(e) => setBusinessLine(e.target.value)} light>
              <option value="">유형대로 ({BUSINESS_LINE_LABELS[lineOfType(type)]})</option>
              {BUSINESS_LINES.map((line) => (
                <option key={line} value={line}>
                  {BUSINESS_LINE_LABELS[line]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="mr-memo" label="메모" className={`md:col-span-4 ${lightOnlyField}`}>
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
                  {entry.description} <span className="font-normal text-gray-500">· {entry.typeLabel}{entry.lineLabel ? ` · ${entry.lineLabel}` : ''}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {entry.receivedOn} · {entry.method}
                  {entry.memo ? ` · ${entry.memo}` : ''}
                </p>
                {entry.duplicateOf && (
                  <p className="mt-1 text-xs font-medium text-amber-800">
                    중복 의심: {entry.duplicateOf}{' '}
                    <button type="button" onClick={() => ackDuplicate(entry)} className="ml-1 text-primary underline">
                      중복 아님
                    </button>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {entry.typeKey && (
                  <select
                    aria-label={`${entry.description} 분야`}
                    value={entry.assignedLine ?? ''}
                    onChange={(e) => changeLine(entry, e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <option value="">유형대로 ({BUSINESS_LINE_LABELS[lineOfType(entry.typeKey)]})</option>
                    {BUSINESS_LINES.map((line) => (
                      <option key={line} value={line}>
                        {BUSINESS_LINE_LABELS[line]}
                      </option>
                    ))}
                  </select>
                )}
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
