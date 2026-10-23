import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { tenancyCalendarId } from '../../../lib/tenancy/calendar';
import { smsHref, telHref } from '../../../lib/tenancy/contactLink';
import { currentTermEnd, daysBetween, flagsOf, kstToday, overdueDays, type TenancyFlag } from '../../../lib/tenancy/rules';
import { listTenancies, type TenancyListRow } from '../../../lib/tenancy/service';
import { buttonVariants } from '../../../components/ui/Button';
import { DANGER_GHOST_CLASS } from '../../../components/admin/adminDanger';
import { cn } from '../../../lib/utils';
import { formatAdminDate } from '../../../lib/admin/displayDate';
import { ROW_BTN, ROW_BTN_DANGER, ROW_LINK, RowActions, RowLinks, StatusChip, StatusStack, Th } from '../../../components/admin/AdminTable';
import { DangerActions } from '../../../components/admin/DangerActions';
import { useAdminDialog } from '../../../components/admin/useAdminDialog';

interface Props {
  rows: TenancyListRow[];
  today: string;
  calendarConfigured: boolean;
  tableMissing: boolean;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  let rows: TenancyListRow[] = [];
  let tableMissing = false;
  try {
    rows = await listTenancies();
  } catch {
    tableMissing = true; // 마이그레이션 0066 전
  }
  return { props: { rows, today: kstToday(), calendarConfigured: tenancyCalendarId() !== null, tableMissing } };
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
// 보조 버튼도 공용 Button 모양으로 — 예전엔 py-1.5 손 조립이라 옆의 '저장'(h-11)과 높이가 달랐다.
const btn = buttonVariants({ variant: 'secondary', size: 'sm', light: true });
const btnDanger = cn(btn, DANGER_GHOST_CLASS, 'border-red-200');
const btnPrimary = buttonVariants({ variant: 'solid', size: 'sm', light: true });

const FLAG_LABEL: Record<TenancyFlag, { text: string; cls: string }> = {
  overdue: { text: '연체', cls: 'bg-red-100 text-red-800' },
  due_soon: { text: '입금 임박', cls: 'bg-amber-100 text-amber-800' },
  contract_passed: { text: '자동 갱신 중', cls: 'bg-gray-100 text-gray-700' },
  contract_soon: { text: '종료 임박', cls: 'bg-sky-100 text-sky-800' },
};

interface FormState {
  kind: 'room' | 'virtual';
  roomNumber: string;
  tenantName: string;
  monthlyAmount: string;
  depositAmount: string;
  startDate: string;
  endDate: string;
  nextDueOn: string;
  billingDay: string;
  hasWindow: '' | 'yes' | 'no';
  furnishings: string;
  roomListPrice: string;
  note: string;
  phone: string;
  emergencyContact: string;
  email: string;
  businessNumber: string;
  gender: string;
}

const EMPTY: FormState = {
  kind: 'room', roomNumber: '', tenantName: '', monthlyAmount: '', depositAmount: '', startDate: '', endDate: '', nextDueOn: '', billingDay: '',
  hasWindow: '', furnishings: '', roomListPrice: '', note: '', phone: '', emergencyContact: '', email: '', businessNumber: '', gender: '',
};

const formOf = (t: TenancyListRow): FormState => ({
  kind: t.kind, roomNumber: t.roomNumber ?? '', tenantName: t.tenantName, monthlyAmount: String(t.monthlyAmount),
  depositAmount: t.depositAmount === null ? '' : String(t.depositAmount), startDate: t.startDate, endDate: t.endDate ?? '', nextDueOn: t.nextDueOn,
  billingDay: String(t.billingDay), hasWindow: t.hasWindow === null ? '' : t.hasWindow ? 'yes' : 'no', furnishings: t.furnishings ?? '',
  roomListPrice: t.roomListPrice === null ? '' : String(t.roomListPrice), note: t.note ?? '', phone: '', emergencyContact: '', email: '', businessNumber: '', gender: '',
});

/**
 * 금액 칸을 숫자로 — 쉼표·공백·`원`·`₩`만 걷고 **숫자만 남을 때만** 받는다. "36만원"은 걷고 나면 "36만"이라 숫자가 아니다 —
 * 예전엔 NaN이 JSON에서 null이 돼 서버가 0원으로 저장했다(감사 2026-10-19). 빈 칸은 null, 숫자가 아니면 undefined(= 잘못된 값).
 */
const parseWon = (text: string): number | null | undefined => {
  const cleaned = text.replace(/[,\s원₩]/g, '');
  if (cleaned === '') return null;
  return /^\d{1,12}$/.test(cleaned) ? Number(cleaned) : undefined;
};

const inputOf = (f: FormState) => ({
  kind: f.kind, roomNumber: f.roomNumber, tenantName: f.tenantName, monthlyAmount: parseWon(f.monthlyAmount),
  depositAmount: parseWon(f.depositAmount),
  startDate: f.startDate, endDate: f.endDate || null, nextDueOn: f.nextDueOn, billingDay: f.billingDay || undefined,
  hasWindow: f.hasWindow === '' ? null : f.hasWindow === 'yes', furnishings: f.furnishings, roomListPrice: parseWon(f.roomListPrice), note: f.note,
  private: { phone: f.phone, emergencyContact: f.emergencyContact, email: f.email, businessNumber: f.businessNumber, gender: f.gender },
});

const call = async (url: string, method: 'GET' | 'POST', body?: unknown) => {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined });
  return (await res.json().catch(() => ({ ok: false, message: '응답을 읽지 못했어요.' }))) as Record<string, unknown> & { ok?: boolean; message?: string };
};

