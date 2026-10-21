import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../components/admin/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { LESSON_MONTHLY_PRICE } from '../../../data/pricing';
import { kstDateString } from '../../../lib/booking/kst';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { ENROLLMENT_STATUS_LABELS, PAY_METHOD_LABELS, WEEKDAY_LABELS, weekdayOf } from '../../../lib/lessons/rules';
import { listEnrollments } from '../../../lib/lessons/service';

/**
 * 레슨 관리 — 수강 등록(회차·컨트롤 룸 예약 불가 시간까지 한 번에)과 수강생 목록. 설계: docs/lesson-management-design-2026-10.md.
 * 결석은 보강하지 않는다. 연락처는 아직 저장하지 않는다(수강 계약 단계에서 받는다).
 */

interface LessonRowView {
  id: string;
  studentName: string;
  status: string;
  payMethod: string;
  courseWeeks: number;
  weekday: number;
  startTime: string;
  total: number;
  consumed: number;
  nextOn: string | null;
  unmarked: number;
  lastPaidOn: string | null;
  paidTotal: number;
  arrears: number;
}

interface Props {
  rows: LessonRowView[];
  today: string;
  unavailable: string | null;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const now = new Date();
  const today = kstDateString(now);
  try {
    const list = await listEnrollments(now);
    const rows: LessonRowView[] = list.map((r) => ({
      id: r.enrollment.id,
      studentName: r.enrollment.studentName,
      status: r.enrollment.status,
      payMethod: r.enrollment.payMethod,
      courseWeeks: r.enrollment.courseWeeks,
      weekday: weekdayOf(r.enrollment.startDate),
      startTime: r.enrollment.startTime,
      total: r.total,
      consumed: r.consumed,
      nextOn: r.nextSession ? `${r.nextSession.scheduledOn} ${r.nextSession.startTime}` : null,
      unmarked: r.unmarked,
      lastPaidOn: r.lastPaidOn,
      paidTotal: r.paidTotal,
      arrears: r.arrears,
    }));
    return { props: { rows, today, unavailable: null } };
  } catch (error: unknown) {
    console.error('[admin/lessons] 조회 실패:', error);
    return { props: { rows: [], today, unavailable: '레슨 표를 읽지 못했습니다(마이그레이션 0081 적용 전이거나 조회 오류).' } };
  }
};

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export default function AdminLessonsPage({ rows, today, unavailable }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [payMethod, setPayMethod] = useState('bank');
  const [courseWeeks, setCourseWeeks] = useState('12');
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState('14:00');
  const [durationMin, setDurationMin] = useState('60');
  const [monthlyAmount, setMonthlyAmount] = useState(String(LESSON_MONTHLY_PRICE));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ studentName, payMethod, courseWeeks: Number(courseWeeks), startDate, startTime, durationMin: Number(durationMin), monthlyAmount: Number(monthlyAmount.replace(/[,\s원]/g, '')), note }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.ok) {
        await router.push(`/admin/lessons/${result.id}`);
        return;
      }
      setNotice(result?.message || '등록하지 못했습니다.');
    } catch {
      setNotice('네트워크 오류로 등록하지 못했습니다.');
    }
    setBusy(false);
  };

  const active = rows.filter((r) => r.status === 'active');
  const finished = rows.filter((r) => r.status !== 'active');

  const card = (r: LessonRowView) => (
    <li key={r.id} className="rounded-xl border border-gray-200 p-3 text-sm text-gray-900">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">
          {r.studentName}
          <span className="ml-2 font-normal text-gray-500">{PAY_METHOD_LABELS[r.payMethod] ?? r.payMethod} · {r.courseWeeks}주 · 매주 {WEEKDAY_LABELS[r.weekday]} {r.startTime}</span>
        </p>
        <span className="flex flex-wrap gap-1">
          {r.status !== 'active' && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{ENROLLMENT_STATUS_LABELS[r.status]}</span>}
          {r.unmarked > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">표시 대기 {r.unmarked}</span>}
          {r.arrears > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">미수 {won(r.arrears)}</span>}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        진행 {r.consumed}/{r.total}회{r.nextOn ? ` · 다음 ${r.nextOn}` : ''}
        {r.payMethod !== 'card' ? ` · ${r.lastPaidOn ? `최근 수납 ${r.lastPaidOn} (누계 ${won(r.paidTotal)})` : '수납 기록 없음'}` : ''}
      </p>
      <div className="mt-2">
        <Link href={`/admin/lessons/${r.id}`}><Button light variant="weak" size="sm">상세</Button></Link>
      </div>
    </li>
  );

  return (
    <>
      <Head>
        <title>레슨 관리 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="레슨 관리" description="프로듀싱 레슨 수강 등록·회차·수납. 결석은 보강하지 않아요." width="wide">
        {unavailable && <Notice tone="warning" light>{unavailable}</Notice>}
        {notice && <Notice tone="warning" light>{notice}</Notice>}

        <section className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">수강 등록</h2>
            {!open && <Button light size="sm" disabled={unavailable !== null} onClick={() => setOpen(true)}>새 수강생 등록</Button>}
          </div>
          {open && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field id="ls-name" label="수강생 이름" className={lightOnlyField}><TextInput value={studentName} onChange={(e) => setStudentName(e.target.value)} light /></Field>
              <Field id="ls-pay" label="결제 방식" className={lightOnlyField}>
                <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} light>
                  <option value="bank">계좌 선불</option>
                  <option value="cash">현금 선불</option>
                  <option value="card">카드 정기결제(구독)</option>
                </Select>
              </Field>
              <Field id="ls-weeks" label="과정" className={lightOnlyField}>
                <Select value={courseWeeks} onChange={(e) => setCourseWeeks(e.target.value)} light>
                  <option value="12">12주</option>
                  <option value="24">24주</option>
                </Select>
              </Field>
              <Field id="ls-date" label="첫 수업 날짜 (이 요일로 매주)" className={lightOnlyField}><TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} light /></Field>
              <Field id="ls-time" label="시작 시각" className={lightOnlyField}><TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} light /></Field>
              <Field id="ls-dur" label="수업 시간(분)" className={lightOnlyField}><TextInput inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} light /></Field>
              <Field id="ls-amount" label="월 수강료 (부가세 별도 공급가, 원)" className={lightOnlyField}><TextInput inputMode="numeric" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} light /></Field>
              <Field id="ls-note" label="메모 (선택)" className={lightOnlyField}><TextInput value={note} onChange={(e) => setNote(e.target.value)} light /></Field>
              <div className="flex flex-wrap items-end gap-2 md:col-span-3">
                <Button light disabled={busy || studentName.trim() === ''} onClick={submit}>{busy ? '등록 중…' : '등록'}</Button>
                <Button light variant="weak" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
              </div>
              <p className="text-xs text-gray-500 md:col-span-3">등록하면 과정 길이만큼 회차가 만들어지고, 그 시간은 웹 예약이 못 잡게 막혀요(녹음실 예약·다른 수업과 겹치면 등록되지 않아요). 연락처는 수강 계약 단계에서 받아요.</p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">수강 중 ({active.length})</h2>
          {active.length === 0 ? <p className="text-sm text-gray-600">수강 중인 분이 없어요.</p> : <ul className="space-y-3">{active.map(card)}</ul>}
        </section>

        {finished.length > 0 && (
          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">수료·종료 ({finished.length})</h2>
            <ul className="space-y-3">{finished.map(card)}</ul>
          </section>
        )}
      </AdminShell>
    </>
  );
}
