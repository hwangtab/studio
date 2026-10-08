import { useState } from 'react';
import Image from 'next/image';

import BaseCard from '../ui/BaseCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Disclosure } from '../ui/Disclosure';
import { Notice } from '../ui/Notice';
import { SHOW_CONTACT_PHONE } from '../../lib/shows/copy';
import { formatShowWon, SHOW_CONTACT_PHONE_INTL, type ShowLocale } from '../../lib/shows/i18n';
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
  locale?: ShowLocale;
}

/** 이 화면의 말 — 한국어·영어. 같은 키·같은 내용이다(한쪽을 고치면 다른 쪽도). */
const T = {
  ko: {
    status: { held: '결제 대기', issued: '사용 가능', refunding: '환불 처리 중', refunded: '환불됨', void: '무효' } as Record<ManageTicketView['status'], string>,
    notices: {
      pending: '결제가 아직 확인되지 않았습니다. 결제가 완료되면 티켓이 발권됩니다.',
      deposit_cancelled: '이 계좌 입금 신청은 입금 전에 취소되었습니다. 이미 입금하셨다면 연락 주세요 — 확인해 돌려드립니다. 문의 010-4255-7893',
      expired: '결제 시간이 지나 만료된 주문입니다.',
      failed: '결제가 승인되지 않은 주문입니다.',
      refunded: '전액 환불된 주문입니다.',
    } as Record<string, string>,
    withdrawConfirm: `입금 전 신청을 취소할까요? 이미 입금하셨다면 취소하지 말고 ${SHOW_CONTACT_PHONE}으로 연락 주세요.`,
    withdrawFailed: `취소하지 못했습니다. 문의 ${SHOW_CONTACT_PHONE}`,
    withdrawNetwork: '네트워크 오류로 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    withdrawn: '신청을 취소했습니다. 받은 돈이 없어 환불할 금액은 없습니다.',
    depositAria: '입금 안내',
    depositHeld: '좌석을 잡아 두었습니다. 입금이 확인되면 티켓(QR)이 발권되어 메일로 갑니다.',
    applicant: '예매하신 분',
    processing: '처리 중…',
    withdraw: '입금 전 예매 신청 취소',
    refundDoneBank: (amount: string) => `환불을 접수했습니다. ${amount}을 적어 주신 계좌로 접수일부터 3영업일 이내에 보내 드립니다.`,
    refundDoneCard: (amount: string) => `${amount}이 환불 처리되었습니다. 카드사에 따라 반영까지 영업일 기준 수일 걸릴 수 있습니다.`,
    refundFailed: `환불을 처리하지 못했습니다. 문의 ${SHOW_CONTACT_PHONE}`,
    refundNetwork: '네트워크 오류로 환불 결과를 확인하지 못했습니다. 새로고침으로 상태를 확인해 주세요.',
    orderLine: (orderNo: string, name: string, total: string) => `주문번호 ${orderNo} · ${name}님 · 결제 ${total}`,
    cancelledViaAccount: '이 회차는 취소되었습니다. 계좌로 입금하신 금액은 전액 돌려드립니다 — 아래에서 티켓을 고르고 환불받을 계좌를 적어 주세요.',
    cancelledOther: `이 회차는 취소되었습니다. 환불 안내는 메일·문자로 별도 드립니다. 문의 ${SHOW_CONTACT_PHONE}`,
    entryLead: '입장은 ',
    entryStrong: '비지정석 선착순',
    entryTail: '입니다. 현장에서 QR을 보여 주시면 입장 번호를 안내해 드립니다.',
    checkedIn: '입장 완료',
    ticketN: (n: number) => `티켓 ${n}`,
    qrAlt: (n: number) => `티켓 ${n} 입장 QR`,
    entryNumber: '입장 번호',
    refundPick: '환불 선택',
    refundNow: (amount: string) => `(지금 환불하면 ${amount})`,
    refundAria: '환불',
    noRefundable: `지금 환불 신청할 수 있는 티켓이 없습니다(입장 완료·환불 완료·공연 시작 후는 불가). 문의 ${SHOW_CONTACT_PHONE}`,
    pickFirst: '환불할 티켓을 위에서 선택해 주세요',
    refundButton: (n: number, amount: string) => `${n}매 환불하기 · ${amount}`,
    refundPolicy: '취소·환불 규정 보기',
  },
  en: {
    status: { held: 'Awaiting payment', issued: 'Valid', refunding: 'Refund in progress', refunded: 'Refunded', void: 'Void' } as Record<ManageTicketView['status'], string>,
    notices: {
      pending: 'Your payment has not been confirmed yet. Tickets are issued once payment is complete.',
      deposit_cancelled: `This bank transfer request was cancelled before payment. If you already sent the money, contact us and we will return it. Contact: ${SHOW_CONTACT_PHONE_INTL}`,
      expired: 'This order expired because the payment time ran out.',
      failed: 'The payment for this order was not approved.',
      refunded: 'This order has been fully refunded.',
    } as Record<string, string>,
    withdrawConfirm: `Cancel this request before transferring? If you have already sent the money, do not cancel — contact us at ${SHOW_CONTACT_PHONE_INTL}.`,
    withdrawFailed: `We could not cancel the request. Contact: ${SHOW_CONTACT_PHONE_INTL}`,
    withdrawNetwork: 'A network error stopped the cancellation. Please try again in a moment.',
    withdrawn: 'Your request has been cancelled. No money was received, so there is nothing to refund.',
    depositAria: 'Bank transfer details',
    depositHeld: 'Your seats are held. Once we confirm your transfer, your ticket (QR code) is issued and emailed to you.',
    applicant: 'person who booked',
    processing: 'Processing…',
    withdraw: 'Cancel this booking request (before transfer)',
    refundDoneBank: (amount: string) => `Refund request received. We will send ${amount} to the account you entered within 3 business days.`,
    refundDoneCard: (amount: string) => `${amount} has been refunded. Depending on your card company, it may take a few business days to appear.`,
    refundFailed: `We could not process the refund. Contact: ${SHOW_CONTACT_PHONE_INTL}`,
    refundNetwork: 'A network error stopped us from confirming the refund. Please refresh to check the status.',
    orderLine: (orderNo: string, name: string, total: string) => `Order ${orderNo} · ${name} · Paid ${total}`,
    cancelledViaAccount: 'This showtime has been cancelled. You paid by bank transfer, so you get a full refund — choose your tickets below and enter the account for the refund.',
    cancelledOther: `This showtime has been cancelled. We will contact you separately about the refund. Contact: ${SHOW_CONTACT_PHONE_INTL}`,
    entryLead: 'Admission is ',
    entryStrong: 'general admission, first come, first served',
    entryTail: '. Show your QR code at the door and we will give you an entry number.',
    checkedIn: 'Checked in',
    ticketN: (n: number) => `Ticket ${n}`,
    qrAlt: (n: number) => `Entry QR code for ticket ${n}`,
    entryNumber: 'Entry number',
    refundPick: 'Select for refund',
    refundNow: (amount: string) => `(refund now: ${amount})`,
    refundAria: 'Refund',
    noRefundable: `No tickets can be refunded right now (not possible after check-in, after a refund, or once the show has started). Contact: ${SHOW_CONTACT_PHONE_INTL}`,
    pickFirst: 'Select the tickets to refund above',
    refundButton: (n: number, amount: string) => `Refund ${n} ticket${n === 1 ? '' : 's'} · ${amount}`,
    refundPolicy: 'Refund policy',
  },
};

