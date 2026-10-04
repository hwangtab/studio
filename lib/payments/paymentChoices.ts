/**
 * 우리가 그리는 결제수단 목록 — 결제 공용(펀딩·예약·믹싱·공연). **순수 모듈**이다: 클라이언트
 * 컴포넌트가 값으로 가져가므로 서버 모듈(DB·node:fs)을 import하지 않는다.
 *
 * 토스 결제위젯 대신 SAF2026(`lib/checkout/payment-choices.ts`)처럼 수단을 직접 보여 주고, 고른
 * 수단의 결제창으로 바로 보낸다(Toss SDK v2 `payment().requestPayment()`, API 개별 연동 키).
 *
 * - 카드: `method: 'CARD'`(flowMode 기본 — 토스 카드 결제창에서 카드사를 고른다).
 * - 간편결제: `method: 'CARD', card: { flowMode: 'DIRECT', easyPay: '<한국어 이름>' }`로 그 결제창 직행.
 *   **easyPay는 한국어 값이다** — SAF2026 `lib/checkout/payment-choices.ts` 주석: "easyPay 영문
 *   enum('KAKAOPAY' 등)은 Toss 검증 단계에서 거부됨". 값도 그 파일의 PAYMENT_CHOICES에서 그대로 옮겼다.
 * - 애플페이: 간편결제와 같은 모양. PC=Safari·모바일=iOS에서만 동작하므로 `window.ApplePaySession`이
 *   결제를 할 수 있다고 답할 때만 보인다(`visiblePaymentChoices`).
 * - 계좌로 직접 입금(`bank_transfer`): 토스를 부르지 않는 기존 무통장 흐름 — 폼이 처리한다.
 *
 * **토스 계좌이체(TRANSFER)는 넣지 않는다**(운영자 결정 2026-10-04) — PC에서 보안 프로그램 설치
 * 화면이 떠 결제를 막는다. 계좌로 내고 싶은 사람은 "계좌로 직접 입금"을 쓴다.
 */

export type EasyPayKo = '카카오페이' | '네이버페이' | '토스페이' | '페이코' | '애플페이';

export type PaymentChoiceId = 'card' | 'bank_transfer' | 'kakaopay' | 'naverpay' | 'tosspay' | 'payco' | 'applepay';

/** 토스 결제창을 여는 수단(계좌 입금 제외). */
export type TossPaymentChoiceId = Exclude<PaymentChoiceId, 'bank_transfer'>;

export interface PaymentBrandLogo {
  src: string;
  width: number;
  height: number;
  /** 로고마다 여백·글자 비율이 달라 같은 높이면 시각 크기가 제각각이다 — SAF PaymentBrandLogo의 보정값. */
  heightClass: 'h-6' | 'h-5' | 'h-4';
}

export interface PaymentChoice {
  id: PaymentChoiceId;
  /** 화면 이름. 로고가 있는 수단은 로고의 대체텍스트(서비스 이름)로 쓴다. */
  label: string;
  logo?: PaymentBrandLogo;
  easyPay?: EasyPayKo;
  requiresApplePay?: boolean;
}

/**
 * 로고는 SAF2026 `public/images/payment/`의 공식 자산을 복사했다. `/images/**`는 1년 immutable
 * 캐시라 그림을 바꾸면 파일명(날짜)도 바꾼다(루트 CLAUDE.md).
 */
