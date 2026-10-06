import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { postShowAction } from '../../../components/admin/showActions';
import { AdminShell } from '../../../components/admin/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatKstDeadline } from '../../../lib/payments/bankAccount';
import { findSameNameDepositOrders, type SameNameDepositOrder } from '../../../lib/payments/bankDepositOrders';
import { holderMatchesCustomer, loadRefundAccountSummary } from '../../../lib/payments/refundAccount';
import { loadAdminShowDetail, type AdminOrderRow, type AdminShowDetail, type AdminShowtimeDetail } from '../../../lib/shows/adminQueries';

/** 환불 계좌 요약 — 은행·예금주·시각뿐. 계좌번호는 평문도 암호문도 props에 싣지 않는다("계좌 보기" API로만). */
export interface ShowRefundAccountInfo {
  status: 'present' | 'none' | 'unavailable';
  bankName: string | null;
  accountHolder: string | null;
  holderMismatch: boolean;
  /** epoch 초 */
  updatedAt: number | null;
  refundedAt: number | null;
}

interface AdminShowDetailPageProps {
  show: AdminShowDetail;
  /** orderNo → 환불 계좌 요약(계좌 입금 확정 주문만) */
  refundAccounts?: Record<string, ShowRefundAccountInfo>;
  /** orderNo → 같은 이름의 다른 계좌 입금 신청(입금 대기·취소 주문만) */
  sameNameDeposits?: Record<string, SameNameDepositOrder[]>;
}

const allOrders = (show: AdminShowDetail): AdminOrderRow[] => show.showtimes.flatMap((t) => t.orders);

export const getServerSideProps: GetServerSideProps<AdminShowDetailPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const id = context.params?.id;
  if (typeof id !== 'string') return { notFound: true };
  try {
    const show = await loadAdminShowDetail(id);
    if (!show) return { notFound: true };
    const refundAccounts: Record<string, ShowRefundAccountInfo> = {};
    const sameNameDeposits: Record<string, SameNameDepositOrder[]> = {};
    await Promise.all(allOrders(show).map(async (o) => {
      if (o.bankDeposit === 'paid') {
        const r = await loadRefundAccountSummary({ kind: 'show', orderNo: o.orderNo });
        refundAccounts[o.orderNo] = r.status === 'present'
          ? {
              status: 'present', bankName: r.bankName, accountHolder: r.accountHolder,
              holderMismatch: !holderMatchesCustomer(r.accountHolder, o.customerName),
              updatedAt: Math.floor(r.updatedAt.getTime() / 1000), refundedAt: r.refundedAt ? Math.floor(r.refundedAt.getTime() / 1000) : null,
            }
          : { status: r.status, bankName: null, accountHolder: null, holderMismatch: false, updatedAt: null, refundedAt: null };
      } else if (o.bankDeposit === 'awaiting' || o.bankDeposit === 'cancelled') {
        const found = await findSameNameDepositOrders({ id: o.orderId, customerName: o.customerName });
        if (found.length > 0) sameNameDeposits[o.orderNo] = found;
      }
    }));
    return { props: { show, refundAccounts, sameNameDeposits } };
  } catch (error: unknown) {
    console.error('[admin/shows/[id]] 조회 실패:', error);
    throw error;
  }
};

const STATUS_LABEL: Record<string, string> = { draft: '초안(비공개)', published: '공개', cancelled: '취소' };
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제대기', awaiting_deposit: '계좌 입금 대기', deposit_cancelled: '입금 전 취소', auto_cancel_pending: '자동 취소 처리 중', paid: '확정', partially_refunded: '부분환불', refunded: '환불완료', expired: '만료', failed: '결제실패',
};
const TICKET_STATUS_LABEL: Record<string, string> = { held: '보류', issued: '발권', refunding: '환불중', refunded: '환불', void: '무효' };