export default function AdminTenanciesPage({ rows, today, calendarConfigured, tableMissing }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<TenancyListRow | null>(null);
  /** 연락처 등 상세를 불러왔는가 — 안 불러온 채 저장하면 서버가 암호문을 그대로 둔다. */
  const [privateLoaded, setPrivateLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useAdminDialog();
  const [notice, setNotice] = useState<string | null>(null);
  const [showEnded, setShowEnded] = useState(false);

  const active = rows.filter((r) => r.status === 'active');
  const ended = rows.filter((r) => r.status === 'ended');
  const rooms = active.filter((r) => r.kind === 'room');
  const virtuals = active.filter((r) => r.kind === 'virtual');
  const overdue = active.filter((r) => overdueDays(r.nextDueOn, today) > 0);
  const monthlyTotal = active.reduce((sum, r) => sum + r.monthlyAmount, 0);

  const finish = (data: { ok?: boolean; message?: string; calendarError?: string | null }, okText: string) => {
    if (!data.ok) { setNotice(data.message ?? '처리하지 못했어요.'); setBusy(false); return; }
    setNotice(data.calendarError ? `${okText} 다만 캘린더는 맞추지 못했어요: ${data.calendarError}` : okText);
    // 하드 새로고침이 아니라 데이터만 다시 읽는다 — 그래야 위 안내(캘린더 오류 등)가 화면에 남는다.
    setForm(null);
    setBusy(false);
    void router.replace(router.asPath, undefined, { scroll: false });
  };

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setPrivateLoaded(true); };
  const openEdit = (t: TenancyListRow) => { setEditing(t); setForm(formOf(t)); setPrivateLoaded(false); };

  const loadPrivate = async () => {
    if (!editing) return;
    setBusy(true);
    const data = await call(`/api/admin/tenancies/${editing.id}/private`, 'GET');
    setBusy(false);
    if (!data.ok) { setNotice(data.message ?? '읽지 못했어요.'); return; }
    const p = (data.private ?? {}) as Record<string, string | undefined>;
    setForm((f) => f && ({ ...f, phone: p.phone ?? '', emergencyContact: p.emergencyContact ?? '', email: p.email ?? '', businessNumber: p.businessNumber ?? '', gender: p.gender ?? '' }));
    setPrivateLoaded(true);
  };

  /**
   * 문자·전화 — 연락처를 그 자리에서 불러와(열람 기록이 남는다) 메시지 앱(`sms:`)·전화 앱(`tel:`)을 연다. 연락처는 목록 props에 없으므로 누를 때만 읽는다.
   * 입주 기록에 번호가 없으면 계약서에 적힌 번호로 연결하고(저장해 두라고 안내), 그것도 없으면 수정 화면을 열어 번호를 넣게 한다.
   */
  const contact = async (t: TenancyListRow, kind: 'sms' | 'tel') => {
    if (busy) return;
    setBusy(true);
    const data = await call(`/api/admin/tenancies/${t.id}/private`, 'GET');
    setBusy(false);
    if (!data.ok) { setNotice(data.message ?? '연락처를 읽지 못했어요.'); return; }
    const p = (data.private ?? {}) as Record<string, string | undefined>;
    const contractPhone = typeof data.contractPhone === 'string' ? data.contractPhone : null;
    const own = kind === 'sms' ? smsHref(p.phone) : telHref(p.phone);
    const fromContract = kind === 'sms' ? smsHref(contractPhone) : telHref(contractPhone);
    const href = own ?? fromContract;
    if (href) {
      if (!own) setNotice(`${t.tenantName}님의 입주 기록에는 연락처가 없어서 계약서에 적힌 번호로 연결해요. 상세·수정에서 연락처를 저장해 두면 다음부터 바로 연결돼요.`);
      window.location.href = href;
      return;
    }
    // 번호가 없다 — 수정 화면을 연락처가 열린 채로 열어 바로 입력하게 한다.
    setNotice(p.phone || contractPhone ? `${t.tenantName}님의 번호 형식을 알아볼 수 없어요. 연락처를 고쳐 주세요.` : `${t.tenantName}님의 연락처가 등록돼 있지 않아요. 아래에 입력해 저장해 주세요.`);
    setEditing(t);
    setForm({ ...formOf(t), phone: p.phone ?? '', emergencyContact: p.emergencyContact ?? '', email: p.email ?? '', businessNumber: p.businessNumber ?? '', gender: p.gender ?? '' });
    setPrivateLoaded(true);
    // 목록이 길면 폼이 화면 밖이라 "아래에 입력"이 안 보인다 — 열린 폼으로 데려간다.
    setTimeout(() => document.getElementById('tenancy-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || busy) return;
    const bad = ([['월 이용료', form.monthlyAmount, false], ['보증금', form.depositAmount, true], ['방 정가', form.roomListPrice, true]] as const)
      .find(([, text, optional]) => parseWon(text) === undefined || (!optional && parseWon(text) === null));
    if (bad) {
      setNotice(`${bad[0]}은 숫자로만 적어 주세요(예: 360000). “36만원” 같은 표기는 받지 않아요.`);
      return;
    }
    setBusy(true);
    const data = editing
      ? await call(`/api/admin/tenancies/${editing.id}`, 'POST', { action: 'update', input: inputOf(form), keepPrivate: !privateLoaded })
      : await call('/api/admin/tenancies', 'POST', { action: 'create', input: inputOf(form) });
    finish(data, '저장했어요.');
  };

  const pay = async (t: TenancyListRow) => {
    const values = await ask({
      title: '입금 기록',
      description: `${t.tenantName} — 입금 예정일 ${formatAdminDate(t.nextDueOn)} 치를 채우고 다음 예정일로 넘어가요.`,
      fields: [{
        name: 'amount',
        label: '입금액 (원)',
        type: 'number',
        defaultValue: String(t.monthlyAmount),
        hint: '기본: 월 이용료',
        required: '입금액을 적어 주세요.',
        validate: (v) => (Number.isInteger(Number(v.replace(/[,\s원]/g, ''))) && Number(v.replace(/[,\s원]/g, '')) >= 0 ? null : '입금액을 원 단위 숫자로 적어 주세요.'),
      }],
      confirmLabel: '입금 기록',
    });
    if (values === null) return;
    const amount = Number(values.amount.replace(/[,\s원]/g, ''));
    if (!Number.isInteger(amount) || amount < 0) { setNotice('입금액을 확인해 주세요.'); return; }
    setBusy(true);
    finish(await call(`/api/admin/tenancies/${t.id}`, 'POST', { action: 'payment', amount }), '입금을 기록했어요.');
  };

  const end = async (t: TenancyListRow) => {
    // 계약서 제5조: 보증금은 면제이고, 약정 기간을 채우지 않고 퇴실하면 보증금 상당액(월 이용료 1개월분)이 위약금이다. 자동 연장 중 통지 종료는 위약금이 없다.
    const early = t.kind === 'room' && t.endDate !== null && today < t.endDate;
    const penaltyNote = early ? `\n\n⚠ 약정 종료일(${formatAdminDate(t.endDate)}) 전 퇴실이에요. 계약서 제5조에 따라 위약금(보증금 상당액 = 월 이용료 1개월분, ${won(t.monthlyAmount)})이 발생할 수 있어요. 갑의 귀책·계약서가 정한 예외가 아닌지 확인하세요.` : '';
    if (!window.confirm(`${t.tenantName}${t.roomNumber ? ` (${t.roomNumber})` : ''} 퇴실 처리할까요? 캘린더 일정이 지워지고 방이 비어요.${penaltyNote}`)) return;
    setBusy(true);
    finish(await call(`/api/admin/tenancies/${t.id}`, 'POST', { action: 'end' }), '퇴실 처리했어요.');
  };

  const reopen = async (t: TenancyListRow) => {
    setBusy(true);
    finish(await call(`/api/admin/tenancies/${t.id}`, 'POST', { action: 'reopen' }), '입주 중으로 되돌렸어요.');
  };

  const syncAll = async () => {
    if (!window.confirm('모든 입주자의 캘린더 일정을 DB 기준으로 다시 맞출까요?')) return;
    setBusy(true);
    const data = await call('/api/admin/tenancies', 'POST', { action: 'sync_all' });
    setBusy(false);
    setNotice(data.ok ? `캘린더를 다시 맞췄어요 (${String(data.total)}명, 실패 ${String(data.failed)}건).` : data.message ?? '실패했어요.');
  };

  const set = (patch: Partial<FormState>) => setForm((f) => f && { ...f, ...patch });
  const field = (label: string, node: React.ReactNode) => (
    <label className="block text-sm text-gray-700">{label}<div className="mt-1">{node}</div></label>
  );

  const table = (list: TenancyListRow[], virtual: boolean) => (
    <>
    {/* 모바일은 표 대신 카드 — 표는 칸이 좁아 날짜가 글자 중간에서 꺾이고 버튼이 화면 밖으로 밀렸다(2026-10-20). */}
    <ul className="space-y-3 lg:hidden">
      {list.map((t) => {
        const flags = flagsOf(t, today);
        const late = overdueDays(t.nextDueOn, today);
        const term = t.status === 'active' && t.endDate && t.endDate < today ? currentTermEnd(t.endDate, today) : null;
        return (
          <li key={t.id} className="rounded-xl border border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-semibold text-gray-900">{virtual ? '비상주' : t.roomNumber} · {t.tenantName}</span>
              <span className="flex flex-wrap gap-1">
                {flags.map((f) => <span key={f} className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${FLAG_LABEL[f].cls}`}>{FLAG_LABEL[f].text}</span>)}
                {t.gcalError && <span title={t.gcalError} className="inline-block whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">캘린더 오류</span>}
              </span>
            </div>
            {t.note && <div className="mt-0.5 text-xs text-gray-500">{t.note}</div>}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-gray-500">월 이용료</dt>
              <dd className="tabular-nums text-gray-900">{won(t.monthlyAmount)}{t.roomListPrice !== null && t.roomListPrice !== t.monthlyAmount && <span className="ml-1 text-xs text-gray-500">(방 정가 {won(t.roomListPrice)})</span>}</dd>
              <dt className="text-gray-500">다음 입금</dt>
              <dd className="tabular-nums text-gray-900">{formatAdminDate(t.nextDueOn)}{late > 0 ? <span className="ml-1 text-xs text-red-700">{late}일 연체</span> : daysBetween(today, t.nextDueOn) <= 7 && <span className="ml-1 text-xs text-amber-700">{daysBetween(today, t.nextDueOn)}일 뒤</span>}</dd>
              <dt className="text-gray-500">계약 종료</dt>
              <dd className="tabular-nums text-gray-900">{formatAdminDate(t.endDate)}{term && <div className="text-xs text-gray-500">갱신 {term.renewals}회 · 이번 기간 {formatAdminDate(term.end)}까지</div>}</dd>
              <dt className="text-gray-500">최근 입금</dt>
              <dd className="tabular-nums text-gray-600">{formatAdminDate(t.lastPaidOn)}{t.lastPaidAmount !== null && t.lastPaidAmount !== t.monthlyAmount && <span className="ml-1 text-xs">({won(t.lastPaidAmount)})</span>}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btn} disabled={busy} onClick={() => pay(t)}>입금 기록</button>
              <button type="button" className={btn} disabled={busy} onClick={() => openEdit(t)}>상세·수정</button>
              <button type="button" className={btn} disabled={busy} onClick={() => void contact(t, 'sms')}>문자</button>
              <button type="button" className={btn} disabled={busy} onClick={() => void contact(t, 'tel')}>전화</button>
              <DangerActions>
                <button type="button" className={btnDanger} disabled={busy} onClick={() => end(t)}>퇴실</button>
              </DangerActions>
            </div>
          </li>
        );
      })}
      {list.length === 0 && <li className="py-4 text-gray-500">없음</li>}
    </ul>
    <div className="hidden overflow-x-auto lg:block">
      {/* 열 너비를 고정한다 — 방 입주·비상주 두 표가 같은 열 위치를 갖게(예전엔 내용 길이대로 열이 갈려 두 표가 어긋났다). */}
      <table className="w-full min-w-[60rem] table-fixed text-sm">
        <colgroup>
          <col className="w-16" />
          <col />
          <col className="w-28" />
          <col className="w-36" />
          <col className="w-40" />
          <col className="w-32" />
          <col className="w-24" />
          <col className="w-[14.5rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <Th>{virtual ? '구분' : '방'}</Th>
            <Th>이름</Th>
            <Th align="right">월 이용료</Th>
            <Th className="pl-5">다음 입금</Th>
            <Th>계약 종료</Th>
            <Th>최근 입금</Th>
            <Th>상태</Th>
            <Th align="right"><span className="sr-only">관리</span></Th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => {
            const flags = flagsOf(t, today);
            const late = overdueDays(t.nextDueOn, today);
            return (
              <tr key={t.id} className="border-b border-gray-100 align-top">
                <td className="py-3 pr-3 font-medium text-gray-900">{virtual ? '비상주' : t.roomNumber}</td>
                <td className="break-keep py-3 pr-3 text-gray-900">{t.tenantName}{t.note && <div className="text-xs text-gray-500">{t.note}</div>}</td>
                <td className="whitespace-nowrap py-3 pr-3 text-right tabular-nums">{won(t.monthlyAmount)}{t.roomListPrice !== null && t.roomListPrice !== t.monthlyAmount && <div className="text-xs text-gray-500">정가 {won(t.roomListPrice)}</div>}</td>
                <td className="whitespace-nowrap py-3 pl-5 pr-3 tabular-nums">
                  {formatAdminDate(t.nextDueOn)}
                  {late > 0 ? <div className="text-xs text-red-700">{late}일 연체</div> : daysBetween(today, t.nextDueOn) <= 7 && <div className="text-xs text-amber-700">{daysBetween(today, t.nextDueOn) === 0 ? '오늘' : `${daysBetween(today, t.nextDueOn)}일 뒤`}</div>}
                </td>
                <td className="py-3 pr-3 tabular-nums">
                  <span className="whitespace-nowrap">{formatAdminDate(t.endDate)}</span>
                  {t.status === 'active' && t.endDate && t.endDate < today && (() => {
                    const term = currentTermEnd(t.endDate, today);
                    return <div className="text-xs text-gray-500">갱신 {term.renewals}회 · <span className="whitespace-nowrap">{formatAdminDate(term.end)}까지</span></div>;
                  })()}
                </td>
                <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-gray-600">{formatAdminDate(t.lastPaidOn)}{t.lastPaidAmount !== null && t.lastPaidAmount !== t.monthlyAmount && <div className="text-xs">{won(t.lastPaidAmount)}</div>}</td>
                <td className="py-3 pr-3">
                  <StatusStack>
                    {flags.map((f) => <StatusChip key={f} className={FLAG_LABEL[f].cls}>{FLAG_LABEL[f].text}</StatusChip>)}
                    {t.gcalError && <StatusChip title={t.gcalError} className="bg-amber-100 text-amber-800">캘린더 오류</StatusChip>}
                  </StatusStack>
                </td>
                <td className="py-2">
                  <RowActions danger={<button type="button" className={ROW_BTN_DANGER} disabled={busy} onClick={() => end(t)}>퇴실</button>}>
                    <button type="button" className={ROW_BTN} disabled={busy} onClick={() => pay(t)}>입금 기록</button>
                    <button type="button" className={ROW_BTN} disabled={busy} onClick={() => openEdit(t)}>상세·수정</button>
                  </RowActions>
                  <RowLinks>
                    <button type="button" className={ROW_LINK} disabled={busy} onClick={() => void contact(t, 'sms')}>문자</button>
                    <button type="button" className={ROW_LINK} disabled={busy} onClick={() => void contact(t, 'tel')}>전화</button>
                  </RowLinks>
                </td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={8} className="py-4 text-gray-500">없음</td></tr>}
        </tbody>
      </table>
    </div>
    </>
  );


  return (
    <>
      <Head><title>입주 관리 | Studio NOL 관리자</title><meta name="robots" content="noindex" /></Head>
      <AdminShell title="입주 관리" width="wide" description="연습실 월 입주자와 비상주 사무실 — 입금 예정일을 구글 캘린더에도 올립니다.">
        {tableMissing && <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">입주 기록을 읽지 못했어요 — 마이그레이션 0066 전이거나 DB 문제예요. 서버 로그를 확인해 주세요.</div>}
        {!calendarConfigured && <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">연습실 캘린더가 설정돼 있지 않아 캘린더 일정은 만들어지지 않아요(환경변수 PRACTICE_ROOM_GCAL_ID 또는 TENANCY_GCAL_ID).</div>}
        {notice && <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</div>}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['입주 중', `${rooms.length}명 + 비상주 ${virtuals.length}곳`], ['월 이용료 합계', won(monthlyTotal)], ['연체', `${overdue.length}건`], ['퇴실', `${ended.length}건`]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs text-gray-500">{k}</div><div className="mt-1 text-lg font-bold text-gray-900">{v}</div></div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={openNew} disabled={busy}>입주 등록</button>
          <button type="button" className={btn} onClick={syncAll} disabled={busy || !calendarConfigured}>캘린더 전체 다시 맞추기</button>
        </div>

        {form && (
          <form id="tenancy-form" onSubmit={save} className="mb-6 grid scroll-mt-20 grid-cols-1 gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4 md:p-6">
            <h2 className="text-lg font-bold text-gray-900 md:col-span-4">{editing ? `${editing.tenantName} 수정` : '입주 등록'}</h2>
            {field('유형', <select className={inputClass} value={form.kind} onChange={(e) => set({ kind: e.target.value as 'room' | 'virtual' })} disabled={!!editing}><option value="room">방 입주</option><option value="virtual">비상주(비대면)</option></select>)}
            {form.kind === 'room' && field('방 번호 (R05)', <input className={inputClass} value={form.roomNumber} onChange={(e) => set({ roomNumber: e.target.value })} required />)}
            {field('이름 / 상호', <input className={inputClass} value={form.tenantName} onChange={(e) => set({ tenantName: e.target.value })} required />)}
            {field('월 이용료 (원)', <input className={inputClass} inputMode="numeric" value={form.monthlyAmount} onChange={(e) => set({ monthlyAmount: e.target.value })} required />)}
            {field('받은 보증금 (원, 면제면 비움)', <input className={inputClass} inputMode="numeric" value={form.depositAmount} onChange={(e) => set({ depositAmount: e.target.value })} />)}
            {field('입주 시작일', <input className={inputClass} type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} required />)}
            {field('계약 종료일 (없으면 비움)', <input className={inputClass} type="date" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />)}
            {field('다음 입금 예정일', <input className={inputClass} type="date" value={form.nextDueOn} onChange={(e) => set({ nextDueOn: e.target.value })} required />)}
            {field('납부일 (비우면 예정일의 일)', <input className={inputClass} inputMode="numeric" value={form.billingDay} onChange={(e) => set({ billingDay: e.target.value })} />)}
            {form.kind === 'room' && field('창', <select className={inputClass} value={form.hasWindow} onChange={(e) => set({ hasWindow: e.target.value as FormState['hasWindow'] })}><option value="">모름</option><option value="yes">있음</option><option value="no">없음</option></select>)}
            {form.kind === 'room' && field('비치 물품', <input className={inputClass} value={form.furnishings} onChange={(e) => set({ furnishings: e.target.value })} />)}
            {form.kind === 'room' && field('방 정가 (원, 모르면 비움)', <input className={inputClass} inputMode="numeric" value={form.roomListPrice} onChange={(e) => set({ roomListPrice: e.target.value })} />)}
            {field('메모·특약', <input className={inputClass} value={form.note} onChange={(e) => set({ note: e.target.value })} />)}

            <div className="rounded-xl border border-gray-200 p-3 md:col-span-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">개인정보 (암호화 저장)</div>
                {editing && !privateLoaded && <button type="button" className={btn} onClick={loadPrivate} disabled={busy}>불러오기(열람 기록이 남아요)</button>}
              </div>
              {editing && !privateLoaded ? (
                <p className="text-sm text-gray-500">{editing.hasPrivate ? '저장돼 있어요. 보거나 고치려면 “불러오기”를 누르세요. 누르지 않고 저장하면 그대로 유지돼요.' : '저장된 개인정보가 없어요. 아래에 적고 저장하려면 “불러오기”를 먼저 눌러 주세요.'}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {field('연락처', <input className={inputClass} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />)}
                  {form.kind === 'room' && field('비상연락처', <input className={inputClass} value={form.emergencyContact} onChange={(e) => set({ emergencyContact: e.target.value })} />)}
                  {form.kind === 'room' && field('성별', <input className={inputClass} value={form.gender} onChange={(e) => set({ gender: e.target.value })} />)}
                  {field('이메일', <input className={inputClass} value={form.email} onChange={(e) => set({ email: e.target.value })} />)}
                  {form.kind === 'virtual' && field('사업자등록번호', <input className={inputClass} value={form.businessNumber} onChange={(e) => set({ businessNumber: e.target.value })} />)}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-4">
              <button type="submit" className={btnPrimary} disabled={busy}>저장</button>
              <button type="button" className={btn} onClick={() => setForm(null)} disabled={busy}>닫기</button>
            </div>
          </form>
        )}

        <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900">방 입주 ({rooms.length})</h2>
          {table(rooms, false)}
        </section>
        <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-bold text-gray-900">비상주 사무실 ({virtuals.length})</h2>
          <p className="mb-3 text-xs text-gray-500">방을 쓰지 않고 사업자등록 주소로만 이용합니다. 시간제 예약·방 점유와 무관해요.</p>
          {table(virtuals, true)}
        </section>
        {ended.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
            <button type="button" className="text-sm font-semibold text-gray-900" onClick={() => setShowEnded((v) => !v)}>퇴실 {ended.length}건 {showEnded ? '접기' : '보기'}</button>
            {showEnded && (
              <ul className="mt-3 divide-y divide-gray-100 text-sm">
                {ended.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{t.roomNumber ?? '비상주'} {t.tenantName} · {formatAdminDate(t.startDate)} ~ {formatAdminDate(t.endedOn)}</span>
                    <button type="button" className={btn} disabled={busy} onClick={() => reopen(t)}>입주 중으로 되돌리기</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {dialog}
      </AdminShell>
    </>
  );
}
