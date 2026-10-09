import type { ConfirmOutcome } from './confirm';

/**
 * 토스 결제창 실패 코드 → 우리가 쓴 문구. 쿼리의 message는 읽지 않는다 — 실패 URL은 누구나
 * 손으로 칠 수 있어 공격자가 고른 문장이 우리 레이아웃에 뜨는 경로가 되기 때문이다
 * (pages/[locale]/booking/fail.tsx와 같은 표·같은 이유. 그쪽은 모듈 내부 상수라 복제한다).
 */
export const SHOW_FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨어요.',
  PAY_PROCESS_ABORTED: '결제가 완료되기 전에 창이 닫혔어요.',
  USER_CANCEL: '결제를 취소하셨어요.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했어요. 다른 카드나 결제수단으로 시도해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지된 카드예요. 다른 결제수단으로 시도해 주세요.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '하루 결제 가능 횟수를 초과했어요. 내일 다시 시도하거나 다른 결제수단을 이용해 주세요.',
  EXCEED_MAX_PAYMENT_AMOUNT: '결제 한도를 초과했어요. 카드사에 문의하거나 다른 결제수단을 이용해 주세요.',
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: '이 카드로는 선택하신 할부 개월 수를 쓸 수 없어요.',
  INVALID_CARD_NUMBER: '카드번호를 다시 확인해 주세요.',
  NOT_AVAILABLE_BANK: '은행 서비스 시간이 아니에요. 잠시 후 다시 시도해 주세요.',
};

export const SHOW_FAIL_GENERIC_MESSAGE = '결제 진행 중 문제가 발생했어요.';

/** 화면에 그대로 보여도 되는 티켓 주문번호(초대권 C 형식은 결제가 없어 제외). */
export const SHOW_PAYMENT_ORDER_NO_PATTERN = /^TKT-\d{8}-[0-9A-F]{8}$/;
export const SHOW_FAIL_CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;
export const SHOW_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/i;

/** confirmShowOrder 실패 결과 → 화면 문구. 토스 원문은 쓰지 않는다. */
export function confirmFailureMessage(outcome: Exclude<ConfirmOutcome, { status: 'confirmed' | 'already_confirmed' }>): string {
  switch (outcome.status) {
    case 'declined':
      return '결제가 승인되지 않았어요. 카드사 확인 후 다시 시도해 주세요.';
    case 'sold_out':
      return '결제 직후 잔여석이 소진되어 티켓을 발권하지 못했어요. 결제는 자동으로 취소돼요(카드사에 따라 영업일 기준 수일 걸릴 수 있어요).';
    case 'auto_cancel_conflict':
      return '이 주문은 자동으로 환불 처리됐어요. 다시 예매해 주세요.';
    case 'amount_mismatch':
      return '결제 금액이 주문과 일치하지 않아 확정하지 못했어요.';
    case 'error':
      if (outcome.code === 'toss_unresolved' || outcome.code === 'recording_failed')
        return '결제 승인 결과를 확인하는 중이에요. 결제가 이뤄졌다면 잠시 뒤 자동으로 확정되고, 확정되지 않으면 자동으로 취소돼요.';
      if (outcome.code === 'invalid_status') return '이미 만료되었거나 처리할 수 없는 주문이에요. 다시 예매해 주세요.';
      return '결제를 확정하지 못했어요.';
  }
}

/** 영어 화면(/en/shows/fail)용 — SHOW_FAIL_MESSAGES와 같은 코드·같은 내용. */
export const SHOW_FAIL_MESSAGES_EN: Record<string, string> = {
  PAY_PROCESS_CANCELED: 'You cancelled the payment.',
  PAY_PROCESS_ABORTED: 'The payment window was closed before payment was completed.',
  USER_CANCEL: 'You cancelled the payment.',
  REJECT_CARD_COMPANY: 'The card company declined the payment. Please try another card or payment method.',
  INVALID_CARD_EXPIRATION: 'Please check the card expiry date.',
  INVALID_STOPPED_CARD: 'This card is suspended. Please try another payment method.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: 'You have reached the daily payment limit. Please try again tomorrow or use another payment method.',
  EXCEED_MAX_PAYMENT_AMOUNT: 'The payment exceeds your limit. Please contact your card company or use another payment method.',
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: 'This card does not support the installment plan you chose.',
  INVALID_CARD_NUMBER: 'Please check the card number.',
  NOT_AVAILABLE_BANK: 'The bank service is not available right now. Please try again later.',
};

export const SHOW_FAIL_GENERIC_MESSAGE_EN = 'Something went wrong during payment.';

/** confirmFailureMessage()의 영어판 — 같은 분기·같은 내용. */
export function confirmFailureMessageEn(outcome: Exclude<ConfirmOutcome, { status: 'confirmed' | 'already_confirmed' }>): string {
  switch (outcome.status) {
    case 'declined':
      return 'The payment was not approved. Please check with your card company and try again.';
    case 'sold_out':
      return 'Seats sold out right after your payment, so we could not issue your ticket. The payment will be cancelled automatically (it may take a few business days depending on your card company).';
    case 'auto_cancel_conflict':
      return 'This order was refunded automatically. Please book again.';
    case 'amount_mismatch':
      return 'The payment amount did not match the order, so we could not confirm it.';
    case 'error':
      if (outcome.code === 'toss_unresolved' || outcome.code === 'recording_failed')
        return 'We are still checking the payment result. If you were charged, the order will be confirmed automatically shortly; if not, it will be cancelled automatically.';
      if (outcome.code === 'invalid_status') return 'This order has expired or cannot be processed. Please book again.';
      return 'We could not confirm the payment.';
  }
}
