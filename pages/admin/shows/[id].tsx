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
import { loadAdminShowDetail, type AdminShowDetail, type AdminShowtimeDetail } from '../../../lib/shows/adminQueries';

interface AdminShowDetailPageProps {
  show: AdminShowDetail;
}

export const getServerSideProps: GetServerSideProps<AdminShowDetailPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const id = context.params?.id;
  if (typeof id !== 'string') return { notFound: true };
  try {
    const show = await loadAdminShowDetail(id);
    if (!show) return { notFound: true };
    return { props: { show } };
  } catch (error: unknown) {
    console.error('[admin/shows/[id]] 조회 실패:', error);
    throw error;
  }
};

const STATUS_LABEL: Record<string, string> = { draft: '초안(비공개)', published: '공개', cancelled: '취소' };
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제대기', paid: '확정', partially_refunded: '부분환불', refunded: '환불완료', expired: '만료', failed: '결제실패',
};
const TICKET_STATUS_LABEL: Record<string, string> = { held: '보류', issued: '발권', refunding: '환불중', refunded: '환불', void: '무효' };

const kstTime = (sec: number | null) => {
  if (sec == null) return '-';
  const k = new Date(sec * 1000 + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
};

export default function AdminShowDetailPage({ show }: AdminShowDetailPageProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanUrl, setScanUrl] = useState<string | null>(null);

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

        <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6 mb-6 text-sm text-gray-900">
          <p className="mb-2"><strong>상태</strong> {STATUS_LABEL[show.status] ?? show.status}</p>
          <p className="mb-2"><strong>구역</strong> {show.zones.map((z) => `${z.label}(${z.code}) 정원 ${z.capacity}`).join(' · ')}</p>
          <p>
            <strong>티켓타입</strong>{' '}
            {show.ticketTypes.map((t) => `${t.name} ${t.price.toLocaleString('ko-KR')}원 (한도 ${t.quota ?? '구역 정원'}, 초대 ${t.compQuota})`).join(' · ')}
          </p>
        </section>

        <div className="space-y-8">
          {show.showtimes.map((t) => (
            <ShowtimeSection key={t.id} show={show} showtime={t} busy={busy} run={run} onScanUrl={setScanUrl} />
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

function ShowtimeSection({ show, showtime: t, busy, run, onScanUrl }: {
  show: AdminShowDetail;
  showtime: AdminShowtimeDetail;
  busy: boolean;
  run: Run;
  onScanUrl: (path: string) => void;
}) {
  const [compType, setCompType] = useState(show.ticketTypes[0]?.id ?? '');
  const [compQty, setCompQty] = useState(1);
  const [compNote, setCompNote] = useState('');
  const [newStart, setNewStart] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkHours, setLinkHours] = useState(12);
  const scheduled = t.status === 'scheduled';

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 md:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">{t.label} {t.status !== 'scheduled' && <span className="text-sm font-normal text-gray-500">({t.status === 'cancelled' ? '취소됨' : '종료'})</span>}</h2>
          <p className="text-sm text-gray-600 mt-1">
            발권 {t.issued} · 결제대기 {t.held} · 초대 {t.comp} · 정원 {t.capacity} · 입장 {t.checkedIn} · 판매마감 {kstTime(t.salesCloseAt)}
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
        <table className="w-full text-sm">
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
            {t.orders.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">주문이 없습니다.</td></tr>}
            {t.orders.map((o) => {
              const refundable = o.tickets.filter((k) => k.status === 'issued' && k.checkedInAt == null);
              return (
                <tr key={o.orderNo} className="align-top">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="font-mono text-xs">{o.orderNo}</div>
                    <div className="text-xs text-gray-500">{o.isComp ? '초대' : ORDER_STATUS_LABEL[o.orderStatus] ?? o.orderStatus}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div>{o.buyerName}</div>
                    {!o.isComp && <div className="text-xs text-gray-500">{o.buyerContact}</div>}
                  </td>
                  <td className="px-4 py-2">
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
                  <td className="px-4 py-2 text-right whitespace-nowrap">{o.totalAmount.toLocaleString('ko-KR')}원</td>
                  <td className="px-4 py-2">
                    {!o.isComp && refundable.length > 0 && (
                      <Button light variant="outline" size="sm" disabled={busy} onClick={() =>
                        run({ action: 'refund_tickets', orderNo: o.orderNo, ticketIds: refundable.map((k) => k.id) }, {
                          confirm: `${o.orderNo}의 입장 전 티켓 ${refundable.length}장을 환불합니다. 금액은 취소환불표(공연 임박도)에 따라 계산됩니다.`,
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
