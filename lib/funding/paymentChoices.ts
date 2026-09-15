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
 * 2026-09-15 기준, 실제로 계약돼 위젯이 그려 주던 다섯 가지를 그대로 옮겼다. 네이버페이·
 * 애플페이는 그 목록에 없었다 — 계약이 되면 아래에 한 줄씩 더하면 된다(애플페이는
 * Safari·iOS에서만 동작하므로 노출 조건이 따로 필요하다).
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
  card?: { flowMode: 'DIRECT'; easyPay: '카카오페이' | '토스페이' | '페이코' };
}

export const FUNDING_PAYMENT_CHOICES: readonly FundingPaymentChoice[] = [
  { id: 'card', label: '신용·체크카드', hint: '국내 카드로 결제합니다.', tossMethod: 'CARD' },
  { id: 'transfer', label: '실시간 계좌이체', hint: '은행 계좌에서 바로 빠져나갑니다.', tossMethod: 'TRANSFER' },
  { id: 'kakaopay', label: '카카오페이', hint: '카카오톡에서 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '카카오페이' } },
  { id: 'tosspay', label: '토스페이', hint: '토스 앱에서 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '토스페이' } },
  { id: 'payco', label: '페이코', hint: '페이코 앱에서 결제합니다.', tossMethod: 'CARD', card: { flowMode: 'DIRECT', easyPay: '페이코' } },
];

export const DEFAULT_FUNDING_PAYMENT_CHOICE = FUNDING_PAYMENT_CHOICES[0].id;

export const findFundingPaymentChoice = (id: string): FundingPaymentChoice | undefined =>
  FUNDING_PAYMENT_CHOICES.find((c) => c.id === id);
