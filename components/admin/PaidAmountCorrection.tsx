import React, { useState } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { lightOnlyField } from '../ui/adminFieldClass';
import { formatPriceAmount } from '../../data/pricing';

/**
 * 입금 확인이 끝난 계좌 입금 주문의 **금액 정정** 폼 — 공연 티켓·상점 주문 화면이 같이 쓴다(lib/booking/paidAmount.ts).
 * 금액과 사유를 받아 `onSubmit`으로 넘길 뿐이고, 요청·새로고침은 부모 화면이 한다.
 */
export function PaidAmountCorrection({ totalAmount, busy, note, onSubmit }: {
  totalAmount: number;
  busy: boolean;
  /** 이 주문 종류에서 정정이 무엇을 바꾸는지 한두 문장. */
  note: string;
  onSubmit: (amount: number, reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(totalAmount));
  const [reason, setReason] = useState('');

  if (!open) {
    return <Button light variant="weak" size="sm" disabled={busy} onClick={() => { setAmount(String(totalAmount)); setOpen(true); }}>금액 정정</Button>;
  }

  const submit = () => {
    const cleaned = amount.replace(/[,\s원]/g, '');
    // 빈 칸은 Number('')가 0이라 "완전 무료"로 제출되어 버린다 — 무료는 0을 직접 적었을 때만.
    if (cleaned === '') { window.alert('바꿀 금액을 적어 주세요. 무료면 0을 적어요.'); return; }
    const next = Number(cleaned);
    const free = next === 0 ? '0원(완전 무료)으로 정정하면 이 주문의 매출이 0원이 되고 환불할 돈도 없어요.\n\n주의: 0원이 된 주문은 취소(환불) 화면에서 처리되지 않아요. 나중에 취소해야 하면 먼저 금액을 다시 1,000원 이상으로 정정한 뒤, 환불 금액을 0으로 두고 취소하세요.\n\n' : '';
    if (!window.confirm(`${free}금액을 ${formatPriceAmount(totalAmount)}원 → ${Number.isFinite(next) ? formatPriceAmount(next) : amount}원으로 정정할까요?\n\n매출 현황과 환불 가능 금액이 함께 바뀌고, 사유와 함께 기록이 남습니다. 고객에게 메일은 가지 않습니다.`)) return;
    onSubmit(next, reason);
  };

  return (
    <div className="mt-2 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 text-gray-900">
      <Field id="paid-amount" label="바꿀 금액 (부가세 포함, 원 — 무료면 0)" className={lightOnlyField}><TextInput inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} light /></Field>
      <Field id="paid-amount-reason" label="정정 사유 (기록에 남아요)" className={lightOnlyField}><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 지인 할인 2만원, 현금 일부 수령" light /></Field>
      <p className="text-xs text-gray-500">{note} 환불이 한 번이라도 있으면 정정할 수 없어요.</p>
      <div className="flex flex-wrap gap-2">
        <Button light size="sm" disabled={busy || reason.trim().length < 2} onClick={submit}>정정</Button>
        <Button light variant="weak" size="sm" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
      </div>
    </div>
  );
}