export const PAYMENT_CHOICES: readonly PaymentChoice[] = [
  { id: 'card', label: '신용·체크카드' },
  { id: 'bank_transfer', label: '계좌로 직접 입금' },
  {
    id: 'kakaopay', label: '카카오페이', easyPay: '카카오페이',
    logo: { src: '/images/payment/kakaopay-20261004.png', width: 121, height: 50, heightClass: 'h-6' },
  },
  {
    id: 'naverpay', label: '네이버페이', easyPay: '네이버페이',
    logo: { src: '/images/payment/naverpay-20261004.svg', width: 198, height: 66, heightClass: 'h-5' },
  },
  {
    id: 'tosspay', label: '토스페이', easyPay: '토스페이',
    logo: { src: '/images/payment/tosspay-20261004.png', width: 300, height: 91, heightClass: 'h-5' },
  },
  {
    id: 'payco', label: '페이코', easyPay: '페이코',
    logo: { src: '/images/payment/payco-20261004.svg', width: 1022, height: 265, heightClass: 'h-4' },
  },
  {
    id: 'applepay', label: '애플페이', easyPay: '애플페이', requiresApplePay: true,
    logo: { src: '/images/payment/applepay-20261004.svg', width: 512, height: 210, heightClass: 'h-5' },
  },
];

export const visiblePaymentChoices = (opts: { applePaySupported: boolean }): PaymentChoice[] =>
  PAYMENT_CHOICES.filter((c) => !c.requiresApplePay || opts.applePaySupported);

export const isTossPaymentChoice = (id: PaymentChoiceId): id is TossPaymentChoiceId => id !== 'bank_transfer';

export interface PaymentWindowParams {
  orderId: string;
  orderName: string;
  customerName: string;
  customerEmail?: string;
  amount: number;
  /** origin을 포함한 전체 주소. */
  successUrl: string;
  failUrl: string;
}

export interface TossCardPaymentRequest {
  method: 'CARD';
  amount: { currency: 'KRW'; value: number };
  orderId: string;
  orderName: string;
  customerName: string;
  customerEmail?: string;
  successUrl: string;
  failUrl: string;
  card?: { flowMode: 'DIRECT'; easyPay: EasyPayKo };
}

/**
 * `requestPayment` 인자를 만든다. 간편결제는 그 결제창으로 직행(DIRECT), 카드는 카드 결제창(기본).
 * 이메일은 값이 있을 때만 싣는다(빈 문자열을 보내면 토스가 형식 오류로 거절한다).
 */
export const buildTossPaymentRequest = (choice: TossPaymentChoiceId, params: PaymentWindowParams): TossCardPaymentRequest => {
  const def = PAYMENT_CHOICES.find((c) => c.id === choice);
  return {
    method: 'CARD',
    amount: { currency: 'KRW', value: params.amount },
    orderId: params.orderId,
    orderName: params.orderName,
    customerName: params.customerName,
    ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
    successUrl: params.successUrl,
    failUrl: params.failUrl,
    ...(def?.easyPay ? { card: { flowMode: 'DIRECT' as const, easyPay: def.easyPay } } : {}),
  };
};

/**
 * success 주소에 "API 개별 연동 키로 열었다"는 표식을 붙인다 — 승인 경로가 같은 쌍의 시크릿
 * (`TOSS_API_SECRET_KEY`)부터 쓰게 한다(lib/booking/toss.ts `tossKeyChannelFromQuery`).
 * 값은 lib/booking/toss.ts의 TOSS_KEY_CHANNEL_PARAM·API_VALUE와 같아야 한다(paymentChoices.test.ts가 대조).
 * 그 모듈은 서버 전용이라 여기서 import하지 않는다.
 */
export const withApiKeyChannel = (successUrl: string): string => {
  const url = new URL(successUrl);
  url.searchParams.set('tosskey', 'api');
  return url.toString();
};

/**
 * customerKey — 비회원 결제라도 결제마다 고유한 값이 필요하다. SAF는 주문번호를 쓴다
 * ("ANONYMOUS는 BrandPay 기반 간편결제를 통합 picker에서 숨길 수 있어 orderNo 사용").
 * 토스 형식(영문·숫자·`-_=.@`, 2~50자)에 맞지 않으면 ANONYMOUS로 둔다.
 */
export const paymentCustomerKey = (orderId: string, anonymous: string): string =>
  /^[A-Za-z0-9\-_=.@]{2,50}$/.test(orderId) ? orderId : anonymous;
