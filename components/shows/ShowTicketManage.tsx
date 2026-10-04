import { useState } from 'react';
import Image from 'next/image';

import BaseCard from '../ui/BaseCard';
import StatusBadge from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { formatWon, SHOW_CONTACT_PHONE } from '../../lib/shows/copy';
import { formatEntryNumber } from '../../lib/shows/format';
import type { ManageOrderView, ManageTicketView } from '../../lib/shows/queries';
import RefundPolicyList from './RefundPolicyList';
import BankDepositGuide from '../payments/BankDepositGuide';
import RefundAccountFields, { EMPTY_REFUND_ACCOUNT, isRefundAccountFilled, type RefundAccountValue } from '../payments/RefundAccountFields';

interface Props {
  order: ManageOrderView;
  token: string;
  /** ticketId → QR data URL (SSR에서 만든다). 입장 가능한 티켓에만 있다. */
  qr: Record<string, string>;
}

const TICKET_STATUS_LABELS: Record<ManageTicketView['status'], string> = {
  held: '결제 대기',
  issued: '사용 가능',
  refunding: '환불 처리 중',
  refunded: '환불됨',
  void: '무효',
};

const ORDER_NOTICES: Record<string, string> = {
  pending: '결제가 아직 확인되지 않았습니다. 결제가 완료되면 티켓이 발권됩니다.',
  deposit_cancelled: '이 계좌 입금 신청은 입금 전에 취소되었습니다. 이미 입금하셨다면 연락 주세요 — 확인해 돌려드립니다. 문의 010-4255-7893',
  expired: '결제 시간이 지나 만료된 주문입니다.',
  failed: '결제가 승인되지 않은 주문입니다.',
  refunded: '전액 환불된 주문입니다.',
};

/**
 * 계좌 입금 대기 — 계좌 안내(펀딩·예약과 같은 BankDepositGuide)와 "입금 전 신청 취소". 좌석은 입금을 확인할
 * 때까지 잡혀 있고, 확인되면 티켓(QR)이 메일로 간다. 취소하면 좌석이 바로 풀리고 메일은 없다.
 */
