import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk';

import {
  type TossPaymentChoiceId,
  buildTossPaymentRequest,
  paymentCustomerKey,
  withApiKeyChannel,
} from '../../lib/payments/paymentChoices';

export interface TossRequestPaymentParams {
  orderId: string;
  orderName: string;
  customerName: string;
  customerEmail?: string;
  /** origin을 포함한 전체 주소. */
  successUrl: string;
  failUrl: string;
  /**
   * 청구할 금액. 넘기면 결제창을 **서버가 확정한 값으로** 연다(없으면 화면 금액).
   *
   * 폼 안에서 후원자가 수량을 고치는 동안 화면 금액은 계속 움직인다. 서버가 돌려준 금액으로 열지 않으면
   * 화면의 추정치로 결제창이 열린다.
   */
  amount?: number;
}

/**
 * 결제 화면 공용 훅 — **우리가 그린 결제수단 목록**(PaymentMethodPicker)에서 고른 수단의 토스 결제창을 연다.
 *
 * 다섯 폼(PledgeWizard·BookingWizard·MixingOrderWizard·ShowBookingForm·ShopOrderForm)과 예약금 결제 링크가
 * 이 훅 하나로 결제를 시작한다. 토스 결제위젯(수단 목록 + 약관 iframe) 경로는 2026-10-14에 걷어냈다 —
 * 결제수단을 통일하려면 화면마다 목록이 같아야 하고, 위젯은 토스 콘솔 설정에 따라 줄이 달라졌다.
 *
 * `requestPayment`는 고른 수단(`choice`)의 결제창을 **API 개별 연동 키**(`NEXT_PUBLIC_TOSS_API_CLIENT_KEY`)로
 * 연다. 결제창이 자체 약관을 받으므로 우리 화면에는 약관 동의 UI가 없다.
 */
const noopSubscribe = () => () => {};

export const usePaymentCheckout = (amount: number, enabled = true) => {
  const [choice, setChoice] = useState<TossPaymentChoiceId>('card');
  const applePaySupported = useApplePaySupport();
  const apiClientKey = process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY;

  // 결제창을 누르는 순간 스크립트를 받느라 기다리지 않게 미리 불러 둔다. 실패해도 누를 때 다시 시도한다.
  useEffect(() => {
    if (!enabled || !apiClientKey) return;
    void loadTossPayments(apiClientKey).catch(() => {});
  }, [apiClientKey, enabled]);

  const amountRef = useRef(amount);
  amountRef.current = amount;
  const choiceRef = useRef(choice);
  choiceRef.current = choice;

  const requestPayment = useCallback(async ({ amount: finalAmount, ...params }: TossRequestPaymentParams) => {
    if (!apiClientKey) throw new Error('결제 설정이 없어요.');
    const toss = await loadTossPayments(apiClientKey);
    const payment = toss.payment({ customerKey: paymentCustomerKey(params.orderId, ANONYMOUS) });
    // 금액은 서버가 확정한 값으로 연다(없으면 화면 금액). 승인 경로가 같은 쌍의 시크릿부터 쓰게 표식을 붙인다.
    const request = buildTossPaymentRequest(choiceRef.current, {
      ...params,
      amount: finalAmount ?? amountRef.current,
      successUrl: withApiKeyChannel(params.successUrl),
    });
    await payment.requestPayment(request);
  }, [apiClientKey]);

  return {
    choice, setChoice, applePaySupported,
    ready: Boolean(apiClientKey),
    error: apiClientKey ? null : '결제 설정이 없어요.',
    requestPayment,
  };
};

/**
 * 애플페이를 쓸 수 있는 환경인가 — SAF2026 `lib/checkout/use-apple-pay-support.ts`를 옮겼다.
 * 토스 애플페이는 PC=Safari·모바일=iOS에서만 동작하고, 정확히 그 환경에만 `window.ApplePaySession`이 있다.
 * 서버 렌더·하이드레이션은 false라 애플페이 줄은 지원 환경에서만 나중에 붙는다(어긋남 없음).
 */
const applePaySnapshot = (): boolean => {
  try {
    const session = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    return typeof session?.canMakePayments === 'function' && session.canMakePayments() === true;
  } catch {
    return false;
  }
};
export const useApplePaySupport = (): boolean => useSyncExternalStore(noopSubscribe, applePaySnapshot, () => false);
