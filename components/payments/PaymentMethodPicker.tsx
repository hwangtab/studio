import { CreditCard, Landmark } from 'lucide-react';

import { ChoiceCard } from '../ui/Choice';

import { BANK_ACCOUNT, BANK_ACCOUNT_EN } from '../../lib/payments/bankAccount';
import { type PaymentChoice, type PaymentChoiceId, visiblePaymentChoices } from '../../lib/payments/paymentChoices';

/**
 * 결제수단 목록 — 결제 공용(펀딩·예약·믹싱·공연). 토스 결제위젯 대신 **우리가 그린다**(기능 플래그,
 * lib/payments/paymentPickerFlag.ts). 줄의 모양은 다른 "고르기"와 같은 ChoiceCard다(2026-10-05 —
 * 그 전엔 SAF2026 캡처를 옮긴 전용 줄이었다. 왼쪽 강조 바·손으로 그린 라디오가 사이트 안에서 이 화면에만 있었다):
 *
 * - 간편결제는 **공식 로고**(대체텍스트 = 서비스 이름), 카드·계좌는 아이콘 + 글자.
 * - 계좌 줄 오른쪽에 작은 보조 문구(은행 · 입금 확인 후 …).
 * - 아래 한 줄에 고른 수단이 무엇을 하는지 적는다.
 *
 * 네이티브 라디오라 화살표 키·스크린리더가 그대로 동작한다. 애플페이는 지원 환경에서만 보인다.
 */
export default function PaymentMethodPicker({
  name, value, onChange, applePaySupported, bankBlockedMessage, confirmLabel = '확정', locale = 'ko',
}: {
  name: string;
  value: PaymentChoiceId;
  onChange: (next: PaymentChoiceId) => void;
  applePaySupported: boolean;
  /** 있으면 계좌 줄을 막고 그 이유를 보인다(한정 리워드·시작 임박). */
  bankBlockedMessage?: string | null;
  /** 결제·입금 확인 뒤 일어나는 일 — "확정", "예약이 확정", "티켓이 발권", "주문이 접수". */
  confirmLabel?: string;
  /** 영어 화면(공연 /en)이면 'en' — confirmLabel도 영어로 넘긴다. 결제창으로 넘기는 값(easyPay)은 그대로 한국어다. */
  locale?: 'ko' | 'en';
}) {
  const en = locale === 'en';
  const choices = visiblePaymentChoices({ applePaySupported }).map((c) => (en ? { ...c, label: PAYMENT_LABELS_EN[c.id] ?? c.label } : c));
  const active = choices.find((c) => c.id === value);
  const hintId = `${name}-hint`;

  return (
    <fieldset className="min-w-0" aria-describedby={hintId}>
      <legend className="sr-only">{en ? 'Payment method' : '결제수단'}</legend>
      <div className="grid gap-2">
        {choices.map((choice) => {
          const disabled = choice.id === 'bank_transfer' && Boolean(bankBlockedMessage);
          return (
            <ChoiceCard
              key={choice.id}
              name={name}
              value={choice.id}
              checked={choice.id === value}
              disabled={disabled}
              onChange={() => onChange(choice.id)}
              aria-label={choice.label}
              title={<ChoiceBody choice={choice} />}
              trailing={
                choice.id === 'bank_transfer' ? (
                  // 휴대폰 폭에서는 은행 이름만(나머지는 아래 안내 줄이 말한다).
                  <span className="whitespace-nowrap text-sm font-normal text-gray-500 dark:text-gray-400">
                    {disabled ? (en ? 'Unavailable' : '이용 불가') : en ? (
                      <>{BANK_ACCOUNT_EN.bankName}<span className="hidden sm:inline"> · {confirmLabel} after we confirm</span></>
                    ) : (
                      <>{BANK_ACCOUNT.bankName}<span className="hidden sm:inline"> · 입금 확인 후 {confirmLabel}</span></>
                    )}
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </div>
      <p id={hintId} className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {bankBlockedMessage && value !== 'bank_transfer'
          ? `${hintFor(active, confirmLabel, en)} ${en ? 'Bank transfer' : '계좌 입금'}: ${bankBlockedMessage}`
          : hintFor(active, confirmLabel, en)}
      </p>
    </fieldset>
  );
}

function ChoiceBody({ choice }: { choice: PaymentChoice }) {
  if (choice.logo) {
    // 다크 모드에서 검은 글자 로고(토스·애플페이)가 사라지지 않게 흰 바탕 칩에 얹는다.
    return (
      <span className="inline-flex items-center rounded-lg dark:bg-white dark:px-1.5 dark:py-1">
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
    <span className="flex items-center gap-2">
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
      {choice.label}
    </span>
  );
}

const PAYMENT_LABELS_EN: Partial<Record<PaymentChoiceId, string>> = {
  card: 'Credit / debit card',
  bank_transfer: 'Bank transfer (Korean bank account)',
  kakaopay: 'KakaoPay',
  naverpay: 'Naver Pay',
  tosspay: 'Toss Pay',
  payco: 'PAYCO',
  applepay: 'Apple Pay',
};

const hintFor = (choice: PaymentChoice | undefined, confirmLabel: string, en = false): string => {
  if (en) {
    if (!choice || choice.id === 'card') return `Choose your card company in the card payment window. Once payment is complete, ${confirmLabel} right away.`;
    if (choice.id === 'bank_transfer') {
      return `Send it from a Korean bank or ATM. We show you the account right away, and once we confirm the transfer, ${confirmLabel} and we let you know by email.`;
    }
    return `Goes straight to the ${choice.label} payment window. Once payment is complete, ${confirmLabel} right away.`;
  }
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