/**
 * 계좌 입금 대기 — 계좌 안내(펀딩·예약과 같은 BankDepositGuide)와 "입금 전 신청 취소". 좌석은 입금을 확인할
 * 때까지 잡혀 있고, 확인되면 티켓(QR)이 메일로 간다. 취소하면 좌석이 바로 풀리고 메일은 없다.
 */
function DepositWaiting({ order, token, locale }: { order: ManageOrderView; token: string; locale: ShowLocale }) {
  const t = T[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const guide = order.depositGuide!;
  const withdraw = async () => {
    if (!window.confirm(t.withdrawConfirm)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/shows/refund', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: order.orderNo, token, action: 'withdraw', locale }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) setClosed(true);
      else setError(data?.message ?? t.withdrawFailed);
    } catch {
      setError(t.withdrawNetwork);
    } finally {
      setBusy(false);
    }
  };
  if (closed) {
    return <Notice tone="neutral" role="status">{t.withdrawn}</Notice>;
  }
  return (
    <section aria-label={t.depositAria}>
      <Notice tone="info">{t.depositHeld}</Notice>
      <BankDepositGuide amount={guide.amount} deadline={guide.deadline} customerName={guide.customerName} applicantLabel={t.applicant} locale={locale} />
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
      <Button type="button" variant="weak" fullWidth className="mt-8" disabled={busy} onClick={withdraw}>
        {busy ? t.processing : t.withdraw}
      </Button>
    </section>
  );
}

/** 내 티켓 — QR·입장번호를 보여 주고, 환불 가능한 티켓을 골라 셀프 환불한다. */
export default function ShowTicketManage({ order, token, qr, locale = 'ko' }: Props) {
  const t = T[locale];
  const won = (n: number) => formatShowWon(n, locale);
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
        body: JSON.stringify({ orderNo: order.orderNo, token, ticketIds: selected, locale, ...(viaAccount ? { refundAccount } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { ok: boolean; refundAmount?: number; message?: string; refundVia?: string } | null;
      if (res.ok && data?.ok) {
        const amount = won(data.refundAmount ?? refundTotal);
        setDone(data.refundVia === 'bank_account' ? t.refundDoneBank(amount) : t.refundDoneCard(amount));
        setSelected([]);
        // 서버가 그린 상태(티켓 상태·QR)를 다시 받는다 — 문서 이동이라 토큰 URL이 그대로 유지된다.
        window.setTimeout(() => window.location.reload(), 1800);
      } else {
        setError(data?.message ?? t.refundFailed);
      }
    } catch {
      setError(t.refundNetwork);
    } finally {
      setBusy(false);
    }
  };

  const notice = t.notices[order.orderStatus];
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
          {t.orderLine(order.orderNo, order.buyerName, won(order.totalAmount))}
        </p>
      </header>

      {cancelledShowtime && (
        <Notice tone="warning" role="status">
          {viaAccount && refundable.length > 0 ? t.cancelledViaAccount : t.cancelledOther}
        </Notice>
      )}
      {order.bankDeposit === 'awaiting' && order.depositGuide ? <DepositWaiting order={order} token={token} locale={locale} /> : null}
      {notice && <Notice tone="neutral" role="status">{notice}</Notice>}

      {/* 입금 대기 중에는 티켓이 아직 발권 전(보류)이라 티켓 카드·환불 칸을 그리지 않는다 — 위 입금 안내가 이 화면의 전부다. */}
      {order.bankDeposit !== 'awaiting' && (<>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {t.entryLead}<strong>{t.entryStrong}</strong>{t.entryTail}
      </p>

      {/*
        티켓 한 장 = 카드 한 장(지갑 메타포). QR이 가장 크고, 입장 번호·상태가 그 아래. 환불 선택은 카드 안의
        체크 하나다 — 선택하면 아래 고정 줄의 버튼에 매수·금액이 바로 찍히고, 그 버튼 한 번으로 환불된다(2단계).
        예전엔 선택 → 신청 → 확정 3단계였다(운영자 지시 2026-10-03: 동의·단계 최소화).
      */}
      <ul className="space-y-4">
        {order.tickets.map((tk, i) => {
          const qrUrl = qr[tk.id];
          const isSelected = selected.includes(tk.id);
          const statusLabel = tk.checkedIn ? t.checkedIn : t.status[tk.status];
          const live = !tk.checkedIn && tk.status === 'issued';
          return (
            <li key={tk.id}>
              <BaseCard variant={isSelected ? 'glass-highlight' : 'glass'} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="typo-card-meta">{t.ticketN(i + 1)}</p>
                    <p className="typo-card-subtitle text-gray-900 dark:text-white">{tk.ticketTypeName}</p>
                  </div>
                  <Badge tone={live ? 'brand' : 'neutral'} size="md">{statusLabel}</Badge>
                </div>
                {qrUrl && (
                  <div className="mt-4 flex justify-center">
                    {/* QR은 라이트 배경이 필요하다 — 다크 모드에서도 흰 바탕을 유지해 스캐너가 읽게 한다. */}
                    <Image src={qrUrl} alt={t.qrAlt(i + 1)} width={220} height={220} unoptimized className="rounded-lg bg-white p-2" />
                  </div>
                )}
                {tk.entryNumber != null && (
                  <p className="mt-3 text-center text-sm text-gray-700 dark:text-gray-300">
                    {t.entryNumber} <strong className="text-2xl tabular-nums text-gray-900 dark:text-white">{formatEntryNumber(tk.entryNumber)}</strong>
                  </p>
                )}
                {tk.refundAmountNow != null && (
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggle(tk.id)}
                    emphasis
                    className="mt-4 border-t border-gray-200/70 pt-3 dark:border-gray-700/70"
                    label={
                      <>
                        {t.refundPick} <span className="text-gray-500 dark:text-gray-400">{t.refundNow(won(tk.refundAmountNow))}</span>
                      </>
                    }
                  />
                )}
              </BaseCard>
            </li>
          );
        })}
      </ul>

      <section aria-label={t.refundAria} className="space-y-3">
        {refundable.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t.noRefundable}
          </p>
        ) : (
          <>
            {viaAccount && selected.length > 0 && refundTotal > 0 && (
              <RefundAccountFields idPrefix="show-refund" value={refundAccount} onChange={setRefundAccount} locale={locale} />
            )}
            {/* 버튼 라벨이 곧 확인 문구다 — 매수·금액을 보고 누른다. 별도 확정 단계를 두지 않는다. */}
            <Button type="button" fullWidth
              disabled={selected.length === 0 || busy || (viaAccount && refundTotal > 0 && !isRefundAccountFilled(refundAccount))}
              onClick={submitRefund}>
              {busy ? t.processing : selected.length === 0 ? t.pickFirst : t.refundButton(selected.length, won(refundTotal))}
            </Button>
            <Disclosure variant="plain" summary={t.refundPolicy} summaryClassName="text-sm font-medium text-gray-600 dark:text-gray-300" bodyClassName="text-xs">
              <RefundPolicyList locale={locale} />
            </Disclosure>
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {done && <Notice tone="success">{done}</Notice>}
      </section>
      </>)}
    </div>
  );
}