const kstTime = (sec: number | null) => {
  if (sec == null) return '-';
  const k = new Date(sec * 1000 + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
};

export default function AdminShowDetailPage({ show, refundAccounts = {}, sameNameDeposits = {} }: AdminShowDetailPageProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [onlyAwaiting, setOnlyAwaiting] = useState(false);
  const awaitingTotal = allOrders(show).filter((o) => o.bankDeposit === 'awaiting').length;

  const run = async (body: Record<string, unknown>, opts: { confirm?: string; success?: string } = {}) => {
    if (opts.confirm && !window.confirm(opts.confirm)) return null;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await postShowAction(show.id, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? '처리에 실패했습니다.');
      return null;
    }
    setNotice(opts.success ?? '처리했습니다.');
    await router.replace(router.asPath, undefined, { scroll: false });
    return result;
  };

  const toggleStatus = () =>
    run(
      { action: 'set_status', status: show.status === 'published' ? 'draft' : 'published' },
      {
        confirm: show.status === 'published' ? '공연을 비공개(초안)로 내립니다. 이미 판매된 티켓은 그대로입니다.' : '공연을 공개합니다. 바로 예매가 열립니다.',
        success: '상태를 바꿨습니다.',
      },
    );

  return (
    <>
      <Head>
        <title>{show.title} | 공연 관리</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell
        title={show.title}
        description={`/${show.slug} · ${show.venueName}`}
        backHref="/admin/shows"
        backLabel="공연 목록"
        width="wide"
        actions={
          show.status !== 'cancelled' && (
            <Button light variant={show.status === 'published' ? 'outline' : 'solid'} disabled={busy} onClick={toggleStatus}>
              {show.status === 'published' ? '비공개로 내리기' : '공개하기'}
            </Button>
          )
        }
      >
        {notice && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>}
        {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">{error}</div>}

        <section className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mb-6 text-sm text-gray-900">
          <p className="mb-2"><strong>상태</strong> {STATUS_LABEL[show.status] ?? show.status}</p>
          <p className="mb-2"><strong>구역</strong> {show.zones.map((z) => `${z.label}(${z.code}) 정원 ${z.capacity}`).join(' · ')}</p>
          <p>
            <strong>티켓타입</strong>{' '}
            {show.ticketTypes.map((t) => `${t.name} ${t.price.toLocaleString('ko-KR')}원 (한도 ${t.quota ?? '구역 정원'}, 초대 ${t.compQuota})`).join(' · ')}
          </p>
        </section>

        <div className="mb-4 flex items-center gap-3 text-sm text-gray-900">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={onlyAwaiting} onChange={(e) => setOnlyAwaiting(e.target.checked)} className="h-4 w-4 rounded border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" />
            입금 대기만 보기
          </label>
          {awaitingTotal > 0 && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900">입금 대기 {awaitingTotal}</span>}
        </div>

        <div className="space-y-8">
          {show.showtimes.map((t) => (
            <ShowtimeSection key={t.id} show={show} showtime={t} busy={busy} run={run} onScanUrl={setScanUrl}
              onlyAwaiting={onlyAwaiting} refundAccounts={refundAccounts} sameNameDeposits={sameNameDeposits} setNotice={setNotice} />
          ))}
        </div>

        {scanUrl && (
          <div role="dialog" aria-label="스캔 링크" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 p-5 text-sm text-gray-900">
            <p className="font-semibold mb-2">입장 스캔 링크가 만들어졌습니다</p>
            <p className="mb-2 text-gray-600">이 주소는 지금만 볼 수 있습니다(서버에는 해시만 저장). 확인자에게 전달해 주세요.</p>
            <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}${scanUrl}`} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 text-gray-900" aria-label="스캔 링크 주소" />
            <div className="mt-3 flex justify-end">
              <Button light variant="outline" size="sm" onClick={() => setScanUrl(null)}>닫기</Button>
            </div>
          </div>
        )}
      </AdminShell>
    </>
  );
}

type Run = (body: Record<string, unknown>, opts?: { confirm?: string; success?: string }) => Promise<{ data?: Record<string, unknown> } | null>;

function ShowtimeSection({ show, showtime: t, busy, run, onScanUrl, onlyAwaiting, refundAccounts, sameNameDeposits, setNotice }: {
  show: AdminShowDetail;
  showtime: AdminShowtimeDetail;
  busy: boolean;
  run: Run;
  onScanUrl: (path: string) => void;
  onlyAwaiting: boolean;
  refundAccounts: Record<string, ShowRefundAccountInfo>;
  sameNameDeposits: Record<string, SameNameDepositOrder[]>;
  setNotice: (message: string | null) => void;
}) {
  const [compType, setCompType] = useState(show.ticketTypes[0]?.id ?? '');
  const [compQty, setCompQty] = useState(1);
  const [compNote, setCompNote] = useState('');
  const [newStart, setNewStart] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkHours, setLinkHours] = useState(12);
  const scheduled = t.status === 'scheduled';
  const visibleOrders = onlyAwaiting ? t.orders.filter((o) => o.bankDeposit === 'awaiting') : t.orders;

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 md:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">{t.label} {t.status !== 'scheduled' && <span className="text-sm font-normal text-gray-500">({t.status === 'cancelled' ? '취소됨' : '종료'})</span>}</h2>
          <p className="text-sm text-gray-600 mt-1">
            발권 {t.issued} · 결제대기 {t.held}{t.awaitingDeposit > 0 ? ` (계좌 입금 대기 ${t.awaitingDeposit}주문)` : ''} · 초대 {t.comp} · 정원 {t.capacity} · 입장 {t.checkedIn} · 판매마감 {kstTime(t.salesCloseAt)}
            {t.refundDueAmount > 0 && <span className="ml-1 font-semibold text-red-700">· 돌려줄 계좌 입금 {t.refundDueAmount.toLocaleString('ko-KR')}원(환불 계좌 접수 대기)</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/admin/shows/${show.id}/roster?showtimeId=${t.id}`} className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
            명단 CSV
          </a>
          {scheduled && (
            <Button light variant="outline" size="sm" disabled={busy} onClick={() =>
              run({ action: 'cancel_showtime', showtimeId: t.id }, {
                confirm: '이 회차를 취소하고, 결제된 주문을 전부 전액 환불합니다(입장한 티켓 제외). 되돌릴 수 없습니다.',
                success: '회차를 취소했습니다. 환불 결과는 주문 상태에서 확인하세요.',
              }).then((r) => {
                const failed = r?.data?.failedOrders;
                if (Array.isArray(failed) && failed.length > 0) window.alert(`환불에 실패한 주문이 있습니다. 토스 콘솔에서 확인하세요: ${failed.join(', ')}`);
                const bank = r?.data?.bankRefundOrders;
                if (Array.isArray(bank) && bank.length > 0) window.alert(`계좌 입금 주문 ${bank.length}건은 토스로 돌려줄 수 없습니다. 고객 환불 계좌로 직접 송금한 뒤 "송금 완료"를 눌러 기록하세요: ${bank.join(', ')}`);
                const closed = r?.data?.closedDepositOrders;
                if (Array.isArray(closed) && closed.length > 0) window.alert(`입금 전이던 계좌 입금 신청 ${closed.length}건을 닫았습니다(받은 돈이 없어 환불은 없습니다): ${closed.join(', ')}`);
              })}>
              회차 취소
            </Button>
          )}
        </div>
      </div>

      {scheduled && (
        <div className="p-5 md:p-6 grid gap-6 md:grid-cols-3 border-b border-gray-100">
          <div className={`space-y-2 ${lightOnlyField}`}>
            <h3 className="font-semibold text-sm text-gray-900">초대권 발급</h3>
            <Field id={`ct-${t.id}`} label="티켓타입">
              <Select light value={compType} onChange={(e) => setCompType(e.target.value)}>
                {show.ticketTypes.map((tt) => <option key={tt.id} value={tt.id}>{tt.name} (초대 한도 {tt.compQuota})</option>)}
              </Select>
            </Field>
            <Field id={`cq-${t.id}`} label="수량">
              <TextInput light type="number" min={1} max={10} value={compQty} onChange={(e) => setCompQty(Number(e.target.value))} />
            </Field>
            <Field id={`cn-${t.id}`} label="받는 분 / 사유">
              <TextInput light value={compNote} maxLength={100} onChange={(e) => setCompNote(e.target.value)} />
            </Field>
            <Button light size="sm" disabled={busy || !compNote.trim()} onClick={() =>
              run({ action: 'issue_comp', showtimeId: t.id, ticketTypeId: compType, quantity: compQty, note: compNote }, { success: '초대권을 발급했습니다.' }).then((r) => r && setCompNote(''))}>
              발급
            </Button>
          </div>

          <div className={`space-y-2 ${lightOnlyField}`}>
            <h3 className="font-semibold text-sm text-gray-900">회차 시각 변경</h3>
            <Field id={`ns-${t.id}`} label="새 시작 시각(KST)" hint="판매마감은 새 시각 기준으로 다시 계산됩니다.">
              <TextInput light type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </Field>
            <Button light variant="outline" size="sm" disabled={busy || !newStart} onClick={() =>
              run({ action: 'change_showtime', showtimeId: t.id, startsAt: `${newStart}:00+09:00` }, {
                confirm: '시각을 변경합니다. 구매자 안내는 별도로 해 주세요.', success: '시각을 변경했습니다.',
              })}>
              변경
            </Button>
          </div>

          <div className={`space-y-2 ${lightOnlyField}`}>
            <h3 className="font-semibold text-sm text-gray-900">입장 스캔 링크</h3>
            <Field id={`sl-${t.id}`} label="이름(담당자)">
              <TextInput light value={linkLabel} maxLength={40} onChange={(e) => setLinkLabel(e.target.value)} />
            </Field>
            <Field id={`sh-${t.id}`} label="유효 시간(1~72)">
              <TextInput light type="number" min={1} max={72} value={linkHours} onChange={(e) => setLinkHours(Number(e.target.value))} />
            </Field>
            <Button light variant="outline" size="sm" disabled={busy || !linkLabel.trim()} onClick={async () => {
              const r = await run({ action: 'issue_scan_link', showtimeId: t.id, label: linkLabel, ttlHours: linkHours }, { success: '스캔 링크를 만들었습니다.' });
              const path = r?.data?.path;
              if (typeof path === 'string') onScanUrl(path);
            }}>
              링크 발급
            </Button>
            {t.scanLinks.length > 0 && (
              <ul className="text-xs text-gray-600 space-y-0.5">
                {t.scanLinks.map((l) => <li key={l.id}>{l.label} · 만료 {kstTime(l.expiresAt)}{l.revokedAt ? ' · 폐기' : ''}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="admin-table w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">주문</th>
              <th className="text-left px-4 py-2 font-medium">구매자</th>
              <th className="text-left px-4 py-2 font-medium">티켓</th>
              <th className="text-right px-4 py-2 font-medium">금액</th>
              <th className="text-left px-4 py-2 font-medium">조작</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-900">
            {visibleOrders.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">{onlyAwaiting ? '입금 대기 주문이 없습니다.' : '주문이 없습니다.'}</td></tr>}
            {visibleOrders.map((o) => {
              const refundable = o.tickets.filter((k) => k.status === 'issued' && k.checkedInAt == null);
              return (
                <tr key={o.orderNo} className="align-top">
                  <td data-label="주문" className="px-4 py-2 whitespace-nowrap">
                    <div className="font-mono text-xs">{o.orderNo}</div>
                    <div className="text-xs text-gray-500">
                      {o.isComp ? '초대' : ORDER_STATUS_LABEL[o.orderStatus] ?? o.orderStatus}
                      {o.bankDeposit === 'paid' && <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-sky-900">계좌 입금</span>}
                    </div>
                    {o.bankDeposit === 'awaiting' && (
                      <div className="mt-1 text-xs text-sky-900">
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium">계좌 입금 대기</span>
                        {o.depositDeadline && <div className="mt-0.5">안내 기한 {formatKstDeadline(new Date(o.depositDeadline))}(한국시간, 자동 취소 없음)</div>}
                      </div>
                    )}
                  </td>
                  <td data-label="구매자" className="px-4 py-2">
                    <div>{o.buyerName}</div>
                    {!o.isComp && <div className="text-xs text-gray-500">{o.buyerContact}</div>}
                  </td>
                  <td data-label="티켓" className="px-4 py-2">
                    <ul className="space-y-1">
                      {o.tickets.map((k) => (
                        <li key={k.id} className="text-xs">
                          <span className="font-mono">{k.entryNumber ?? '---'}</span> {k.ticketTypeName} · {TICKET_STATUS_LABEL[k.status] ?? k.status}
                          {k.checkedInAt != null && <span className="text-green-700"> · 입장 {kstTime(k.checkedInAt)}</span>}
                          {k.checkedInAt != null && (
                            <button type="button" className="ml-1 underline text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" disabled={busy}
                              onClick={() => run({ action: 'undo_checkin', ticketId: k.id }, { confirm: '입장 기록을 취소합니다.', success: '입장 기록을 취소했습니다.' })}>
                              입장 취소
                            </button>
                          )}
                          {o.isComp && k.status === 'issued' && k.checkedInAt == null && (
                            <button type="button" className="ml-1 underline text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" disabled={busy}
                              onClick={() => run({ action: 'revoke_comp', ticketId: k.id }, { confirm: '이 초대권을 취소합니다.', success: '초대권을 취소했습니다.' })}>
                              초대 취소
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td data-label="금액" className="px-4 py-2 text-right whitespace-nowrap">{o.totalAmount.toLocaleString('ko-KR')}원</td>
                  <td className="px-4 py-2">
                    {o.bankDeposit === 'awaiting' && (
                      <div className="mb-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Button light size="sm" disabled={busy} onClick={() =>
                            run({ action: 'confirm_deposit', orderNo: o.orderNo }, {
                              confirm: `통장에 실제로 입금됐는지 먼저 확인하세요.\n\n보내는 분 ${o.buyerName} · ${o.totalAmount.toLocaleString('ko-KR')}원이 들어온 것을 확인했나요? 확인하면 티켓이 발급되고 구매자에게 QR 티켓 메일이 나갑니다.`,
                              success: '입금을 확인하고 티켓을 발급했습니다.',
                            })}>
                            입금 확인
                          </Button>
                          <Button light variant="outline" size="sm" disabled={busy} onClick={() =>
                            run({ action: 'cancel_unpaid_deposit', orderNo: o.orderNo }, {
                              confirm: '받은 돈이 없는 신청을 닫습니다 — 좌석이 풀리고 메일은 가지 않습니다.',
                              success: '미입금 신청을 닫았습니다.',
                            })}>
                            미입금 취소
                          </Button>
                          <Button light variant="outline" size="sm" disabled={busy} onClick={() =>
                            run({ action: 'resend_deposit_guide', orderNo: o.orderNo }, { confirm: '입금 안내 메일을 다시 보낼까요?' }).then((r) => {
                              const failure = r?.data?.notificationError;
                              if (typeof failure === 'string' && failure) setNotice(`입금 안내 메일 발송에 실패했습니다(${failure}).`);
                            })}>
                            입금 안내 재발송
                          </Button>
                        </div>
                      </div>
                    )}
                    {(o.bankDeposit === 'awaiting' || o.bankDeposit === 'cancelled') && (sameNameDeposits[o.orderNo] ?? []).length > 0 && (
                      <div className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
                        <p className="font-semibold">같은 이름의 다른 계좌 입금 신청이 {sameNameDeposits[o.orderNo].length}건 있습니다 — 이중 확인 주의</p>
                        <ul className="mt-1 space-y-0.5">
                          {sameNameDeposits[o.orderNo].map((c) => (
                            <li key={c.id}>{c.orderNo} · {ORDER_STATUS_LABEL[c.status] ?? c.status} · {c.totalAmount.toLocaleString('ko-KR')}원</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {o.bankDeposit === 'paid' && refundAccounts[o.orderNo] && (
                      <RefundAccountPanel order={o} info={refundAccounts[o.orderNo]} busy={busy} run={run} setNotice={setNotice} />
                    )}
                    {!o.isComp && refundable.length > 0 && (
                      <Button light variant="outline" size="sm" disabled={busy} onClick={() =>
                        run({ action: 'refund_tickets', orderNo: o.orderNo, ticketIds: refundable.map((k) => k.id) }, {
                          confirm: o.bankDeposit === 'paid'
                            ? `계좌 입금 건입니다 — 토스로 돌려주지 않습니다. 고객 계좌로 송금을 마친 뒤 기록하세요.\n\n${o.orderNo}의 입장 전 티켓 ${refundable.length}장을 환불 완료로 기록합니다. 금액은 취소환불표(공연 임박도)에 따라 계산됩니다.`
                            : `${o.orderNo}의 입장 전 티켓 ${refundable.length}장을 환불합니다. 금액은 취소환불표(공연 임박도)에 따라 계산됩니다.`,
                          success: '환불을 처리했습니다.',
                        })}>
                        입장 전 티켓 환불
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RefundAccountPanel({ order: o, info, busy, run, setNotice }: {
  order: AdminOrderRow;
  info: ShowRefundAccountInfo;
  busy: boolean;
  run: Run;
  setNotice: (message: string | null) => void;
}) {
  // 누를 때만 가져와 이 컴포넌트 state에만 둔다 — SSR props에 계좌번호를 싣지 않는다.
  const [view, setView] = useState<{ bankName: string; accountNumber: string; accountHolder: string; holderMismatch: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const showAccount = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/orders/${encodeURIComponent(o.orderId)}/refund-account`, { credentials: 'same-origin', cache: 'no-store' });
      const json = await r.json().catch(() => ({}));
      if (r.ok && json.account) setView({ ...json.account, holderMismatch: Boolean(json.holderMismatch) });
      else setNotice(typeof json.message === 'string' ? json.message : '환불 계좌를 불러오지 못했습니다.');
    } catch {
      setNotice('네트워크 오류');
    }
    setLoading(false);
  };
  return (
    <div className="mb-2 rounded border border-orange-300 bg-orange-50 p-2 text-xs text-orange-950">
      <p className="font-semibold">환불 계좌</p>
      {info.status === 'present' && (
        <>
          <p className="mt-0.5">{info.bankName} · 예금주 {info.accountHolder}</p>
          {info.holderMismatch && (
            <p className="mt-1 font-semibold text-red-700">예금주가 구매자 이름({o.customerName})과 다릅니다. 가족 계좌일 수 있으니 필요하면 확인해 주세요.</p>
          )}
          {view ? (
            <div className="mt-1 rounded border border-orange-200 bg-white p-2 text-gray-900">
              <p>{view.bankName}</p>
              <p className="text-sm font-bold tracking-wide">{view.accountNumber}</p>
              <p>예금주 {view.accountHolder}</p>
              {view.holderMismatch && <p className="mt-1 font-semibold text-red-700">예금주가 구매자 이름과 다릅니다.</p>}
            </div>
          ) : (
            <Button light variant="outline" size="sm" className="mt-1" disabled={busy || loading} onClick={showAccount}>계좌 보기</Button>
          )}
          <p className="mt-1">“계좌 보기”를 누른 사실은 접속기록에 남습니다.</p>
          <div className="mt-1">
            {info.refundedAt == null ? (
              <Button light size="sm" disabled={busy} onClick={() =>
                run({ action: 'mark_refund_sent', orderNo: o.orderNo }, {
                  confirm: `${o.orderNo}의 환불금을 고객 계좌로 이미 송금했나요? 이 버튼은 송금을 대신하지 않고 "송금 완료"로 기록만 합니다.`,
                  success: '송금 완료로 기록했습니다.',
                })}>
                송금 완료
              </Button>
            ) : (
              <p className="font-semibold">송금 완료 {kstTime(info.refundedAt)}</p>
            )}
          </div>
        </>
      )}
      {info.status === 'none' && <p className="mt-0.5">접수된 환불 계좌가 없습니다. 환불이 필요하면 고객에게 계좌를 받아 주세요.</p>}
      {info.status === 'unavailable' && <p className="mt-0.5">환불 계좌를 불러오지 못했습니다. 운영 DB에 마이그레이션 0048이 적용됐는지 확인해 주세요.</p>}
    </div>
  );
}
