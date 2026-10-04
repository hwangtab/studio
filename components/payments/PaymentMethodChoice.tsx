import type { CheckoutPaymentMethod } from '../../lib/payments/bankDeposit';

const choiceRow =
  'flex items-start gap-3 rounded-xl border p-4 transition-colors cursor-pointer border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary-light/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:border-primary-light dark:has-[:checked]:bg-primary-light/10 focus-within:ring-2 focus-within:ring-primary/70 dark:focus-within:ring-primary-lighter/70';
const radioClass = 'mt-0.5 h-5 w-5 shrink-0 accent-primary';

/**
 * 결제수단 고르기 — **카드·간편결제(토스)** / **계좌로 직접 입금**. 결제 공용(공연·예약·믹싱). 펀딩 후원 폼
 * (PledgeWizard)의 같은 두 줄과 같은 말·같은 모양이다.
 *
 * 계좌를 고르면 호출부는 토스 위젯을 **언마운트하지 않고 숨긴다**(`hidden`) — 훅이 iframe을 걷었다 다시 그리며
 * 위젯 약관 동의가 풀린다. 마지막 버튼 말은 "계좌 안내 받기"다(버튼 규칙의 "결제하기" 자리).
 *
 * `bankBlockedMessage`가 있으면 계좌 줄을 막고 그 이유를 한 줄로 보인다(시작 임박 — lib/payments/bankDeposit.ts).
 */
export default function PaymentMethodChoice({ name, value, onChange, bankBlockedMessage, confirmLabel = '확정' }: {
  name: string;
  value: CheckoutPaymentMethod;
  onChange: (next: CheckoutPaymentMethod) => void;
  bankBlockedMessage?: string | null;
  /** 입금 확인 뒤 일어나는 일 — "예약이 확정", "티켓이 발권", "주문이 접수". */
  confirmLabel?: string;
}) {
  const blocked = Boolean(bankBlockedMessage);
  return (
    <div className="space-y-2" role="radiogroup" aria-label="결제 방법">
      <label className={choiceRow}>
        <input type="radio" name={name} value="toss" className={radioClass}
          checked={value === 'toss'} onChange={() => onChange('toss')} />
        <span className="min-w-0">
          <span className="block font-bold text-gray-900 dark:text-white">카드·간편결제</span>
          <span className="typo-card-meta block">결제가 끝나면 바로 {confirmLabel}됩니다.</span>
        </span>
      </label>
      <label className={`${choiceRow} ${blocked ? 'cursor-not-allowed opacity-50' : ''}`}>
        <input type="radio" name={name} value="bank_transfer" className={radioClass}
          checked={value === 'bank_transfer'} disabled={blocked} onChange={() => onChange('bank_transfer')} />
        <span className="min-w-0">
          <span className="block font-bold text-gray-900 dark:text-white">계좌로 직접 입금</span>
          <span className="typo-card-meta block">
            {bankBlockedMessage ?? `은행·ATM에서 보내실 수 있습니다. 입금을 확인하면 ${confirmLabel}하고 메일로 알려 드립니다.`}
          </span>
        </span>
      </label>
    </div>
  );
}
