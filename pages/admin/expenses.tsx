import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { AdminShell } from '../../components/admin/AdminShell';
import { Button } from '../../components/ui/Button';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { lightOnlyField } from '../../components/ui/adminFieldClass';
import { kstDateString } from '../../lib/booking/kst';
import { authenticateAdminRequest } from '../../lib/contracts/admin-auth';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_SCOPE_LABELS, expandExpenses, isNonOperatingCategory, loadExpenseRows, summarizeExpenses } from '../../lib/ops/expenses';

/**
 * 지출 관리 — 임대료·청소비·공과금 같은 스튜디오 지출을 적는다. 매출 현황의 "분야별 매출·수익"(분야 매출 − 그 분야 지출, 공통 지출은 전체에서만)이 읽는다.
 * 임대료처럼 매달 같은 금액이면 "매달 반복"으로 한 번만 적는다. 규칙은 lib/ops/expenses.ts.
 */

interface ExpenseView {
  id: string;
  spentOn: string;
  category: string;
  scope: string;
  description: string;
  amount: number;
  repeatMonthly: boolean;
  repeatUntil: string | null;
  memo: string | null;
}

interface MonthScopeTotal {
  scope: string;
  label: string;
  /** 손익에 넣는 지출. */
  total: number;
  /** 손익에 넣지 않는 지출(대출 원금 등). */
  nonOperating: number;
}

