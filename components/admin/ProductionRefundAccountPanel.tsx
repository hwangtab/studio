import React, { useState } from 'react';
import { useRouter } from 'next/router';

import { Button } from '../ui/Button';
import { formatCurrency } from '../../lib/contracts/format';
import { formatAdminDateTime } from '../../lib/admin/displayDate';

export interface RefundAccountSummaryProps {
  refundable: number;
  /** 결제 링크 카드·간편결제로 받은 몫 — 해지 때 토스로 취소한다(refund-plan.ts). `refunded`는 이미 취소된 금액. */
  card: Array<{ orderNo: string; amount: number; refunded: number }>;
  /** 환불 계좌로 송금할 몫(계좌 입금 링크 + 직접 기록한 입금). */
  bankTotal: number;
  account: { bankName: string; accountHolder: string; refundedAt: string | null } | null;
}

/**
 * 해지된 제작 계약의 환불 계좌. 화면 props에는 은행·예금주만 있고, 계좌번호는 "계좌 보기"를 누른 그 응답으로만
 * 받는다(접속기록이 남는다 — lib/payments/refundAccountView.ts). 받은 번호는 이 컴포넌트 상태에만 있다.
 */
export default function ProductionRefundAccountPanel({ contractId, summary }: { contractId: string; summary: RefundAccountSummaryProps }) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<{ accountNumber: string; holderMismatch: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reveal = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/contracts/production/${contractId}/refund-account`, { credentials: 'same-origin', cache: 'no-store' });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        account?: { accountNumber: string };
        holderMismatch?: boolean;
      };
      if (!response.ok || !body.account) setMessage(body.message ?? '계좌를 불러오지 못했습니다.');
      else setRevealed({ accountNumber: body.account.accountNumber, holderMismatch: Boolean(body.holderMismatch) });
    } finally {
      setBusy(false);
    }
  };

  const markRefunded = async () => {
    if (!window.confirm(`환불 ${formatCurrency(summary.bankTotal)}원 송금을 마쳤다고 기록할까요?`)) return;
    setBusy(true);
    const response = await fetch(`/api/contracts/production/${contractId}/refund-account`, { method: 'POST', credentials: 'same-origin' });
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    setMessage(body.message ?? null);
    setBusy(false);
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const retryCard = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/contracts/production/${contractId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry-card-refund' }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(body.message ?? (response.ok ? null : '카드 환불을 처리하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const { account } = summary;
  const cardPending = summary.card.reduce((sum, c) => sum + Math.max(0, c.amount - c.refunded), 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 mb-6 text-sm">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-2">환불</h2>
      <p className="text-gray-600 mb-3">정산 환불액 {formatCurrency(summary.refundable)}원 (제10조 — 진행 영역의 추정과 같은 계산). 받은 길로 돌려줍니다 — 늦은 입금부터.</p>
      {summary.card.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900 mb-1">카드·간편결제 취소 (토스)</h3>
          <ul className="space-y-1">
            {summary.card.map((c) => (
              <li key={c.orderNo}>
                {c.orderNo} · {formatCurrency(c.amount)}원{' '}
                {c.refunded >= c.amount ? (
                  <span className="text-green-700">취소 완료</span>
                ) : (
                  <span className="text-red-600">미처리 {formatCurrency(c.amount - c.refunded)}원</span>
                )}
              </li>
            ))}
          </ul>
          {cardPending > 0 && (
            <Button light className="mt-2" disabled={busy} onClick={retryCard}>
              카드 환불 다시 시도
            </Button>
          )}
        </div>
      )}
      <h3 className="font-semibold text-gray-900 mb-1">계좌로 송금 {formatCurrency(summary.bankTotal)}원</h3>
      {summary.bankTotal <= 0 ? (
        <p className="text-gray-500">계좌로 돌려줄 금액이 없습니다.</p>
      ) : !account ? (
        <p className="text-gray-500">의뢰인이 아직 진행 페이지에 환불 계좌를 적지 않았습니다.</p>
      ) : (
        <div className="space-y-2">
          <p>
            {account.bankName} · 예금주 {account.accountHolder}
            {account.refundedAt && <span className="text-green-700"> · 송금 완료 {formatAdminDateTime(account.refundedAt)}</span>}
          </p>
          {revealed && (
            <p className="font-mono">
              {revealed.accountNumber}
              {revealed.holderMismatch && <span className="ml-2 text-amber-700 font-sans">예금주가 의뢰인 이름과 달라요 — 확인 후 송금하세요.</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!revealed && (
              <Button light variant="weak" disabled={busy} onClick={reveal}>
                계좌번호 보기
              </Button>
            )}
            {!account.refundedAt && (
              <Button light disabled={busy} onClick={markRefunded}>
                송금 완료 기록
              </Button>
            )}
          </div>
        </div>
      )}
      {message && <p className="mt-2 text-red-600">{message}</p>}
    </div>
  );
}
