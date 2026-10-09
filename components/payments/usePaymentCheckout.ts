import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk';

import { type TossRequestPaymentParams, useTossPaymentWidgets } from '../booking/useTossPaymentWidgets';
import {
  type TossPaymentChoiceId,
  buildTossPaymentRequest,
  paymentCustomerKey,
  withApiKeyChannel,
} from '../../lib/payments/paymentChoices';
import { PAYMENT_PICKER_COOKIE, resolvePaymentPicker } from '../../lib/payments/paymentPickerFlag';

/**
 * 결제 화면 공용 훅 — **토스 결제위젯**(기본)과 **우리가 그린 결제수단 목록**(기능 플래그) 중 하나로 돈다.
 *
 * 네 폼(PledgeWizard·BookingWizard·MixingOrderWizard·ShowBookingForm)은 `useTossPaymentWidgets`를
 * 부르던 자리에서 이 훅을 부른다. 돌려주는 모양이 위젯 훅과 같아 폼의 제출 로직은 그대로다:
 *
 * - 위젯 모드(`picker === false`): 위젯 훅을 그대로 쓴다 — 지금과 100% 같은 흐름.
 * - 목록 모드(`picker === true`): 위젯을 붙이지 않는다. `requestPayment`는 고른 수단(`choice`)의
 *   결제창을 **API 개별 연동 키**(`NEXT_PUBLIC_TOSS_API_CLIENT_KEY`)로 연다. 위젯 약관 UI가 없으므로
 *   (결제창이 자체 약관을 받는다) `agreedRequiredTerms`는 늘 true — 폼의 위젯 약관 게이트를 타지 않는다.
 * - 판정 전(`picker === null`): 서버 렌더와 하이드레이션 첫 패스뿐이다(쿼리·쿠키는 브라우저에서만 읽힌다).
 *   폼은 이때 결제수단 구획을 같은 높이의 빈 자리(`PaymentMethodSkeleton`)로 둔다 — 옛 선택지가 한 프레임
 *   보였다가 바뀌는 깜빡임과 레이아웃 튐을 막는다.
 */
const noopSubscribe = () => () => {};

export const usePaymentCheckout = (amount: number, enabled = true) => {
  // 판정은 렌더 중에 동기로 읽는다(useSyncExternalStore). 서버 렌더·하이드레이션 첫 패스만 null이고,
  // 클라이언트에서 처음 그려지는 화면(모달·다음 단계)은 첫 렌더부터 값이 있다 — 위젯 마운트가 한 박자도
  // 늦어지지 않는다. 쿠키 기억은 부수 효과라 effect에서 한다.
  const picker = useSyncExternalStore(noopSubscribe, readPaymentPicker, () => null);
  useEffect(() => {
    try {
      const { remember } = resolvePickerFromBrowser();
      if (remember) {
        document.cookie = `${PAYMENT_PICKER_COOKIE}=${remember}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      }
    } catch {
      /* 기억하지 못해도 이번 화면은 판정대로 돈다. */
    }
  }, []);

  const widget = useTossPaymentWidgets(amount, enabled && picker === false);

  const [choice, setChoice] = useState<TossPaymentChoiceId>('card');
  const applePaySupported = useApplePaySupport();
  const apiClientKey = process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY;

  // 결제창을 누르는 순간 스크립트를 받느라 기다리지 않게 미리 불러 둔다. 실패해도 누를 때 다시 시도한다.
  useEffect(() => {
    if (!picker || !enabled || !apiClientKey) return;
    void loadTossPayments(apiClientKey).catch(() => {});
  }, [apiClientKey, enabled, picker]);

  const amountRef = useRef(amount);
  amountRef.current = amount;
  const choiceRef = useRef(choice);
  choiceRef.current = choice;

  const requestPickerPayment = useCallback(async ({ amount: finalAmount, ...params }: TossRequestPaymentParams) => {
    if (!apiClientKey) throw new Error('결제 설정이 없어요.');
    const toss = await loadTossPayments(apiClientKey);
    const payment = toss.payment({ customerKey: paymentCustomerKey(params.orderId, ANONYMOUS) });
    // 금액은 서버가 확정한 값으로 연다(없으면 화면 금액). 승인 경로가 같은 쌍의 시크릿부터 쓰게 표식을 붙인다.
    await payment.requestPayment(buildTossPaymentRequest(choiceRef.current, {
      ...params,
      amount: finalAmount ?? amountRef.current,
      successUrl: withApiKeyChannel(params.successUrl),
    }));
  }, [apiClientKey]);

  if (picker) {
    return {
      picker: true as const,
      choice, setChoice, applePaySupported,
      methodsId: widget.methodsId, agreementId: widget.agreementId,
      ready: Boolean(apiClientKey),
      error: apiClientKey ? null : '결제 설정이 없어요.',
      retry: widget.retry,
      requestPayment: requestPickerPayment,
      agreedRequiredTerms: true as boolean | null,
    };
  }
  return { ...widget, picker, choice, setChoice, applePaySupported };
};

const resolvePickerFromBrowser = () => resolvePaymentPicker({
  envValue: process.env.NEXT_PUBLIC_PAYMENT_PICKER,
  search: window.location.search,
  cookie: document.cookie,
});
/** 판정 실패는 기본값(위젯)으로 — 결제를 막지 않는다. */
const readPaymentPicker = (): boolean => {
  try {
    return resolvePickerFromBrowser().on;
  } catch {
    return false;
  }
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