interface Props {
  expenses: ExpenseView[];
  /** 이번 달(KST) 구분별 합계. */
  monthLabel?: string;
  monthTotals?: MonthScopeTotal[];
  today: string;
  /** 표를 못 읽은 사유(마이그레이션 0080 전). */
  unavailable: string | null;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const today = kstDateString(new Date());
  try {
    const rows = await loadExpenseRows();
    const expenses = rows
      .map((r) => ({ id: r.id, spentOn: r.spentOn, category: r.category, scope: r.scope, description: r.description, amount: r.amount, repeatMonthly: r.repeatMonthly, repeatUntil: r.repeatUntil, memo: r.memo }))
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn))
      .slice(0, 300);
    const monthKey = today.slice(0, 7);
    const [y, m] = monthKey.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const occurrences = expandExpenses(rows, `${monthKey}-01`, nextMonth);
    const monthTotals = Object.entries(EXPENSE_SCOPE_LABELS).map(([scope, label]) => {
      const summary = summarizeExpenses(occurrences, scope);
      return { scope, label, total: summary.total, nonOperating: summary.nonOperatingTotal };
    });
    return { props: { expenses, today, unavailable: null, monthLabel: `${m}월`, monthTotals } };
  } catch (error: unknown) {
    console.error('[admin/expenses] 조회 실패:', error);
    return { props: { expenses: [], today, unavailable: '지출 표를 읽지 못했습니다(마이그레이션 0080 적용 전이거나 조회 오류).' } };
  }
};

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const call = async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<{ ok: boolean; message?: string }> => {
  try {
    const response = await fetch('/api/admin/expenses', {
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

export default function AdminExpensesPage({ expenses, today, unavailable, monthLabel, monthTotals = [] }: Props) {
  const router = useRouter();
  const [spentOn, setSpentOn] = useState(today);
  const [category, setCategory] = useState('rent');
  const [scope, setScope] = useState('practice');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => router.replace(router.asPath, undefined, { scroll: false });

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    const result = await call('POST', { spentOn, category, scope, description, amount: Number(amount.replace(/[,\s원]/g, '')), repeatMonthly, repeatUntil: repeatMonthly ? repeatUntil : '', memo });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message ?? '저장하지 못했습니다.');
      return;
    }
    setDescription('');
    setAmount('');
    setMemo('');
    setNotice(isNonOperatingCategory(category) ? '적었어요. 대출 원금은 수익에서 빼지 않고 매출 현황의 “손익에 넣지 않는 지출”에 따로 보입니다.' : '지출을 적었어요. 매출 현황의 분야별 수익에 바로 반영됩니다.');
    await refresh();
  };

  const remove = async (e: ExpenseView) => {
    if (!window.confirm(`“${e.description}” ${won(e.amount)}${e.repeatMonthly ? '(매달 반복 전체)' : ''}을 지울까요? 손익에서도 빠집니다.`)) return;
    setBusy(true);
    const result = await call('DELETE', { id: e.id });
    setBusy(false);
    if (!result.ok) setNotice(result.message ?? '지우지 못했습니다.');
    await refresh();
  };

  const endRepeat = async (e: ExpenseView) => {
    const until = window.prompt('반복을 끝낼 마지막 달의 날짜를 YYYY-MM-DD로 적어 주세요(그 달까지 셉니다).', today);
    if (!until) return;
    setBusy(true);
    const result = await call('PATCH', { id: e.id, repeatUntil: until.trim() });
    setBusy(false);
    if (!result.ok) setNotice(result.message ?? '반복을 끝내지 못했습니다.');
    await refresh();
  };

  return (
    <>
      <Head>
        <title>지출 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell title="지출 관리" description="임대료·청소비 같은 지출을 적으면 매출 현황의 분야별 수익(매출 − 지출)에서 빠집니다." width="wide">
        {unavailable && <Notice tone="warning" light>{unavailable}</Notice>}
        {notice && <Notice tone="info" light>{notice}</Notice>}

        <section className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">지출 적기</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field id="exp-date" label={repeatMonthly ? '시작 날짜' : '쓴 날짜'} className={lightOnlyField}><TextInput type="date" value={spentOn} max={today} onChange={(e) => setSpentOn(e.target.value)} light /></Field>
            <Field id="exp-category" label="항목" className={lightOnlyField}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} light>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field id="exp-scope" label="구분" className={lightOnlyField}>
              <Select value={scope} onChange={(e) => setScope(e.target.value)} light>
                {Object.entries(EXPENSE_SCOPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field id="exp-desc" label="내용" className={lightOnlyField}><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 연습실 임대료" light /></Field>
            <Field id="exp-amount" label={repeatMonthly ? '한 달 금액 (부가세 포함, 원)' : '금액 (부가세 포함, 원)'} className={lightOnlyField}><TextInput inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} light /></Field>
            <Field id="exp-memo" label="메모 (선택)" className={lightOnlyField}><TextInput value={memo} onChange={(e) => setMemo(e.target.value)} light /></Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-900">
            <input type="checkbox" checked={repeatMonthly} onChange={(e) => setRepeatMonthly(e.target.checked)} className="h-4 w-4 accent-primary" />
            매달 같은 금액이 나가요(임대료 등) — 한 번만 적으면 시작한 달부터 매달 셉니다
          </label>
          {repeatMonthly && (
            <div className="mt-3 max-w-xs">
              <Field id="exp-until" label="끝나는 날짜 (비우면 계속)" className={lightOnlyField}><TextInput type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} light /></Field>
            </div>
          )}
          <div className="mt-4">
            <Button light disabled={busy || unavailable !== null || description.trim() === '' || amount.trim() === ''} onClick={submit}>{busy ? '저장 중…' : '지출 적기'}</Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            구분이 연습실·녹음·제작·플랫폼이면 그 분야의 수익에서 빠지고, “공통”은 어느 분야에도 나누지 않고 전체 수익에서만 빠집니다.
            항목이 “대출 원금 상환”이면 수익에서 빼지 않고 현금 흐름 참고로만 보입니다(이자는 비용이라 다른 항목으로 적어 주세요). 잘못 적었으면 지우고 다시 적어 주세요.
          </p>
        </section>

        {monthTotals.length > 0 && (
          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">{monthLabel} 구분별 지출</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {monthTotals.map((t) => (
                <div key={t.scope} className="rounded-xl border border-gray-200 p-3">
                  <dt className="text-gray-500">{t.label}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-gray-900">{won(t.total)}</dd>
                  {t.nonOperating > 0 && <dd className="mt-0.5 text-xs text-gray-500">손익 밖 {won(t.nonOperating)} 별도</dd>}
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">적은 지출</h2>
            <Link href="/admin/revenue" className="text-sm font-medium text-primary hover:underline">매출 현황(분야별 수익) →</Link>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-gray-600">아직 적은 지출이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {expenses.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm text-gray-900">
                  <div className="min-w-0">
                    <p className="font-medium">{e.description} <span className="font-normal text-gray-500">· {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category} · {EXPENSE_SCOPE_LABELS[e.scope] ?? e.scope}</span></p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {e.repeatMonthly ? `${e.spentOn}부터 매달${e.repeatUntil ? ` · ${e.repeatUntil.slice(0, 7)}까지` : ' · 계속'}` : e.spentOn}
                      {e.memo ? ` · ${e.memo}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">{won(e.amount)}{e.repeatMonthly ? ' / 월' : ''}</span>
                    {e.repeatMonthly && !e.repeatUntil && <Button light variant="weak" size="sm" disabled={busy} onClick={() => endRepeat(e)}>반복 끝내기</Button>}
                    <Button light variant="weak" size="sm" disabled={busy} onClick={() => remove(e)}>삭제</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AdminShell>
    </>
  );
}
