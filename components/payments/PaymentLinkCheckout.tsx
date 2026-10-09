import { useState } from 'react';

import { TOSS_TERMS_REQUIRED_MESSAGE } from '../booking/useTossPaymentWidgets';
import type { CheckoutPaymentMethod } from '../../lib/payments/bankDeposit';
import { reportPaymentFailure } from '../../utils/reportPaymentFailure';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import BankDepositGuide from './BankDepositGuide';
import PaymentMethodChoice from './PaymentMethodChoice';
import PaymentMethodPicker, { PaymentMethodSkeleton } from './PaymentMethodPicker';
import { usePaymentCheckout } from './usePaymentCheckout';

type CreateOrderResponse =
  | { ok: true; orderNo: string; totalAmount: number; orderName: string; deposit?: { deadline: string } }
  | { ok: false; message?: string };

/**
 * 예약금 결제 링크의 결제 폼 — 믹싱 주문 위저드의 결제 단계(components/booking/MixingOrderWizard.tsx 2단계)와 같은
 * 구성이다: 주문자 정보 → 결제수단(위젯 또는 `?pay=v2` 목록, 계좌 입금) → 한 번의 제출. 계좌를 고르면
 * 위젯을 **숨기기만** 한다(언마운트하면 약관 동의가 풀린다).
 */
export default function PaymentLinkCheckout({ slug, totalAmount }: { slug: string; totalAmount: number }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bankGuide, setBankGuide] = useState<{ deadline: string; customerName: string } | null>(null);

  const {
    methodsId, agreementId, ready: paymentReady, error: paymentError, retry: retryPayment, requestPayment,
    agreedRequiredTerms, picker, choice: pickerChoice, setChoice: setPickerChoice, applePaySupported,
  } = usePaymentCheckout(totalAmount);

  /** 결제수단 — 카드·간편결제(토스) / 계좌로 직접 입금. 시작 시각이 없어 막는 조건이 없다. */
  const [payMethod, setPayMethod] = useState<CheckoutPaymentMethod>('toss');
  const usingBank = payMethod === 'bank_transfer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // 위젯이 그리는 결제 약관도 제출 전에 본다(믹싱 주문과 같은 이유 — 주문만 만들어지고 결제가 실패하는 것을 막는다).
    if (!usingBank && agreedRequiredTerms !== true) {
      setSubmitError(TOSS_TERMS_REQUIRED_MESSAGE);
      document.getElementById(agreementId)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      return;
    }

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
      if (agreedRequiredTerms !== true) {
        setSubmitError(TOSS_TERMS_REQUIRED_MESSAGE);
      } else if (code === 'NEED_CARD_PAYMENT_DETAIL') {
        setSubmitError('카드 결제는 카드사를 먼저 골라 주세요. 결제 방법 아래에서 카드사를 선택한 뒤 다시 눌러 주세요.');
      } else {
        setSubmitError('네트워크 오류로 주문 신청에 실패했어요. 잠시 후 다시 시도해 주세요.');
      }
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

        {/* 결제수단 — 카드·간편결제(토스) / 계좌로 직접 입금. 토스 수단과 결제 약관 동의는 위젯이 그린다.
            계좌를 고르면 위젯을 숨기기만 한다. 기능 플래그(`?pay=v2`)가 켜지면 위젯 대신 우리가 그린 목록이다. */}
        <div className="pt-2">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">결제수단</h3>
          {picker === null ? (
            <PaymentMethodSkeleton />
          ) : picker ? (
            <>
              <PaymentMethodPicker
                name="pay-paymethod"
                value={usingBank ? 'bank_transfer' : pickerChoice}
                onChange={(next) => {
                  if (next === 'bank_transfer') { setPayMethod('bank_transfer'); return; }
                  setPayMethod('toss');
                  setPickerChoice(next);
                }}
                applePaySupported={applePaySupported}
                bankBlockedMessage={null}
                confirmLabel="예약금 결제가 확정"
              />
              {paymentError && <Notice tone="error" className="mt-3">{paymentError}</Notice>}
            </>
          ) : (
            <>
              <PaymentMethodChoice name="pay-paymethod" value={payMethod} onChange={setPayMethod} confirmLabel="예약금 결제가 확정" />
              <div hidden={usingBank} className="mt-3">
                {paymentError ? (
                  <Notice tone="error" actions={<Button type="button" size="sm" variant="weak" onClick={retryPayment}>다시 시도</Button>}>
                    {paymentError}
                  </Notice>
                ) : (
                  <>
                    <div id={methodsId} />
                    <div id={agreementId} />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          {usingBank
            ? '신청하시면 입금하실 계좌를 바로 알려 드려요. 입금이 확인되면 메일로 알려 드려요.'
            : '결제가 끝나면 바로 확정돼요.'}
        </p>

        {submitError && <Notice tone="error">{submitError}</Notice>}

        {/* 위젯이 아직 안 떴으면 누를 수 없다 — 누르면 주문만 만들어지고 결제창은 안 열린다. 계좌 입금은 위젯이 필요 없다. */}
        <Button type="submit" disabled={submitting || (!usingBank && !paymentReady)} fullWidth>
          {submitting ? '처리 중…' : usingBank ? '계좌 안내 받기' : '결제하기'}
        </Button>
      </form>
    </section>
  )}
    </>
  );
}
