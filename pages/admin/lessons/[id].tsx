import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../components/admin/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import Link from 'next/link';

import { kstDateString } from '../../../lib/booking/kst';
import { buildLessonSignUrl } from '../../../lib/contracts/lesson/links';
import { LESSON_STATUS_LABEL, getEffectiveLessonStatus } from '../../../lib/contracts/lesson/status';
import { hasDraftMarker } from '../../../lib/contracts/lesson/template';
import { listLessonContractsFor } from '../../../lib/contracts/lesson/service';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { refundOf } from '../../../lib/lessons/refund';
import { ENROLLMENT_STATUS_LABELS, PAYMENT_METHODS, PAY_METHOD_LABELS, SESSION_STATUS_LABELS, WEEKDAY_LABELS, arrearsOf, progressOf, weekdayOf } from '../../../lib/lessons/rules';
import { getEnrollmentDetail } from '../../../lib/lessons/service';

/** 수강 한 건 — 회차(완료·결석·휴강·일정 변경·수업 기록)와 수납. 결석은 보강 없이 소화된 회차로 센다. */

interface SessionView { id: string; seq: number; scheduledOn: string; startTime: string; status: string; topic: string | null; homework: string | null }
interface PaymentView { id: string; paidOn: string; amount: number; vatAmount: number; periodLabel: string; method: string; memo: string | null; receiptIssued: boolean }
/** 계약 행 — 이름·연락처는 싣지 않는다(상세는 접속기록이 남는 계약서 화면에서만). */
interface ContractView {
  id: string;
  status: string;
  statusLabel: string;
  sentAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  /** 확정 전 문안이 남아 발송할 수 없는가. */
  blockedByDraftText: boolean;
  /** 서명 대기일 때 서명 링크 — 운영자가 카톡으로 보낼 수 있게. */
  signUrl: string | null;
  mailFailed: boolean;
}

interface Props {
  contracts?: ContractView[];
  contractsUnavailable?: boolean;
  found: boolean;
  today: string;
  enrollment?: { id: string; studentName: string; status: string; payMethod: string; courseWeeks: number; startDate: string; startTime: string; durationMin: number; monthlyAmount: number; note: string | null; endedOn: string | null; endedReason: string | null };
  sessions?: SessionView[];
  payments?: PaymentView[];
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const today = kstDateString(new Date());
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  const detail = await getEnrollmentDetail(id).catch((error: unknown) => {
    console.error('[admin/lessons/[id]] 조회 실패:', error);
    return null;
  });
  if (!detail) return { props: { found: false, today } };
  const e = detail.enrollment;
  let contracts: ContractView[] = [];
  let contractsUnavailable = false;
  try {
    contracts = (await listLessonContractsFor(id)).map((c) => {
      const effective = getEffectiveLessonStatus(c);
      return {
        id: c.id, status: effective, statusLabel: LESSON_STATUS_LABEL[effective],
        sentAt: c.sentAt ? c.sentAt.toISOString() : null, signedAt: c.signedAt ? c.signedAt.toISOString() : null, expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        blockedByDraftText: hasDraftMarker(c.content) || hasDraftMarker(c.template),
        signUrl: effective === 'sent' && c.signToken ? buildLessonSignUrl(c.id, c.signToken) : null,
        mailFailed: c.notificationError !== null && c.notificationError !== '',
      };
    });
  } catch (error: unknown) {
    console.error('[admin/lessons/[id]] 계약 조회 실패:', error);
    contractsUnavailable = true;
  }
  return {
    props: {
      contracts,
      contractsUnavailable,
      found: true,
      today,
      enrollment: { id: e.id, studentName: e.studentName, status: e.status, payMethod: e.payMethod, courseWeeks: e.courseWeeks, startDate: e.startDate, startTime: e.startTime, durationMin: e.durationMin, monthlyAmount: e.monthlyAmount, note: e.note, endedOn: e.endedOn, endedReason: e.endedReason },
      sessions: detail.sessions.map((s) => ({ id: s.id, seq: s.seq, scheduledOn: s.scheduledOn, startTime: s.startTime, status: s.status, topic: s.topic, homework: s.homework })),
      payments: detail.payments.map((p) => ({ id: p.id, paidOn: p.paidOn, amount: p.amount, vatAmount: p.vatAmount, periodLabel: p.periodLabel, method: p.method, memo: p.memo, receiptIssued: p.receiptIssued })),
    },
  };
};

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-sky-100 text-sky-800', done: 'bg-green-100 text-green-800', absent: 'bg-red-100 text-red-800',
  studio_cancelled: 'bg-amber-100 text-amber-800', dropped: 'bg-gray-100 text-gray-600',
};

