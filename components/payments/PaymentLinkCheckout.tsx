import { useEffect, useState } from 'react';

import type { CheckoutPaymentMethod } from '../../lib/payments/bankDeposit';
import { wantsBankFallback } from '../../lib/payments/bankFallback';
import { reportPaymentFailure } from '../../utils/reportPaymentFailure';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import BankDepositGuide from './BankDepositGuide';
import BankDepositFallback from './BankDepositFallback';
import PaymentMethodPicker from './PaymentMethodPicker';
import { usePaymentCheckout } from './usePaymentCheckout';

type CreateOrderResponse =
  | { ok: true; orderNo: string; totalAmount: number; orderName: string; deposit?: { deadline: string } }
  | { ok: false; message?: string };

/**
 * 예약금 결제 링크의 결제 폼 — 믹싱 주문 위저드의 결제 단계(components/booking/MixingOrderWizard.tsx 2단계)와 같은
 * 구성이다: 주문자 정보 → 결제수단(토스 목록, 막힌 분은 계좌번호 직접 입금 폴백) → 한 번의 제출.
 */
export default function PaymentLinkCheckout({ slug, totalAmount }: { slug: string; totalAmount: number }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bankGuide, setBankGuide] = useState<{ deadline: string; customerName: string } | null>(null);

  const {
    ready: paymentReady, error: paymentError, requestPayment,
    choice: pickerChoice, setChoice: setPickerChoice, applePaySupported,
  } = usePaymentCheckout(totalAmount);

  /** 결제수단 — 기본은 토스, 결제가 어려운 분만 계좌번호 직접 입금(폴백, 2026-10-14). 시작 시각이 없어 막는 조건이 없다. */
  const [payMethod, setPayMethod] = useState<CheckoutPaymentMethod>('toss');
  const usingBank = payMethod === 'bank_transfer';
  // 결제 실패 화면에서 "계좌번호로 직접 보내기"로 돌아온 경우 — 계좌 안내 모드로 연다(lib/payments/bankFallback.ts).
  useEffect(() => {
    if (wantsBankFallback(window.location.search)) setPayMethod('bank_transfer');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    let createdOrderNo: string | null = null;
    try {
      const res = await fetch('/api/payment-links/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          ...(usingBank ? { paymentMethod: 'bank_transfer' } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as CreateOrderResponse | null;
      if (res.status !== 201 || !data || !data.ok) {
        setSubmitError((data && !data.ok && data.message) || '주문 신청에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }

      if (usingBank) {
        // 계좌 입금 — 결제창이 없다. 입금 안내를 이 화면에 보여준다(금액·기한은 서버가 돌려준 값).
        if (!data.deposit) {
          setSubmitError('입금 안내를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        setBankGuide({ deadline: data.deposit.deadline, customerName: customerName.trim() });
        return;
      }

      // 주문이 만들어졌으면 곧바로 결제창을 연다. 금액은 서버가 돌려준 값으로 맞춘다.
      const origin = window.location.origin;
      createdOrderNo = data.orderNo;
      await requestPayment({
        orderId: data.orderNo,
        orderName: data.orderName,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        amount: data.totalAmount,
        successUrl: `${origin}/ko/pay/success`,
        failUrl: `${origin}/ko/pay/fail?slug=${slug}`,
      });
    } catch (err) {
      // 결제창이 열리기 전에 SDK가 던진 실패는 여기서만 알 수 있다 — 취소를 거르기 전에 기록한다.
      reportPaymentFailure(createdOrderNo, err);
      const code = (err as { code?: string } | null)?.code;
      // 결제창을 닫은 것은 오류가 아니다 — 아무 문구도 띄우지 않는다.
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') return;
      setSubmitError('네트워크 오류로 주문 신청에 실패했어요. 잠시 후 다시 시도해 주세요. 결제가 계속 어려우시면 아래 "계좌번호로 직접 보내기"를 이용하실 수 있어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
  {bankGuide ? (
    <BankDepositGuide amount={totalAmount} deadline={bankGuide.deadline} customerName={bankGuide.customerName} />
  ) : (
    <section aria-labelledby="pay-form-heading">
      <h2 id="pay-form-heading" className="typo-card-subtitle mb-3 text-gray-900 dark:text-white">
        주문자 정보
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="customerName" label="이름" required>
          <TextInput
            type="text"
            autoComplete="name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </Field>
        <Field id="customerPhone" label="휴대폰 번호" required>
          <TextInput
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            required
          />
        </Field>
        <Field id="customerEmail" label="이메일" required>
          <TextInput
            type="email"
            inputMode="email"
            autoComplete="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            required
          />
        </Field>

        {/* 결제수단 — 기본은 토스 목록이고, 결제가 어려운 분만 목록 아래 링크로 계좌번호 직접 입금을 연다(2026-10-14). */}
        <div className="pt-2">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">결제수단</h3>
          {!usingBank && (
            <>
              <PaymentMethodPicker
                name="pay-paymethod"
                value={pickerChoice}
                onChange={setPickerChoice}
                applePaySupported={applePaySupported}
                confirmLabel="예약금 결제가 확정"
              />
              {paymentError && <Notice tone="error" className="mt-3">{paymentError}</Notice>}
            </>
          )}
          <BankDepositFallback
            active={usingBank}
            onEnter={() => setPayMethod('bank_transfer')}
            onLeave={() => setPayMethod('toss')}
            confirmLabel="예약금 결제가 확정"
          />
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          {usingBank
            ? '신청하시면 입금하실 계좌를 바로 알려 드려요. 입금이 확인되면 메일로 알려 드려요.'
            : '결제가 끝나면 바로 확정돼요.'}
        </p>

        {submitError && <Notice tone="error">{submitError}</Notice>}

        {/* 결제 설정이 없으면 누를 수 없다 — 누르면 주문만 만들어지고 결제창은 안 열린다. 계좌 입금은 설정이 필요 없다. */}
        <Button type="submit" disabled={submitting || (!usingBank && !paymentReady)} fullWidth>
          {submitting ? '처리 중…' : usingBank ? '계좌 안내 받기' : '결제하기'}
        </Button>
      </form>
    </section>
  )}
    </>
  );
}
