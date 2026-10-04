/**
 * **계좌 입금(무통장) 주문**의 상태 판정·기한·차단 규칙 — 공연 티켓·연습실/녹음 예약·믹싱 주문 공용
 * (2026-10-04). 펀딩은 자기 표(`funding_pledges.payment_method`)로 가르므로 여기를 쓰지 않는다.
 * 계좌번호·안내 기한 일수·이메일 정규화는 lib/payments/bankAccount.ts가 정본이다.
 *
 * ## 상태 모델
 *
 * - 고객이 "계좌로 직접 입금"을 고르면 주문이 `orders.status = 'awaiting_deposit'`으로 **바로** 만들어진다.
 *   토스 홀드(`pending`)를 거치지 않는다. 그래서 토스 홀드 만료 경로(예약 `expireStaleOrders`, 공연
 *   `expireStaleShowOrders`, 자기 홀드 해제, lazy 만료)가 전부 이 주문을 건드리지 않는다 — 그 경로들은
 *   `status = 'pending'`만 본다. **자동 취소는 없다**(SAF2026: 버려진 중복 신청이 자동 만료되며 이미
 *   입금한 사람에게 "취소됨"이 갔다).
 * - 대기 중에도 **자원을 잡는다** — 공연은 티켓이 `held`이고 `show_orders.hold_expires_at`이 NULL(기한 없는
 *   보류, 좌석 집계가 그대로 점유로 센다), 예약은 `bookings.status = 'pending'`인 채 주문이 이 상태라
 *   겹침 검사(`lib/booking/service.ts` `occupiedBookingSql`)와 슬롯 조회가 점유로 센다.
 * - 운영자가 통장을 보고 **입금 확인**을 누르면 `paid`가 되고, 결제 행(`payments`)을
 *   `bankDepositPaymentKey(orderNo)`로 하나 남긴다 — 토스 결제와 같은 원장(매출장부·환불 기록·잔액 계산)을
 *   그대로 쓰기 위해서다. 그 키는 토스 키 모양이 아니라 토스 API에 닿지 않는다(환불 경로가 이 키를 보고
 *   토스를 부르지 않는다).
 * - **미입금 취소**(관리자)·**입금 전 신청 취소**(고객)는 `deposit_cancelled`로 닫고 같은 batch에서
 *   좌석(티켓 void)·시간대(예약 cancelled)를 푼다. 받은 돈이 없으니 메일이 없다.
 *
 * **이 모듈은 아무것도 import하지 않는다** — 결제 폼(클라이언트 번들)과 서버가 같은 판정을 쓴다.
 */

export const AWAITING_DEPOSIT = 'awaiting_deposit' as const;
export const DEPOSIT_CANCELLED = 'deposit_cancelled' as const;

/** 입금 확인 때 남기는 결제 행의 결제수단 표기(관리자 화면·매출장부에 그대로 보인다). */
export const BANK_DEPOSIT_PAYMENT_METHOD = '계좌 입금';

const PAYMENT_KEY_PREFIX = 'bank-deposit:';

/** 입금 확인 때 남기는 결제 행의 키 — 주문당 하나(`payments.payment_key` UNIQUE가 이중 확인을 막는다). */
export const bankDepositPaymentKey = (orderNo: string): string => `${PAYMENT_KEY_PREFIX}${orderNo}`;

/** 이 결제 행이 계좌 입금 확인으로 생긴 것인가 — 환불 경로가 토스를 부를지 가르는 유일한 판정. */
export const isBankDepositPayment = (payment: { paymentKey: string }): boolean =>
  payment.paymentKey.startsWith(PAYMENT_KEY_PREFIX);

export type BankDepositState = 'awaiting' | 'cancelled' | 'paid';

/**
 * 이 주문이 **온라인 계좌 입금**인가, 그렇다면 어느 단계인가 — 아니면 null(토스 결제·초대권·결제 없음).
 *
 * 관리자 수기 기록과 가른다: 공연 초대권은 결제 행 없이 `paid`로 만들어지고(`issueCompTickets`), 토스 결제는
 * 토스 키의 결제 행을 가진다. 고객이 폼에서 고른 계좌 입금만 `awaiting_deposit`/`deposit_cancelled`를 거치고
 * 확인되면 `bankDepositPaymentKey` 행을 갖는다. **인자는 둘 다 필수다** — 화면(SSR)과 서버(취소·환불 API)가
 * 같은 함수를 같은 인자로 부른다(PR #77: 한쪽이 판정에 쓰는 칸을 빼먹은 채 컴파일돼 화면과 서버가 갈렸다).
 */
export const bankDepositStateOf = (order: {
  status: string;
  payments: ReadonlyArray<{ paymentKey: string }>;
}): BankDepositState | null => {
  if (order.status === AWAITING_DEPOSIT) return 'awaiting';
  if (order.status === DEPOSIT_CANCELLED) return 'cancelled';
  return order.payments.some(isBankDepositPayment) ? 'paid' : null;
};

/**
 * 이용·공연 시작까지 이보다 짧게 남았으면 **계좌 입금을 받지 않는다** — 운영자가 통장을 보고 확인할
 * 시간이 없다. 입금을 확인하지 못한 채 시작 시각이 오면 고객은 확정 메일(티켓 QR·입장 안내) 없이 현장에
 * 오게 된다. 카드·간편결제는 그대로 열려 있다.
 */
export const BANK_DEPOSIT_MIN_LEAD_HOURS = 2;

export type BankDepositBlockCode = 'starts_too_soon' | 'show_bank_share_full' | 'day_bank_quota_full';

