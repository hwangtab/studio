import React, { useState } from 'react';
import { useRouter } from 'next/router';

import { Button } from '../ui/Button';
import { formatCurrency } from '../../lib/contracts/format';
import { formatAdminDateTime } from '../../lib/admin/displayDate';

export interface RefundAccountSummaryProps {
  refundable: number;
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
    if (!window.confirm('환불 송금을 마쳤다고 기록할까요?')) return;
    setBusy(true);
    await fetch(`/api/contracts/production/${contractId}/refund-account`, { method: 'POST', credentials: 'same-origin' });
    setBusy(false);
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const { account } = summary;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 mb-6 text-sm">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-2">환불 계좌</h2>
      <p className="text-gray-600 mb-3">정산 추정 환불액 {formatCurrency(summary.refundable)}원 (제10조 — 진행 영역의 추정과 같은 계산)</p>
      {!account ? (
        <p className="text-gray-500">
          {summary.refundable > 0 ? '의뢰인이 아직 진행 페이지에 환불 계좌를 적지 않았습니다.' : '돌려줄 금액이 없습니다.'}
        </p>
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