function DepositWaiting({ order, token }: { order: ManageOrderView; token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const guide = order.depositGuide!;
  const withdraw = async () => {
    if (!window.confirm('입금 전 신청을 취소할까요? 이미 입금하셨다면 취소하지 말고 ' + SHOW_CONTACT_PHONE + '으로 연락 주세요.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/shows/refund', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: order.orderNo, token, action: 'withdraw' }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) setClosed(true);
      else setError(data?.message ?? '취소하지 못했습니다. 문의 ' + SHOW_CONTACT_PHONE);
    } catch {
      setError('네트워크 오류로 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  if (closed) {
    return <p role="status" className="rounded-xl bg-gray-100 p-4 text-sm dark:bg-gray-800">신청을 취소했습니다. 받은 돈이 없어 환불할 금액은 없습니다.</p>;
  }
  return (
    <section aria-label="입금 안내">
      <p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        좌석을 잡아 두었습니다. 입금이 확인되면 티켓(QR)이 발권되어 메일로 갑니다.
      </p>
      <BankDepositGuide amount={guide.amount} deadline={guide.deadline} customerName={guide.customerName} applicantLabel="예매하신 분" />
      {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="button" variant="outline" fullWidth className="mt-8" disabled={busy} onClick={withdraw}>
        {busy ? '처리 중…' : '입금 전 예매 신청 취소'}
      </Button>
    </section>
  );
}

/** 내 티켓 — QR·입장번호를 보여 주고, 환불 가능한 티켓을 골라 셀프 환불한다. */
export default function ShowTicketManage({ order, token, qr }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // 계좌 입금으로 결제한 주문 — 토스로 돌려줄 수 없어 환불 계좌를 함께 받는다(서버가 같은 판정으로 요구한다).
  const viaAccount = order.bankDeposit === 'paid';
  const [refundAccount, setRefundAccount] = useState<RefundAccountValue>(EMPTY_REFUND_ACCOUNT);

  const refundable = order.tickets.filter((t) => t.refundAmountNow != null);
  const refundTotal = order.tickets
    .filter((t) => selected.includes(t.id))
    .reduce((sum, t) => sum + (t.refundAmountNow ?? 0), 0);
  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitRefund = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/shows/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: order.orderNo, token, ticketIds: selected, ...(viaAccount ? { refundAccount } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { ok: boolean; refundAmount?: number; message?: string; refundVia?: string } | null;
      if (res.ok && data?.ok) {
        setDone(
          data.refundVia === 'bank_account'
            ? `환불을 접수했습니다. ${formatWon(data.refundAmount ?? refundTotal)}을 적어 주신 계좌로 접수일부터 3영업일 이내에 보내 드립니다.`
            : `${formatWon(data.refundAmount ?? refundTotal)}이 환불 처리되었습니다. 카드사에 따라 반영까지 영업일 기준 수일 걸릴 수 있습니다.`,
        );
        setSelected([]);
        // 서버가 그린 상태(티켓 상태·QR)를 다시 받는다 — 문서 이동이라 토큰 URL이 그대로 유지된다.
        window.setTimeout(() => window.location.reload(), 1800);
      } else {
        setError(data?.message ?? '환불을 처리하지 못했습니다. 문의 ' + SHOW_CONTACT_PHONE);
      }
    } catch {
      setError('네트워크 오류로 환불 결과를 확인하지 못했습니다. 새로고침으로 상태를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const notice = ORDER_NOTICES[order.orderStatus];
  const cancelledShowtime = order.showtimeStatus === 'cancelled';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="typo-page-title">{order.showTitle}</h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">{order.showtimeLabel}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {order.venueName} · {order.venueAddress}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          주문번호 {order.orderNo} · {order.buyerName}님 · 결제 {formatWon(order.totalAmount)}
        </p>
      </header>

      {cancelledShowtime && (
        <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          {viaAccount && refundable.length > 0
            ? '이 회차는 취소되었습니다. 계좌로 입금하신 금액은 전액 돌려드립니다 — 아래에서 티켓을 고르고 환불받을 계좌를 적어 주세요.'
            : `이 회차는 취소되었습니다. 환불 안내는 메일·문자로 별도 드립니다. 문의 ${SHOW_CONTACT_PHONE}`}
        </p>
      )}
      {order.bankDeposit === 'awaiting' && order.depositGuide ? <DepositWaiting order={order} token={token} /> : null}
      {notice && <p role="status" className="rounded-xl bg-gray-100 p-4 text-sm dark:bg-gray-800">{notice}</p>}

      {/* 입금 대기 중에는 티켓이 아직 발권 전(보류)이라 티켓 카드·환불 칸을 그리지 않는다 — 위 입금 안내가 이 화면의 전부다. */}
      {order.bankDeposit !== 'awaiting' && (<>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        입장은 <strong>비지정석 선착순</strong>입니다. 현장에서 QR을 보여 주시면 입장 번호를 안내해 드립니다.
      </p>

      {/*
        티켓 한 장 = 카드 한 장(지갑 메타포). QR이 가장 크고, 입장 번호·상태가 그 아래. 환불 선택은 카드 안의
        체크 하나다 — 선택하면 아래 고정 줄의 버튼에 매수·금액이 바로 찍히고, 그 버튼 한 번으로 환불된다(2단계).
        예전엔 선택 → 신청 → 확정 3단계였다(운영자 지시 2026-10-03: 동의·단계 최소화).
      */}
      <ul className="space-y-4">
        {order.tickets.map((t, i) => {
          const qrUrl = qr[t.id];
          const isSelected = selected.includes(t.id);
          const statusLabel = t.checkedIn ? '입장 완료' : TICKET_STATUS_LABELS[t.status];
          const live = !t.checkedIn && t.status === 'issued';
          return (
            <li key={t.id}>
              <BaseCard variant={isSelected ? 'glass-highlight' : 'glass'} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="typo-card-meta">티켓 {i + 1}</p>
                    <p className="typo-card-subtitle text-gray-900 dark:text-white">{t.ticketTypeName}</p>
                  </div>
                  <StatusBadge tone={live ? 'active' : 'neutral'}>{statusLabel}</StatusBadge>
                </div>
                {qrUrl && (
                  <div className="mt-4 flex justify-center">
                    {/* QR은 라이트 배경이 필요하다 — 다크 모드에서도 흰 바탕을 유지해 스캐너가 읽게 한다. */}
                    <Image src={qrUrl} alt={`티켓 ${i + 1} 입장 QR`} width={220} height={220} unoptimized className="rounded-lg bg-white p-2" />
                  </div>
                )}
                {t.entryNumber != null && (
                  <p className="mt-3 text-center text-sm text-gray-700 dark:text-gray-300">
                    입장 번호 <strong className="text-2xl tabular-nums text-gray-900 dark:text-white">{formatEntryNumber(t.entryNumber)}</strong>
                  </p>
                )}
                {t.refundAmountNow != null && (
                  <label className="mt-4 flex min-h-[44px] items-center gap-3 border-t border-gray-200/70 pt-3 text-sm text-gray-800 dark:border-gray-700/70 dark:text-gray-200">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(t.id)} className="h-5 w-5 accent-primary" />
                    <span>
                      환불 선택 <span className="text-gray-500 dark:text-gray-400">(지금 환불하면 {formatWon(t.refundAmountNow)})</span>
                    </span>
                  </label>
                )}
              </BaseCard>
            </li>
          );
        })}
      </ul>

      <section aria-label="환불" className="space-y-3">
        {refundable.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            지금 환불 신청할 수 있는 티켓이 없습니다(입장 완료·환불 완료·공연 시작 후는 불가). 문의 {SHOW_CONTACT_PHONE}
          </p>
        ) : (
          <>
            {viaAccount && selected.length > 0 && refundTotal > 0 && (
              <RefundAccountFields idPrefix="show-refund" value={refundAccount} onChange={setRefundAccount} />
            )}
            {/* 버튼 라벨이 곧 확인 문구다 — 매수·금액을 보고 누른다. 별도 확정 단계를 두지 않는다. */}
            <Button type="button" fullWidth
              disabled={selected.length === 0 || busy || (viaAccount && refundTotal > 0 && !isRefundAccountFilled(refundAccount))}
              onClick={submitRefund}>
              {busy ? '처리 중…' : selected.length === 0 ? '환불할 티켓을 위에서 선택해 주세요' : `${selected.length}매 환불하기 · ${formatWon(refundTotal)}`}
            </Button>
            <details className="text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer rounded underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70">
                취소·환불 규정 보기
              </summary>
              <RefundPolicyList className="mt-2" />
            </details>
          </>
        )}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {done && <p role="status" className="text-sm text-green-700 dark:text-green-400">{done}</p>}
      </section>
      </>)}
    </div>
  );
}
