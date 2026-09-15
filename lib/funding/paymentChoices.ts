/**
 * 후원자가 폼에서 직접 고르는 결제수단.
 *
 * 예전에는 토스 **결제위젯**이 수단 목록을 대신 그렸다. 그래서 후원자가 「결제로 이동」을
 * 누르면 화면이 하나 더 뜨고, 거기서 수단을 고른 뒤 「결제하기」를 또 눌러야 했다 —
 * 클릭 두 번과 화면 하나가 더 있었다. 지금은 폼에서 고르고 한 번에 그 결제창으로 간다.
 *
 * **목록을 손으로 들고 있는 대가가 있다.** 위젯은 토스 쪽에서 수단이 늘면 알아서 따라가는데,
 * 이 목록은 따라가지 않는다. 대신 위젯 노출 설정과 무관하게 **계약된 수단을 직접 부를 수**
 * 있다. 새 수단을 붙이려면 토스 계약을 먼저 확인하고 여기 한 줄을 더한다.
 *
 * **계약 여부는 위젯 화면이 아니라 결제창 API로 확인한다.** 위젯에는 상점관리자의 별도
 * 노출 설정이 걸려 있어서, 계약이 되어 있어도 목록에 안 뜰 수 있다 — 실제로 네이버페이·
 * 애플페이가 그 경우였다. 확인 방법은 결제창 개설 요청(px-payment-parameters)에 그 수단을
 * 실어 보내는 것이다: 계약된 수단은 토큰을 돌려주고, 아니면 `INVALID_EASY_PAY`로 떨어진다.
 * 2026-09-15에 일곱 가지 전부 토큰이 나오는 것을 확인했다.
 */
export interface FundingPaymentChoice {
  id: string;
  label: string;
  /** 고르는 자리에서 바로 읽히는 한 줄. 무엇이 다른지 모르면 고를 수가 없다. */
  hint: string;
  /** 토스 SDK `requestPayment`의 method. */
  tossMethod: 'CARD' | 'TRANSFER';
  /**
   * 간편결제 자체 창으로 직행시키는 옵션. 없으면 통합 결제창이 뜬다.
   * `easyPay`는 **한국어 이름**이어야 한다 — 영문 enum('KAKAOPAY')은 토스가 거부한다.
   */
  card?: { flowMode: 'DIRECT'; easyPay: '카카오페이' | '토스페이' | '페이코' | '네이버페이' | '애플페이' };
  /**
   * true면 애플페이가 되는 환경에서만 보여 준다. 안드로이드·윈도우 후원자에게 띄우면
   * 고를 수는 있는데 결제창이 열리지 않는다.
   */
  requiresApplePay?: boolean;
}

export const FUNDING_PAYMENT_CHOICES: readonly FundingPaymentChoice[] = [
  { id: 'card', label: '신용·체크카드', hint: '국내 카드로 결제합니다.', tossMethod: 'CARD' },
  { id: 'transfer', label: '실시간 계좌이체', hint: '은행 계좌에서 바로 빠져나갑니다.', tossMethod: 'TRANSFER' },
  { id: 'kakaopay', label: '카카오페이', hint: '카카오톡에서 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '카카오페이' } },
  { id: 'tosspay', label: '토스페이', hint: '토스 앱에서 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '토스페이' } },
  { id: 'naverpay', label: '네이버페이', hint: '네이버 계정으로 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '네이버페이' } },
  { id: 'payco', label: '페이코', hint: '페이코 앱에서 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '페이코' } },
  { id: 'applepay', label: '애플페이', hint: 'Safari·iPhone에서 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '애플페이' }, requiresApplePay: true },
];

export const DEFAULT_FUNDING_PAYMENT_CHOICE = FUNDING_PAYMENT_CHOICES[0].id;

export const findFundingPaymentChoice = (id: string): FundingPaymentChoice | undefined =>
  FUNDING_PAYMENT_CHOICES.find((c) => c.id === id);
