import { CreditCard, Landmark } from 'lucide-react';

import { BANK_ACCOUNT } from '../../lib/payments/bankAccount';
import { type PaymentChoice, type PaymentChoiceId, visiblePaymentChoices } from '../../lib/payments/paymentChoices';

/**
 * 결제수단 목록 — 결제 공용(펀딩·예약·믹싱·공연). 토스 결제위젯 대신 **우리가 그린다**(기능 플래그,
 * lib/payments/paymentPickerFlag.ts). 모양은 SAF2026 결제 화면을 옮겼다(2026-10-04 캡처 대조):
 *
 * - 모든 줄이 **같은 높이**(min-h 56px), 줄 사이 1px 구분선, 바깥은 둥근 테두리 하나.
 * - 고른 줄은 연한 바탕 + **왼쪽 4px 강조 바** + 채워진 라디오.
 * - 간편결제는 **공식 로고**(대체텍스트 = 서비스 이름), 카드·계좌는 아이콘 + 글자.
 * - 계좌 줄 오른쪽에 작은 보조 문구(은행 · 입금 확인 후 …).
 * - 아래 한 줄에 고른 수단이 무엇을 하는지 적는다.
 *
 * 네이티브 라디오(sr-only)라 화살표 키·스크린리더가 그대로 동작한다. 애플페이는 지원 환경에서만 보인다.
 */
export default function PaymentMethodPicker({
  name, value, onChange, applePaySupported, bankBlockedMessage, confirmLabel = '확정',
}: {
  name: string;
  value: PaymentChoiceId;
  onChange: (next: PaymentChoiceId) => void;
  applePaySupported: boolean;
  /** 있으면 계좌 줄을 막고 그 이유를 보인다(한정 리워드·시작 임박). */
  bankBlockedMessage?: string | null;
  /** 결제·입금 확인 뒤 일어나는 일 — "확정", "예약이 확정", "티켓이 발권", "주문이 접수". */
  confirmLabel?: string;
}) {
  const choices = visiblePaymentChoices({ applePaySupported });
  const active = choices.find((c) => c.id === value);
  const hintId = `${name}-hint`;

  return (
    <fieldset className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700" aria-describedby={hintId}>
      <legend className="sr-only">결제수단</legend>
      {choices.map((choice, i) => {
        const selected = choice.id === value;
        const disabled = choice.id === 'bank_transfer' && Boolean(bankBlockedMessage);
        return (
          <label
            key={choice.id}
            className={[
              'relative flex min-h-14 items-center gap-4 px-5 py-3 transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-primary/70 dark:has-[:focus-visible]:ring-primary-lighter/70',
              i > 0 ? 'border-t border-gray-200 dark:border-gray-700' : '',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              selected ? 'bg-primary/5 dark:bg-primary-light/10' : disabled ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
            ].join(' ')}
          >
            <input
              type="radio" name={name} value={choice.id} className="sr-only"
              checked={selected} disabled={disabled} onChange={() => onChange(choice.id)}
              aria-label={choice.label}
            />
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-1 ${selected ? 'bg-primary dark:bg-primary-light' : 'bg-transparent'}`}
            />
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                selected ? 'border-primary dark:border-primary-light' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary dark:bg-primary-light" />}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <ChoiceBody choice={choice} selected={selected} />
              {choice.id === 'bank_transfer' && (
                // 줄 높이를 다른 줄과 맞추려고 한 줄로 둔다 — 휴대폰 폭에서는 은행 이름만(나머지는 아래 안내 줄이 말한다).
                <span className="shrink-0 whitespace-nowrap text-right text-xs text-gray-500 dark:text-gray-400">
                  {disabled ? '이용 불가' : (
                    <>{BANK_ACCOUNT.bankName}<span className="hidden sm:inline"> · 입금 확인 후 {confirmLabel}</span></>
                  )}
                </span>
              )}
            </span>
          </label>
        );
      })}
      <p
        id={hintId}
        className="border-t border-gray-200 bg-gray-50 px-5 py-3 text-sm leading-relaxed text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
      >
        {bankBlockedMessage && value !== 'bank_transfer'
          ? `${hintFor(active, confirmLabel)} 계좌 입금: ${bankBlockedMessage}`
          : hintFor(active, confirmLabel)}
      </p>
    </fieldset>
  );
}

function ChoiceBody({ choice, selected }: { choice: PaymentChoice; selected: boolean }) {
  if (choice.logo) {
    // 다크 모드에서 검은 글자 로고(토스·애플페이)가 사라지지 않게 흰 바탕 칩에 얹는다.
    return (
      <span className="inline-flex items-center rounded-md dark:bg-white dark:px-1.5 dark:py-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- 수 KB짜리 공식 로고, 최적화 대상 아님 */}
        <img
          src={choice.logo.src} alt={choice.label}
          width={choice.logo.width} height={choice.logo.height}
          className={`${choice.logo.heightClass} w-auto object-contain`}
          loading="lazy" decoding="async"
        />
      </span>
    );
  }
  const Icon = choice.id === 'card' ? CreditCard : Landmark;
  return (
    <span
      className={`flex items-center gap-2 text-sm font-medium ${
        selected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
      {choice.label}
    </span>
  );
}

const hintFor = (choice: PaymentChoice | undefined, confirmLabel: string): string => {
  if (!choice || choice.id === 'card') return `카드 결제창에서 카드사를 고릅니다. 결제가 끝나면 바로 ${confirmLabel}됩니다.`;
  if (choice.id === 'bank_transfer') {
    return `은행·ATM에서 보내실 수 있습니다. 신청하시면 입금할 계좌를 바로 알려 드리고, 입금을 확인하면 ${confirmLabel}되고 메일로 알려 드립니다.`;
  }
  return `${choice.label} 결제창으로 바로 이동합니다. 결제가 끝나면 바로 ${confirmLabel}됩니다.`;
};

/**
 * 판정 전(서버 렌더·하이드레이션 첫 패스) 결제수단 구획의 빈 자리. 목록·위젯 어느 쪽이 와도 크게 튀지 않게
 * 목록 높이(줄 6개 × 56px + 안내 줄)만큼 잡아 둔다. 내용이 없으니 스크린리더에는 숨긴다.
 */
export function PaymentMethodSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="payment-method-skeleton"
      className="min-h-[24rem] rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"
    />
  );
}
