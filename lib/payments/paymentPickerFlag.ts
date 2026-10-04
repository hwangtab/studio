/**
 * 새 결제 화면(우리가 그린 결제수단 목록 → 토스 결제창 직행)을 켤지 판정한다 — **이 함수 하나가 정본**.
 *
 * 기본값은 지금처럼 **토스 결제위젯**이다. 운영자가 운영에서 먼저 시험할 수 있게 런타임 스위치를 둔다.
 *
 * 1. 주소 쿼리 `?pay=v2` → 켠다, `?pay=widget` → 끈다. 둘 다 쿠키에 기억해 이후 페이지(상세 → 결제
 *    모달 → /pledge 등)에서도 유지된다.
 * 2. 쿠키 `studio_pay=v2|widget`(1의 기억).
 * 3. env `NEXT_PUBLIC_PAYMENT_PICKER=on`이면 전체 기본값이 새 화면(쿠키 `widget`으로 개별 해제 가능).
 *
 * 순수 함수다 — 브라우저 값은 호출부(usePaymentCheckout)가 읽어 넘긴다.
 */
export const PAYMENT_PICKER_QUERY = 'pay';
export const PAYMENT_PICKER_COOKIE = 'studio_pay';
export const PAYMENT_PICKER_ON = 'v2';
export const PAYMENT_PICKER_OFF = 'widget';

export interface PaymentPickerDecision {
  on: boolean;
  /** 쿠키에 새로 기억할 값. null이면 쿠키를 건드리지 않는다. */
  remember: typeof PAYMENT_PICKER_ON | typeof PAYMENT_PICKER_OFF | null;
}

const readCookie = (cookie: string, name: string): string | null => {
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
};

export const resolvePaymentPicker = (input: {
  envValue: string | undefined;
  search: string;
  cookie: string;
}): PaymentPickerDecision => {
  const query = new URLSearchParams(input.search).get(PAYMENT_PICKER_QUERY)?.toLowerCase();
  if (query === PAYMENT_PICKER_ON) return { on: true, remember: PAYMENT_PICKER_ON };
  if (query === PAYMENT_PICKER_OFF) return { on: false, remember: PAYMENT_PICKER_OFF };
  const cookie = readCookie(input.cookie, PAYMENT_PICKER_COOKIE);
  if (cookie === PAYMENT_PICKER_ON) return { on: true, remember: null };
  if (cookie === PAYMENT_PICKER_OFF) return { on: false, remember: null };
  return { on: input.envValue?.trim().toLowerCase() === 'on', remember: null };
};