/**
 * 이 주문에 계좌 입금을 받을 수 있는가 — 막히면 이유, 되면 null. `startsAt`은 공연 회차·예약 이용 시작
 * (믹싱처럼 시작이 없으면 null). 결제 폼과 서버 검증이 **같은 인자로** 부른다.
 */
export const bankDepositBlockReason = (input: { startsAt: Date | null; now: Date }): BankDepositBlockCode | null => {
  if (input.startsAt === null) return null;
  return input.startsAt.getTime() - input.now.getTime() < BANK_DEPOSIT_MIN_LEAD_HOURS * 60 * 60 * 1000
    ? 'starts_too_soon'
    : null;
};

export const BANK_DEPOSIT_BLOCK_MESSAGES: Record<BankDepositBlockCode, string> = {
  starts_too_soon: `시작까지 ${BANK_DEPOSIT_MIN_LEAD_HOURS}시간이 남지 않아 계좌 입금은 받지 않습니다. 입금을 확인할 시간이 없어서입니다. 카드·간편결제로 해 주세요.`,
  show_bank_share_full: '이 회차는 입금을 기다리는 좌석이 많아 지금은 계좌 입금을 받지 않습니다. 카드·간편결제로 해 주세요.',
  day_bank_quota_full: '이날은 입금을 기다리는 예약이 많아 지금은 계좌 입금을 받지 않습니다. 카드·간편결제로 해 주세요.',
};

/**
 * 입금 안내 기한 — 신청 + 3일(`lib/payments/bankAccount.ts`의 `BANK_DEPOSIT_GUIDE_DAYS`), 단 시작 시각이
 * 그보다 빠르면 **시작 시각까지**. 안내용일 뿐이다(지나도 자동으로 취소하지 않는다). 저장하지 않고 매번
 * 계산한다 — 신청 시각과 시작 시각이 이미 저장돼 있고, 두 값이 그대로면 같은 기한이 나온다.
 */
export const bankDepositDeadlineOf = (input: { createdAt: Date; startsAt: Date | null; guideDays: number }): Date => {
  const byDays = new Date(input.createdAt.getTime() + input.guideDays * 24 * 60 * 60 * 1000);
  return input.startsAt && input.startsAt.getTime() < byDays.getTime() ? input.startsAt : byDays;
};

/**
 * 같은 이메일(정규화)로 동시에 열려 있을 수 있는 계좌 입금 대기 건수 — 공연·예약·믹싱 합산.
 * 근거: 한 사람이 실수로 두세 번 누르는 것까지는 받는다(펀딩 `MAX_OPEN_BANK_DEPOSITS_PER_EMAIL`과 같은 값).
 */
export const MAX_OPEN_BANK_DEPOSIT_ORDERS_PER_EMAIL = 3;
/**
 * 같은 IP에서 동시에 열려 있을 수 있는 계좌 입금 대기 건수 — 공연·예약·믹싱 합산. 이메일만 바꿔 가며 좌석·시간대를
 * 무기한 잡는 것을 막는다. 근거: 이메일 상한과 같은 3 — 한 집(같은 공유기)에서 가족 둘이 각각 신청해도 들어간다.
 * 공용 와이파이에서 막히는 사람은 카드·간편결제가 그대로 열려 있다.
 */
export const MAX_OPEN_BANK_DEPOSIT_ORDERS_PER_IP = 3;
/** IP 상한을 세려고 남기는 출처 기록(IP 해시 + 주문번호)의 보관 일수 — 처리방침 16항과 같은 값. */
export const BANK_DEPOSIT_ORIGIN_RETENTION_DAYS = 30;
/**
 * 공연 회차별로 계좌 입금 **대기**가 잡을 수 있는 좌석의 비율(정원 대비). 넘으면 그 회차는 카드·간편결제만 받는다.
 * 근거: 대기는 자동으로 풀리지 않아, 상한이 없으면 입금하지 않을 신청 몇 건이 매진을 만든다. 30%면 노년층
 * 관객의 계좌 입금은 충분히 받으면서(소규모 공연 50석 기준 15석) 나머지 70%는 늘 즉시 결제로 팔린다.
 */
export const SHOW_BANK_DEPOSIT_SEAT_SHARE = 0.3;
/**
 * 예약 — 같은 공간(녹음실·연습실 방 묶음)·같은 날(KST)의 계좌 입금 대기 상한. 넘으면 그날은 카드·간편결제만.
 * 근거: 하루에 확정 전 대기가 두 건이면 운영자가 하루 안에 확인할 수 있는 양이고, 그보다 많으면 그날 슬롯이
 * 입금 안 할 신청으로 비어 있게 된다.
 */
export const MAX_BANK_DEPOSIT_BOOKINGS_PER_RESOURCE_DAY = 2;
/** 같은 이메일(정규화)로 한 시간에 만들 수 있는 계좌 입금 신청 수 — 신청마다 안내 메일이 나간다. */
export const BANK_DEPOSIT_ORDERS_PER_EMAIL_PER_HOUR = 5;

/** 환불 계좌 표(`refund_accounts.order_kind`)에 적는 주문 종류. `orders.type` → 표의 값. */
export const refundAccountKindOf = (orderType: string): 'funding' | 'session' | 'mixing' | 'show' | null => {
  if (orderType === 'ticket') return 'show';
  if (orderType === 'session' || orderType === 'mixing' || orderType === 'funding') return orderType;
  return null;
};

/** 결제수단 선택값 — 결제 폼·생성 API가 쓰는 두 값. */
export type CheckoutPaymentMethod = 'toss' | 'bank_transfer';
export const isCheckoutPaymentMethod = (v: unknown): v is CheckoutPaymentMethod => v === 'toss' || v === 'bank_transfer';