export default function AdminLessonDetailPage({ found, today, enrollment, sessions = [], payments = [], contracts = [], contractsUnavailable = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [moveTime, setMoveTime] = useState('');
  const [payOn, setPayOn] = useState(today);
  const [payAmount, setPayAmount] = useState(String(enrollment?.monthlyAmount ?? ''));
  const [payVat, setPayVat] = useState('0');
  const [payPeriod, setPayPeriod] = useState('');
  const [payMethod, setPayMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [payMemo, setPayMemo] = useState('');
  const [receipt, setReceipt] = useState(false);
  const [ctName, setCtName] = useState(enrollment?.studentName ?? '');
  const [ctEmail, setCtEmail] = useState('');
  const [ctPhone, setCtPhone] = useState('');

  if (!found || !enrollment) {
    return (
      <AdminShell title="수강 상세" backHref="/admin/lessons" backLabel="레슨 목록">
        <Notice tone="warning" light>수강 등록을 찾을 수 없어요(마이그레이션 0081 적용 전이거나 지워진 건).</Notice>
      </AdminShell>
    );
  }

  const post = async (body: Record<string, unknown>, success?: string): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    let ok = false;
    try {
      const response = await fetch(`/api/admin/lessons/${enrollment.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      ok = response.ok && result?.ok;
      const warnings: string[] = Array.isArray(result?.warnings) ? result.warnings : [];
      setNotice(ok ? [success, ...warnings].filter(Boolean).join(' ') || null : result?.message || '처리하지 못했습니다.');
    } catch {
      setNotice('네트워크 오류로 처리하지 못했습니다.');
    }
    setBusy(false);
    await router.replace(router.asPath, undefined, { scroll: false });
    return ok;
  };

  const mark = (s: SessionView, status: 'done' | 'absent' | 'studio_cancelled' | 'scheduled') => {
    const confirmText = status === 'absent' ? `${s.scheduledOn} 수업을 결석으로 표시할까요? 보강하지 않아요(회차가 소화된 것으로 셉니다).`
      : status === 'studio_cancelled' ? `${s.scheduledOn} 수업을 스튜디오 사정 휴강으로 표시할까요? 과정 끝에 보충 회차가 하나 붙어요.` : null;
    if (confirmText && !window.confirm(confirmText)) return;
    void post({ action: 'session_status', sessionId: s.id, status }, '표시했어요.');
  };

  const postContract = async (body: Record<string, unknown>, success?: string): Promise<{ ok: boolean; signUrl?: string }> => {
    setBusy(true);
    setNotice(null);
    let result: { ok?: boolean; message?: string; signUrl?: string; emailSent?: boolean } = {};
    try {
      const response = await fetch(`/api/admin/lessons/${enrollment.id}/contract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      result = await response.json().catch(() => ({}));
      result.ok = response.ok && result.ok;
    } catch {
      result = { ok: false, message: '네트워크 오류로 처리하지 못했습니다.' };
    }
    setBusy(false);
    if (!result.ok) setNotice(result.message || '처리하지 못했습니다.');
    else setNotice([success, result.emailSent === false ? '메일이 나가지 않았어요 — 아래 서명 링크를 카톡으로 보내 주세요.' : null].filter(Boolean).join(' ') || null);
    await router.replace(router.asPath, undefined, { scroll: false });
    return { ok: Boolean(result.ok), signUrl: result.signUrl };
  };

  const progress = progressOf(sessions);
  const active = enrollment.status === 'active';
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const refund = refundOf({ consumed: progress.consumed, courseMonths: enrollment.courseWeeks / 4, monthlyAmount: enrollment.monthlyAmount, paidNet: payments.reduce((sum, p) => sum + p.amount - p.vatAmount, 0) });
  const due = arrearsOf({ payMethod: enrollment.payMethod, monthlyAmount: enrollment.monthlyAmount, sessions, payments, today });

  return (
    <>
      <Head>
        <title>{enrollment.studentName} 수강 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title={`${enrollment.studentName} 수강`} description={`${PAY_METHOD_LABELS[enrollment.payMethod]} · ${enrollment.courseWeeks}주 · 매주 ${WEEKDAY_LABELS[weekdayOf(enrollment.startDate)]} ${enrollment.startTime} (${enrollment.durationMin}분)`} backHref="/admin/lessons" backLabel="레슨 목록" width="wide">
        {notice && <Notice tone="info" light>{notice}</Notice>}

        <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">{ENROLLMENT_STATUS_LABELS[enrollment.status]}</span>
            <span>진행 {progress.consumed}/{progress.total}회 (완료 {progress.done} · 결석 {progress.absent} · 남음 {progress.scheduled})</span>
            <span className="text-gray-500">· 월 {won(enrollment.monthlyAmount)}(부가세 별도)</span>
          </p>
          {enrollment.endedOn && <p className="mt-1 text-red-800">{enrollment.endedOn} 중도 종료 — {enrollment.endedReason}</p>}
          {enrollment.note && <p className="mt-1 text-gray-600">메모: {enrollment.note}</p>}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">회차</h2>
          <ul className="divide-y divide-gray-100">
            {sessions.map((s) => {
              const overdue = s.status === 'scheduled' && s.scheduledOn < today;
              return (
                <li key={s.id} className="py-3 text-sm text-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {s.seq}회 · {s.scheduledOn}({WEEKDAY_LABELS[weekdayOf(s.scheduledOn)]}) {s.startTime}
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status]}`}>{SESSION_STATUS_LABELS[s.status]}</span>
                      {overdue && <span className="ml-1 text-xs font-medium text-amber-700">표시 필요</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {s.status === 'scheduled' && active && (
                        <>
                          <Button light size="sm" disabled={busy} onClick={() => mark(s, 'done')}>완료</Button>
                          <Button light variant="weak" size="sm" disabled={busy} onClick={() => mark(s, 'absent')}>결석</Button>
                          <Button light variant="weak" size="sm" disabled={busy} onClick={() => mark(s, 'studio_cancelled')}>스튜디오 휴강</Button>
                          <Button light variant="weak" size="sm" disabled={busy} onClick={() => { setMoveId(s.id); setMoveDate(s.scheduledOn); setMoveTime(s.startTime); }}>일정 변경</Button>
                        </>
                      )}
                      {s.status !== 'dropped' && enrollment.status !== 'ended' && (
                        <Button light variant="weak" size="sm" disabled={busy} onClick={() => {
                          const topic = window.prompt('다룬 내용(비우면 지워요)', s.topic ?? '');
                          if (topic === null) return;
                          const homework = window.prompt('과제(비우면 지워요)', s.homework ?? '');
                          if (homework === null) return;
                          void post({ action: 'session_status', sessionId: s.id, status: s.status, topic, homework }, '수업 기록을 저장했어요.');
                        }}>기록</Button>
                      )}
                      {s.status !== 'scheduled' && s.status !== 'dropped' && enrollment.status !== 'ended' && (
                        <Button light variant="weak" size="sm" disabled={busy} onClick={() => mark(s, 'scheduled')}>되돌리기</Button>
                      )}
                    </div>
                  </div>
                  {(s.topic || s.homework) && <p className="mt-1 text-xs text-gray-600">{s.topic ? `다룬 내용: ${s.topic}` : ''}{s.topic && s.homework ? ' · ' : ''}{s.homework ? `과제: ${s.homework}` : ''}</p>}
                  {moveId === s.id && (
                    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-3">
                      <Field id={`mv-d-${s.id}`} label="날짜" className={lightOnlyField}><TextInput type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} light /></Field>
                      <Field id={`mv-t-${s.id}`} label="시각" className={lightOnlyField}><TextInput type="time" value={moveTime} onChange={(e) => setMoveTime(e.target.value)} light /></Field>
                      <Button light size="sm" disabled={busy} onClick={async () => { if (await post({ action: 'reschedule', sessionId: s.id, date: moveDate, time: moveTime }, '일정을 바꿨어요.')) setMoveId(null); }}>바꾸기</Button>
                      <Button light variant="weak" size="sm" disabled={busy} onClick={() => setMoveId(null)}>닫기</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">수납</h2>
          {enrollment.payMethod === 'card' ? (
            <p className="text-sm text-gray-600">카드 정기결제 수강은 구독 결제가 장부예요(관리자 구독 메뉴). 구독을 이 수강에 연결하는 기능은 다음 단계에서 붙어요 — 지금은 구독 화면에서 결제 상태를 보세요.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">누계 {won(paid)} · 매출 현황의 “프로듀싱 레슨”에 수납일 기준으로 들어가요.</p>
              {active && due.arrears > 0 && (
                <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">미수 <strong>{won(due.arrears)}</strong> — 지금까지 {due.monthsDue}개월 치({won(due.expected)}) 중 부가세를 뺀 받은 돈이 {won(due.paidNet)}이에요. 받았다면 아래에서 수납을 기록해 주세요.</p>
              )}
              {payments.length > 0 && (
                <ul className="mb-4 divide-y divide-gray-100 text-sm text-gray-900">
                  {payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>{p.paidOn} · {p.periodLabel} · {p.method}{p.vatAmount > 0 ? ` · 부가세 ${won(p.vatAmount)}` : ''}{p.receiptIssued ? ' · 증빙 발행' : ''}{p.memo ? ` · ${p.memo}` : ''}</span>
                      <span className="flex items-center gap-2">
                        <strong className="tabular-nums">{won(p.amount)}</strong>
                        <Button light variant="weak" size="sm" disabled={busy} onClick={() => { if (window.confirm(`${p.paidOn} ${won(p.amount)} 수납 기록을 지울까요? 매출에서도 빠집니다.`)) void post({ action: 'payment_delete', paymentId: p.id }, '지웠어요.'); }}>삭제</Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field id="pay-on" label="받은 날짜" className={lightOnlyField}><TextInput type="date" value={payOn} max={today} onChange={(e) => setPayOn(e.target.value)} light /></Field>
                <Field id="pay-amount" label="받은 금액 (원)" className={lightOnlyField}><TextInput inputMode="numeric" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} light /></Field>
                <Field id="pay-vat" label="그중 부가세 (안 받았으면 0)" className={lightOnlyField}><TextInput inputMode="numeric" value={payVat} onChange={(e) => setPayVat(e.target.value)} light /></Field>
                <Field id="pay-period" label="어느 기간 치" className={lightOnlyField}><TextInput value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} placeholder="예: 10월, 1~4회, 12주 일괄" light /></Field>
                <Field id="pay-method" label="받은 방법" className={lightOnlyField}>
                  <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} light>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</Select>
                </Field>
                <Field id="pay-memo" label="메모 (선택)" className={lightOnlyField}><TextInput value={payMemo} onChange={(e) => setPayMemo(e.target.value)} light /></Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-900"><input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} className="h-4 w-4 accent-primary" />현금영수증·세금계산서를 발행했어요</label>
              <div className="mt-3">
                <Button light disabled={busy || payPeriod.trim() === ''} onClick={async () => { if (await post({ action: 'payment_add', paidOn: payOn, amount: Number(payAmount.replace(/[,\s원]/g, '')), vatAmount: Number(payVat.replace(/[,\s원]/g, '')) || 0, periodLabel: payPeriod, method: payMethod, memo: payMemo, receiptIssued: receipt }, '수납을 기록했어요.')) { setPayPeriod(''); setPayMemo(''); } }}>수납 기록</Button>
              </div>
            </>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">수강 계약</h2>
          {contractsUnavailable ? (
            <p className="text-gray-600">계약 표를 읽지 못했어요(마이그레이션 0082 적용 전이거나 조회 오류).</p>
          ) : (
            <>
              <p className="mb-3 text-gray-600">전자서명 계약서를 보내고 체결 여부를 봐요. 수강생의 연락처·이메일은 이 계약에서 받아요(수강생이 서명 때 연락처 뒤 4자리로 본인 확인).</p>
              {contracts.length > 0 && (
                <ul className="mb-4 divide-y divide-gray-100">
                  {contracts.map((c) => (
                    <li key={c.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">{c.statusLabel}</span>
                          {c.sentAt && <span className="ml-2 text-gray-600">발송 {new Date(c.sentAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>}
                          {c.signedAt && <span className="ml-2 text-gray-600">체결 {new Date(c.signedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>}
                          {c.mailFailed && <span className="ml-2 text-xs font-medium text-red-700">메일 실패</span>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/admin/lessons/contract/${c.id}`}><Button light variant="weak" size="sm">{c.status === 'signed' ? '서명본 보기' : '문안 보기'}</Button></Link>
                          {(c.status === 'draft' || c.status === 'expired') && (
                            <Button light size="sm" disabled={busy || c.blockedByDraftText} onClick={() => { if (window.confirm('계약서를 수강생에게 보낼까요? 보내는 것이 스튜디오의 서명이에요.')) void postContract({ action: 'send', contractId: c.id }, '계약서를 보냈어요.'); }}>
                              {c.status === 'draft' ? '보내기' : '다시 보내기'}
                            </Button>
                          )}
                          {c.status === 'sent' && (
                            <>
                              <Button light variant="weak" size="sm" disabled={busy} onClick={() => { if (c.signUrl) { void navigator.clipboard?.writeText(c.signUrl); setNotice('서명 링크를 복사했어요.'); } }}>링크 복사</Button>
                              <Button light variant="weak" size="sm" disabled={busy} onClick={() => { if (window.confirm('새 링크로 다시 보낼까요? 이전 링크는 못 써요.')) void postContract({ action: 'send', contractId: c.id }, '다시 보냈어요.'); }}>다시 보내기</Button>
                            </>
                          )}
                          {(c.status === 'draft' || c.status === 'sent' || c.status === 'expired') && (
                            <Button light variant="weak" size="sm" disabled={busy} onClick={() => { if (window.confirm('계약을 취소할까요? 보낸 링크는 못 쓰게 돼요.')) void postContract({ action: 'cancel', contractId: c.id }, '취소했어요.'); }}>취소</Button>
                          )}
                        </div>
                      </div>
                      {c.blockedByDraftText && (c.status === 'draft' || c.status === 'expired') && (
                        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">문안에 확정 전 표시가 남아 있어 보낼 수 없어요 — 계약을 취소하고 새로 만들어 주세요.</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!contracts.some((c) => c.status !== 'cancelled') && enrollment.status !== 'ended' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field id="ct-name" label="수강생 실명" className={lightOnlyField}><TextInput value={ctName} onChange={(e) => setCtName(e.target.value)} light /></Field>
                  <Field id="ct-email" label="이메일 (서명 요청·체결 메일)" className={lightOnlyField}><TextInput type="email" value={ctEmail} onChange={(e) => setCtEmail(e.target.value)} light /></Field>
                  <Field id="ct-phone" label="연락처 (본인 확인에 뒤 4자리)" className={lightOnlyField}><TextInput type="tel" value={ctPhone} onChange={(e) => setCtPhone(e.target.value)} light /></Field>
                  <div className="md:col-span-3">
                    <Button light disabled={busy || ctName.trim() === '' || ctEmail.trim() === '' || ctPhone.trim() === ''} onClick={() => void postContract({ action: 'create', studentName: ctName, studentEmail: ctEmail, studentPhone: ctPhone }, '계약 초안을 만들었어요.')}>계약 초안 만들기</Button>
                    <span className="ml-3 text-xs text-gray-500">초안은 아직 보내지 않아요. 문안을 확인한 뒤 보내기를 눌러요.</span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {active && (
          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
            <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-900">중도 종료</h2>
            <p className="mb-3 text-sm text-gray-600">남은 예정 회차를 취소하고 막아 둔 시간을 풀어요. 환불은 수납 기록·구독 환불에서 따로 처리해 주세요.</p>
            <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
              <p className="font-semibold">지금 해지하면 환불 기준액 <span className="text-primary-700">{won(refund.refund)}</span>{enrollment.payMethod === 'card' && refund.refund > 0 ? ` (카드는 부가세 포함 ${won(Math.round(refund.refund * 1.1))} 취소)` : ''}</p>
              <p className="mt-1 text-xs text-gray-600">{refund.note} · 진행 {progress.consumed}회(결석 포함) · 낸 수강료(부가세 제외) {won(payments.reduce((sum, p) => sum + p.amount - p.vatAmount, 0))} − 스튜디오 몫 {won(refund.retained)}.{refund.shortfall > 0 ? ` 낸 돈이 ${won(refund.shortfall)} 모자라요.` : ''} 계약서 제9조(시행령 별표 4) 기준이에요. 해지 통지를 받은 날부터 5일 안에 보내야 하고, 오늘 수업을 아직 표시하지 않았다면 먼저 표시한 뒤 보세요.</p>
            </div>
            <Button light variant="weak" disabled={busy} onClick={() => { const reason = window.prompt('중도 종료 사유를 적어 주세요.'); if (reason && reason.trim().length >= 2 && window.confirm('남은 회차를 모두 취소하고 수강을 종료할까요? 되돌릴 수 없어요.')) void post({ action: 'end', reason }, '종료했어요.'); }}>중도 종료</Button>
          </section>
        )}
      </AdminShell>
    </>
  );
}
