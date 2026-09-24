import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, notExists, or, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  availabilityBlocks,
  billingKeys,
  bookings,
  orders,
  payments,
  refunds,
  subscriptionPayments,
  subscriptions,
  workOrders,
} from '../../db/schema';

/**
 * 주문·구독에 남는 고객 개인정보의 파기.
 *
 * 개인정보 보호법 제21조①은 보유기간이 지나거나 처리 목적을 달성해 **불필요하게 되었을 때**
 * 지체 없이 파기하라고 하고, 단서의 예외는 "다른 법령에 따라 보존하여야 하는 경우"뿐이다.
 * `orders`·`subscriptions`에는 그 파기 경로가 없어 전 주문유형(session·mixing·funding·
 * subscription)의 이름·연락처가 기한 없이 남아 있었다 — 이 파일이 그 경로다.
 *
 * **보존 근거로 삼는 법령은 전자상거래 등에서의 소비자보호에 관한 법률**이고,
 * 처리방침이 고지하는 값(`lib/funding/policy.ts`의 `PRIVACY_LEGAL_RETENTION_TEXT`)과 같다 —
 * 계약 또는 청약철회 등에 관한 기록·대금결제 및 재화등의 공급에 관한 기록은 5년,
 * 소비자의 불만 또는 분쟁처리에 관한 기록은 3년.
 *
 * **그 5년은 보존 *의무*이지 보존 *항목*을 넓히는 근거가 아니다.** 그래서 이 파일은 한
 * 테이블을 한 번에 비우지 않고 컬럼을 갈라 각자의 기준으로 파기한다. 판정은 각 함수의
 * 주석에 적혀 있다.
 *
 * **기존 파기와 섞지 않는다.** 후원 배송지(`lib/funding/retention.ts`,
 * 리워드 전달 +1년/법정 5년)·개설자 주민등록번호(같은 파일, 원천징수 지급 +5년)·
 * 접속기록(`lib/privacy/accessLog.ts`, 2년)·계약서(`lib/contracts/retention.ts`,
 * 계약 종료 +3년)는 대상도 기산점도 기간도 다르다.
 */

/**
 * 파기 후 자리를 채우는 표시. `lib/contracts/retention.ts`가 쓰는 문자열과 같다.
 *
 * 빈 문자열로 두면 "처음부터 없었다"와 "파기했다"를 구분할 수 없고, 무엇보다 아래 대상
 * 컬럼(`orders.customer_*`·`subscriptions.customer_*`)은 **스키마가 NOT NULL**이라
 * NULL로 비울 수 없다(`db/schema.ts`). 표식이 곧 멱등 판정의 근거이기도 하다 — 이미
 * 표식이 들어간 행은 다음 실행의 WHERE에 걸리지 않는다.
 */
export const PURGED_MARK = '(개인정보 파기됨)';

/**
 * 이 칸에 들어 있는 것이 파기 표식인가.
 *
 * **파기는 값을 지우는 것이지 값을 채우는 것이 아니다.** 그런데 NOT NULL 컬럼은 비울 수
 * 없어 표식이 들어가고, 그 순간부터 표식은 읽는 쪽 눈에 **평범한 문자열**로 보인다 —
 * 이름 자리에 있으면 사람 이름처럼, 이메일 자리에 있으면 주소처럼, 신원 키 안에 있으면
 * "같은 사람"처럼 읽힌다. 그 오독을 막는 자리마다 문자열을 다시 적지 않도록 판정을 여기
 * 하나로 모은다.
 *
 * 이미 이 판정이 필요한 곳: 공개 후원자 명단과 후원 인원 집계(`lib/funding/service.ts`),
 * 발송 불가 주소(`lib/email/resend.ts`), 계약 서명 완료 화면
 * (`pages/[locale]/contracts/[id]/complete.tsx`).
 */
export const isPurgedValue = (value: string | null | undefined): boolean => value === PURGED_MARK;

/**
 * 전자상거래법이 정한 계약·청약철회 기록과 대금결제·재화등의 공급 기록의 보존 기간.
 * `lib/funding/retention.ts`의 `LEGAL_RETENTION_YEARS`와 같은 값이고 같은 근거다.
 */
export const ORDER_LEGAL_RETENTION_YEARS = 5;

/**
 * 전자상거래법이 정한 소비자의 불만 또는 분쟁처리에 관한 기록의 보존 기간.
 */
export const DISPUTE_RETENTION_YEARS = 3;

/**
 * 결제 실패 사유 원문(`orders.payment_fail_message`)을 붙들어 두는 기간.
 *
 * **법이 정한 것이 아니라 운영 판단이다.** 결제 실패는 계약이 성립하지 않은 사건이라
 * 전자상거래법이 5년 보존을 요구하는 "계약 또는 청약철회 등에 관한 기록"도 "대금결제 및
 * 재화등의 공급에 관한 기록"도 아니다 — 받은 대금도, 공급한 재화도, 성립한 계약도 없다.
 * 그 컬럼이 생긴 이유도 법정 보존이 아니라 문의 대응이다(`db/schema.ts`의 주석: 후원자가
 * 세 번 실패하고 떠났는데 사유가 우리 쪽에 한 글자도 남지 않았다).
 *
 * 그 목적은 실패 직후에 대부분 끝나지만, 카드사 쪽 민원이 뒤늦게 오는 경우를 감안해 1년을
 * 둔다. 값을 바꾸려면 이 상수 하나만 고치면 되고, 함께 고쳐야 하는 문서는 처리방침의
 * 파기 항이다.
 */
export const PAYMENT_FAIL_MESSAGE_RETENTION_YEARS = 1;

export interface OrderPurgeResult {
  purged: number;
}

const yearsAgo = (now: Date, years: number): Date => {
  const boundary = new Date(now);
  boundary.setFullYear(boundary.getFullYear() - years);
  return boundary;
};

const rows = (result: { rowsAffected?: number }): OrderPurgeResult => ({
  purged: Number(result.rowsAffected ?? 0),
});

/**
 * 법정 보존 기간이 지난 주문의 고객 이름·연락처·이메일을 파기한다.
 *
 * **행은 지우지 않는다.** `orders`에는 `payments`·`refunds`·`bookings`·`work_orders`·
 * `funding_pledges`·`subscription_payments`가 외래키로 매달려 있고, 매출 집계와 정산이
 * 그 행의 금액·상태를 읽는다. 지우는 것은 사람을 식별하는 세 컬럼뿐이다.
 *
 * ## 판정
 *
 * - **이 세 컬럼은 법정 기록이다.** 전자상거래법이 5년 보존을 요구하는 "계약 또는 청약철회
 *   등에 관한 기록"은 누구와 맺은 계약인지를 포함해야 성립한다. 그래서 5년 전에는 파기하지
 *   않는다 — 제21조① 단서가 말하는 "다른 법령에 따라 보존하여야 하는 경우"다.
 * - **기산점은 주문 생성일과 최종 갱신일 둘 다.** 생성일만 보면 결제 4년 뒤에 환불된
 *   주문의 청약철회 기록이 그 1년 뒤에 지워진다. `updated_at`은 환불·취소가 갱신하므로
 *   (`lib/funding/cancel.ts`의 `UPDATE orders SET status = 'refunded', updated_at = ...`)
 *   둘 다 5년이 지났을 것을 요구하면 뒤늦은 사건까지 기산점에 들어온다.
 *
 * ## 여기서 일부러 하지 않는 것
 *
 * - **`notification_error`는 건드리지 않는다.** 자유 서술로 보이지만 실제로 들어가는 값은
 *   `customer:API_ERROR` 같은 코드거나 확정 절차의 센티널이고(`lib/booking/confirm.ts`),
 *   `lib/ops/healthCheck.ts`가 그 값의 유무로 미발송 주문을 찾는다. 개인정보가 아니며
 *   지우면 운영 점검이 깨진다.
 * - **`manage_token`은 건드리지 않는다.** 개인을 식별하는 값이 아니라 접근 수단이고,
 *   이 함수가 돈 뒤에는 그 링크로 열리는 화면에 표식만 남는다.
 * - **`payment_fail_message`는 기간이 달라 따로 판다**(아래 함수).
 *
 * 멱등: 세 컬럼이 전부 표식이면 WHERE에 걸리지 않는다. 별도의 `purged_at` 컬럼을 두지
 * 않는 이유는 후원 쪽(`lib/funding/retention.ts`)과 같다 — 마이그레이션을 늘리지 않고도
 * "파기할 것이 남아 있는가"를 WHERE에 그대로 쓸 수 있다.
 */
export const purgeExpiredOrderCustomerData = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, ORDER_LEGAL_RETENTION_YEARS);

  const result = await getDb()
    .update(orders)
    // `updated_at`은 갱신하지 않는다 — 그 값이 이 파기의 기산점이자 구독 쪽 해지 사유
    // 파기의 대체 기산점이라, 여기서 지금으로 되감으면 다른 파기가 그만큼 밀린다
    // (`lib/funding/retention.ts`도 같은 이유로 건드리지 않는다). 멱등은 표식이 맡는다.
    .set({
      customerName: PURGED_MARK,
      customerPhone: PURGED_MARK,
      customerEmail: PURGED_MARK,
    })
    .where(
      and(
        lt(orders.createdAt, boundary),
        lt(orders.updatedAt, boundary),
        or(
          ne(orders.customerName, PURGED_MARK),
          ne(orders.customerPhone, PURGED_MARK),
          ne(orders.customerEmail, PURGED_MARK),
        ),
      ),
    );

  return rows(result);
};

/**
 * 보관 기간이 지난 결제 실패 사유 원문을 파기한다.
 *
 * 대상은 `orders.payment_fail_message` 하나다. 기산점은 실패 시각(`payment_failed_at`),
 * 없으면 주문 생성일. 기간은 `PAYMENT_FAIL_MESSAGE_RETENTION_YEARS`이고 **그 값이 법정
 * 보존이 아닌 이유는 그 상수의 주석에 있다.**
 *
 * **`payment_fail_code`는 남긴다.** 토스가 정한 코드값(`REJECT_CARD_COMPANY` 따위)이라
 * 개인을 식별하지 않고, 실패가 몰리는 원인을 사후에 세는 데 쓸 수 있다. 자유 문장이라
 * 무엇이 들어 있을지 알 수 없는 쪽은 `message`다.
 *
 * **`updated_at`을 갱신하지 않는다.** 그 값이 위 5년 파기의 기산점 가운데 하나라, 여기서
 * 건드리면 아직 5년이 안 된 주문의 시계를 지금으로 되감아 고객 정보 파기가 그만큼 밀린다.
 */
export const purgeExpiredPaymentFailMessages = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, PAYMENT_FAIL_MESSAGE_RETENTION_YEARS);

  const result = await getDb()
    .update(orders)
    .set({ paymentFailMessage: null })
    .where(
      and(
        isNotNull(orders.paymentFailMessage),
        or(
          and(isNotNull(orders.paymentFailedAt), lt(orders.paymentFailedAt, boundary)),
          and(isNull(orders.paymentFailedAt), lt(orders.createdAt, boundary)),
        ),
      ),
    );

  return rows(result);
};

/**
 * 보관 기간이 지난 회차 결제 실패 사유 원문을 파기한다.
 *
 * 대상은 `subscription_payments.toss_message` 하나이고, **`orders.payment_fail_message`와
 * 같은 값의 같은 성질이다** — 토스가 거절 사유로 준 자유 문장이다
 * (`lib/billing/service.ts`가 회차 결제 실패 때 `toss.message`를 그대로 넣는다). 그래서
 * 같은 상수(`PAYMENT_FAIL_MESSAGE_RETENTION_YEARS`)를 쓴다: 승인되지 않은 회차는 계약도
 * 대금결제도 성립하지 않은 사건이라 전자상거래법이 5년 보존을 요구하는 기록이 아니다.
 *
 * **성공한 회차는 이미 비어 있다** — 승인되면 같은 파일이 `toss_message`를 NULL로 지운다.
 * 즉 여기 남아 있는 것은 실패로 끝난 회차뿐이고, 그 행을 지우는 코드는 어디에도 없어
 * 관리자 화면(`pages/admin/subscriptions/[id].tsx`)에 기한 없이 노출되고 있었다.
 *
 * **`toss_code`는 남긴다.** 토스가 정한 코드값이라 개인을 식별하지 않고 실패 원인을 사후에
 * 세는 데 쓸 수 있다 — `payment_fail_code`와 같은 판단이다.
 *
 * 기산점은 그 회차를 시도한 시각(`attempted_at`). NOT NULL이라 대체 기산점이 필요 없다.
 */
export const purgeExpiredSubscriptionPaymentMessages = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, PAYMENT_FAIL_MESSAGE_RETENTION_YEARS);

  const result = await getDb()
    .update(subscriptionPayments)
    .set({ tossMessage: null })
    .where(
      and(
        isNotNull(subscriptionPayments.tossMessage),
        lt(subscriptionPayments.attemptedAt, boundary),
      ),
    );

  return rows(result);
};

/**
 * 끝난 구독의 고객 이름·연락처·이메일을 파기한다.
 *
 * ## 판정
 *
 * - **법정 기록이다.** 정기결제도 계약이고 회차마다 대금결제가 일어난다 — 주문 쪽과 같은
 *   이유로 5년이다.
 * - **기산점은 이용이 실제로 끝난 날(`ends_at`).** `cancelled`는 "해지 예약"이라 이미
 *   결제한 달의 끝까지는 이용 중이고(`db/schema.ts`), 상태가 `ended`로 넘어가는 것은
 *   `lib/billing/service.ts`의 `endExpiredSubscriptions`가 `ends_at`이 지난 뒤에 하는
 *   일이다. 그래서 **`ended`가 아닌 구독은 어떤 경우에도 파기하지 않는다** — 살아 있는
 *   구독의 고객 정보를 지우면 다음 회차 청구와 실패 안내가 불가능해진다.
 * - `ends_at`이 없는 예외적인 행은 최종 갱신일(`updated_at`)로 대신 센다. 여기에 더해
 *   생성일도 5년이 지났을 것을 요구한다 — 날짜를 잘못 적어 만든 구독이 만들자마자 파기
 *   대상이 되는 것을 막는다(계약서 쪽 `lib/contracts/retention.ts`와 같은 이유).
 *
 * `customer_key`·`manage_token`·`billing_key_id`는 대상이 아니다. 개인을 식별하는 값이
 * 아니라 토스·링크·카드 쪽 식별자이고, 회차 결제 기록이 그 값으로 매달려 있다.
 */
export const purgeExpiredSubscriptionCustomerData = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, ORDER_LEGAL_RETENTION_YEARS);

  const result = await getDb()
    .update(subscriptions)
    // `updated_at`을 갱신하지 않는 이유는 주문 쪽과 같다. 특히 여기서는 아래 해지 사유
    // 파기가 `cancelled_at`이 없는 행에 한해 `updated_at`을 기산점으로 쓰므로, 갱신하면
    // 그 시계가 3년 되감긴다 — 크론이 이 함수를 먼저 돌리기 때문에 같은 회차에 일어난다.
    .set({
      customerName: PURGED_MARK,
      customerPhone: PURGED_MARK,
      customerEmail: PURGED_MARK,
    })
    .where(
      and(
        eq(subscriptions.status, 'ended'),
        or(
          and(isNotNull(subscriptions.endsAt), lt(subscriptions.endsAt, boundary)),
          and(isNull(subscriptions.endsAt), lt(subscriptions.updatedAt, boundary)),
        ),
        lt(subscriptions.createdAt, boundary),
        or(
          ne(subscriptions.customerName, PURGED_MARK),
          ne(subscriptions.customerPhone, PURGED_MARK),
          ne(subscriptions.customerEmail, PURGED_MARK),
        ),
      ),
    );

  return rows(result);
};

/**
 * 끝난 구독의 후원자 명단 표시 이름을 파기한다.
 *
 * ## 판정
 *
 * - **법정 기록이 아니다.** `display_name`은 아티스트 구독(`kind = 'artist-support'`)에서
 *   후원자 명단에 실을 이름이다(`db/schema.ts`). 계약 당사자를 특정하는 것은
 *   `customer_name`이고, 이 컬럼은 공개 화면에 무엇으로 불리고 싶은지를 적는 표시용
 *   값이라 계약·결제 기록의 구성 요소가 아니다.
 * - **목적은 구독이 끝나는 순간 사라진다.** `lib/artistSupport/supporters.ts`의
 *   `listPublicSupporters`는 `SUPPORTING_STATUSES`(active·past_due·cancelled)만 싣고
 *   `ended`는 명단에서 뺀다 — 즉 `ended`가 된 뒤의 표시 이름은 어느 공개 화면에도
 *   쓰이지 않는다. 제21조①이 말하는 "불필요하게 되었을 때"가 그 상태다.
 * - 그래서 기산점만 있고 추가 기간이 없다. 크론이 월 1회 도므로 실제 파기는 종료 후
 *   한 달 안에 일어난다.
 *
 * `display_consent`(동의 여부)는 남긴다 — 참/거짓 한 칸이라 개인을 식별하지 않고,
 * "명단 공개에 동의를 받았다"는 사실 자체가 동의 처리의 근거 기록이다.
 *
 * `updated_at`을 갱신하지 않는 이유는 위 결제 실패 사유 파기와 같다 — 그 값이 고객 정보
 * 5년 파기의 대체 기산점이다.
 *
 * 다른 파기 함수와 달리 기준 시각 인자를 받지 않는다. 기간이 아니라 상태 하나로만
 * 판정하기 때문이다.
 */
export const purgeEndedSubscriptionDisplayNames = async (): Promise<OrderPurgeResult> => {
  const result = await getDb()
    .update(subscriptions)
    .set({ displayName: null })
    .where(and(eq(subscriptions.status, 'ended'), isNotNull(subscriptions.displayName)));

  return rows(result);
};

/**
 * 보관 기간이 지난 구독 해지 사유를 파기한다.
 *
 * ## 판정
 *
 * - **계약·결제 기록은 아니다.** 해지가 있었다는 사실과 그 시점은 `status`·`cancelled_at`·
 *   `ends_at`이 기록한다. `cancel_reason`은 그 위에 자유롭게 적히는 문장이다.
 * - **다만 소비자의 불만에 해당할 수 있다.** 해지 사유에 서비스에 대한 불만이 적히면
 *   전자상거래법이 3년 보존을 요구하는 "소비자의 불만 또는 분쟁처리에 관한 기록"이 된다.
 *   무엇이 적혀 있는지 미리 알 수 없으므로 전부 3년으로 본다 — 고객 정보 5년과 섞지
 *   않는 이유가 이것이다. 자유 입력이라 이름·연락처 조각이 섞일 수 있다는 점은
 *   계약서 쪽 `termination_reason`과 같고, 그쪽도 같은 이유로 파기 대상이다.
 * - **기산점은 해지 시각(`cancelled_at`)**, 없으면 최종 갱신일. 그리고 고객 정보 파기와
 *   마찬가지로 `ended`가 아닌 구독은 대상이 아니다 — 해지 예약 상태에서 사유를 지우면
 *   아직 진행 중인 해지 건의 경위를 설명할 수 없다.
 */
export const purgeExpiredSubscriptionCancelReasons = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, DISPUTE_RETENTION_YEARS);

  const result = await getDb()
    .update(subscriptions)
    .set({ cancelReason: null })
    .where(
      and(
        eq(subscriptions.status, 'ended'),
        isNotNull(subscriptions.cancelReason),
        or(
          and(isNotNull(subscriptions.cancelledAt), lt(subscriptions.cancelledAt, boundary)),
          and(isNull(subscriptions.cancelledAt), lt(subscriptions.updatedAt, boundary)),
        ),
        lt(subscriptions.createdAt, boundary),
      ),
    );

  return rows(result);
};

/**
 * 끝나지 못한 채 방치된 구독을 "방치"로 판정하는 기간.
 *
 * **법이 정한 것이 아니라 운영 판단이다.** 아래 `closeDormantSubscriptions`의 대상은
 * `pending_card`(카드 등록 전)와 `paused`(재시도 한도 소진 **또는 운영자가 청구를 멈춰 둔 것**)
 * 인데, 이 둘은 **어떤 코드도 `ended`로 넘기지 않는다** — 유일한 전이 경로인 `lib/billing/service.ts`의
 * `endExpiredSubscriptions`가 `status = 'cancelled' AND ends_at <= now`에서만 돈다.
 * 즉 고객이 카드 등록 링크를 열지 않고 사라지거나 카드가 계속 거절되어 멈춘 구독은
 * 영영 `ended`가 되지 않고, `ended`를 요구하는 구독 파기 셋이 전부 비켜 가 이름·연락처·
 * 이메일이 기한 없이 남는다. 제21조①이 말하는 "불필요하게 되었을 때"가 그 상태다.
 *
 * 1년으로 잡은 이유는 되돌아올 여지다. 카드를 다시 등록하면 `pending_card`·`paused` 모두
 * 그 자리에서 이어지므로(`SETUP_ALLOWED_STATUSES`), 몇 달 쉬었다 돌아오는 고객을
 * 끊지 않을 만큼은 둬야 한다. 값을 바꾸려면 이 상수 하나만 고치면 되고, 함께 고쳐야 하는
 * 문서는 처리방침의 파기 항이다.
 */
export const SUBSCRIPTION_DORMANCY_YEARS = 1;

/**
 * 방치 종료가 닥치기 며칠 전부터 운영자에게 알릴 것인가 — 운영자 정지(`paused_reason =
 * 'operator'`)와 사유를 모르는 정지에만 해당한다(`lib/ops/healthCheck.ts`).
 *
 * **30일로 잡은 근거는 파기 크론의 주기다.** `/api/cron/purge-orders`는 매달 3일에 한 번
 * 돈다(`vercel.json`). 즉 어떤 구독이 오늘 방치 기준선을 넘어도 실제로 `ended`가 되는 것은
 * 다음 달 3일이고, 30일 앞서 알리면 **그 다음 파기 실행이 오기 전에 반드시 한 번은**
 * 경보를 본다. 헬스체크는 매일 도는데(`0 23 * * *`) 파기는 한 달에 한 번이라, 이보다 짧게
 * 잡으면 경보와 파기 사이에 운영자가 자리를 비운 주말 하나로 구독이 닫힐 수 있다.
 * 월 단위 상품(매월 청구)에서 한 청구 주기는 운영자가 "이 구독을 계속 세워 둘 것인가"를
 * 판단하는 최소 단위이기도 하다.
 *
 * 더 길게 잡지 않는 이유: 경보는 매일 다시 뜨므로 앞당길수록 같은 줄이 오래 떠 있고,
 * 늘 떠 있는 항목은 읽히지 않는다(이 파일이 아니라 `lib/ops/healthCheck.ts` 머리말의 판단).
 */
export const SUBSCRIPTION_DORMANCY_WARNING_DAYS = 30;

/**
 * 방치 판정의 기준선 — 이 시각보다 오래된 구독이 대상이다.
 *
 * `closeDormantSubscriptions`와 헬스체크 경보가 **같은 식**을 써야 "닫히기 전에 알린다"가
 * 성립한다. 따로 계산하면 한쪽만 바뀌는 날 경보가 파기보다 늦어지고, 그때는 알림 없이
 * 닫히던 예전 상태로 그대로 돌아간다.
 */
export const dormancyBoundary = (now: Date): Date => yearsAgo(now, SUBSCRIPTION_DORMANCY_YEARS);

/** 경보 기준선 — 앞으로 `SUBSCRIPTION_DORMANCY_WARNING_DAYS`일 안에 방치가 될 구독까지 잡는다. */
export const dormancyWarningBoundary = (now: Date): Date =>
  dormancyBoundary(new Date(now.getTime() + SUBSCRIPTION_DORMANCY_WARNING_DAYS * 24 * 60 * 60 * 1000));

/**
 * "이 기준선까지 아무 활동이 없었다" — 방치 판정의 **활동 조건 전부**(상태는 부르는 쪽이 건다).
 *
 * 파기(`closeDormantSubscriptions`)와 종료 경보(`lib/ops/healthCheck.ts`)가 **같은 식**을
 * 나눠 쓴다. 기준선 날짜만 같고 조건식이 갈라져 있으면, `updated_at`을 올리지 않는 전이가
 * 하나 생기는 날 경보와 파기의 집합이 어긋난다 — 파기는 닫는데 경보는 안 뜨거나(경고 없는
 * 종료), 경보는 뜨는데 파기가 안 돼 **운영자가 끌 수 없는 매일 경보**가 된다.
 *
 * 조건 넷의 이유는 `closeDormantSubscriptions`의 "방치를 무엇으로 봤는가" 절에 있다.
 */
export const dormantActivityCondition = (boundary: Date) => {
  const db = getDb();
  return and(
    lt(subscriptions.createdAt, boundary),
    lt(subscriptions.updatedAt, boundary),
    notExists(
      db
        .select({ one: sql`1` })
        .from(subscriptionPayments)
        .where(
          and(
            eq(subscriptionPayments.subscriptionId, subscriptions.id),
            gte(subscriptionPayments.attemptedAt, boundary),
          ),
        ),
    ),
    notExists(
      db
        .select({ one: sql`1` })
        .from(billingKeys)
        .where(
          and(
            eq(billingKeys.subscriptionId, subscriptions.id),
            or(
              gte(billingKeys.issuedAt, boundary),
              and(isNotNull(billingKeys.revokedAt), gte(billingKeys.revokedAt, boundary)),
            ),
          ),
        ),
    ),
  );
};

/**
 * 방치 판정의 대상 상태.
 *
 * **`active`·`past_due`·`cancelled`는 대상이 아니다.** `active`는 청구가 돌고 있고,
 * `past_due`는 재시도 대기 중이라 둘 다 살아 있다. `cancelled`는 해지 예약이라
 * `endExpiredSubscriptions`가 `ends_at`이 지나면 `ended`로 넘긴다 — 이미 경로가 있는 것을
 * 여기서 또 건드리면 두 개의 종료 규칙이 생긴다. `ended`는 이미 끝났다.
 *
 * ## `paused` 두 가지를 여기서 갈라 다루지 **않는** 이유
 *
 * `paused`에는 성질이 정반대인 둘이 들어 있다. 재시도 한도를 소진해 시스템이 세운 것과,
 * 카드가 멀쩡한 정상 구독의 청구만 운영자가 멈춘 것이다(`pauseSubscription`,
 * `lib/billing/service.ts`). 이제 `subscriptions.paused_reason`이 둘을 가른다
 * (`payment_failed` / `operator`, 컬럼 도입 전 행은 NULL).
 *
 * **그래도 이 함수는 사유를 보지 않고 똑같이 닫는다.** 여기서 운영자 정지를 빼면 그 구독의
 * 이름·연락처·이메일이 기한 없이 남아, 이 파일이 닫으려던 제21조① 위반으로 그대로 되돌아간다.
 * "운영자가 세워 뒀다"는 것은 **보존의 법적 근거가 아니다** — 단서의 예외는 "다른 법령에
 * 따라 보존하여야 하는 경우"뿐이고, 결제 이력이 있는 구독은 이미 그 5년을 `ended` 이후의
 * 파기들이 따로 센다. 사유에 따라 기간을 달리 잡는 것도 같은 이유로 하지 않았다 — 근거가
 * 되는 법령이 그쪽만 다르게 말하지 않는다.
 *
 * 대신 **닫히기 전에 운영자가 알게 한다.** `lib/ops/healthCheck.ts`의 매일 점검이
 * `paused_reason`이 `operator`이거나 NULL인 구독을 `SUBSCRIPTION_DORMANCY_WARNING_DAYS`일
 * 앞서 보고한다. 운영자가 재개하거나 해지하면 `updated_at`이 올라 방치 판정에서 빠진다.
 * 알림을 못 보고 지나 `ended`가 되면 여전히 되돌릴 길은 없다 — `resumeSubscription`은
 * `paused`만 받고 관리자 '결제' 버튼도 `ended`를 제외한다. 그래서 경보가 유일한 방어다.
 *
 * NULL(사유 불명)을 운영자 쪽에 붙이는 것은 틀렸을 때의 대가가 한쪽으로만 크기 때문이다 —
 * 자세한 판정은 `db/schema.ts`의 `pausedReason` 주석에 있다.
 *
 * 처리방침 18항 ⑬은 이 사실대로 "결제 실패로 정지되었거나 운영자가 청구를 멈춰 둔
 * 정기결제"라고 적는다 — 둘 다 대상이라는 이 절의 판정과 어긋나지 않는다.
 */
const DORMANT_STATUSES = ['pending_card', 'paused'] as const;

export interface DormantSubscriptionResult {
  /** 결제 이력이 없어 이번에 이름·연락처·이메일을 파기한 구독 수. */
  purged: number;
  /** 방치로 판정해 `ended`로 넘긴 구독 수(파기한 것과 5년 대기로 넘긴 것을 합한 수). */
  ended: number;
}

/**
 * 끝나지 못한 채 방치된 구독을 닫고, 계약이 성립하지 않은 것은 그 자리에서 파기한다.
 *
 * ## "방치"를 무엇으로 봤는가
 *
 * **마지막 활동으로부터 `SUBSCRIPTION_DORMANCY_YEARS`년이 지났고, 그동안 어떤 활동의
 * 증거도 없는 것.** 구체적으로 네 가지를 전부 요구한다.
 *
 * - `updated_at`이 기준선보다 이전 — 청구·정지·카드 등록·해지·알림 오류 기록이 전부 이
 *   값을 올린다(`lib/billing/service.ts`). 사실상 마지막 활동 시각이다.
 * - `created_at`도 기준선보다 이전 — 날짜를 잘못 적어 만든 구독이 만들자마자 대상이 되는
 *   것을 막는다(`lib/contracts/retention.ts`·위 구독 고객 정보 파기와 같은 이유).
 * - 기준선 이후에 시도된 회차 결제가 없다(`subscription_payments.attempted_at`).
 * - 기준선 이후에 발급되거나 폐기된 빌링키가 없다(`billing_keys.issued_at`·`revoked_at`).
 *
 * 뒤의 둘은 `updated_at`과 겹칠 가능성이 높지만, **겹치는 쪽이 안전한 방향이다** — 활동의
 * 증거가 한 군데라도 있으면 살아 있는 것으로 보고 파기하지 않는다. `updated_at` 하나에
 * 기대면 그 갱신을 빠뜨린 경로가 생기는 순간 살아 있는 구독이 조용히 닫힌다.
 *
 * ## 결제 이력으로 갈린다
 *
 * - **`paid` 회차가 한 건도 없는 구독**: 계약이 성립하지 않았고 오간 대금도 없다.
 *   전자상거래법이 5년 보존을 요구하는 "계약 또는 청약철회 등에 관한 기록"도 "대금결제 및
 *   재화등의 공급에 관한 기록"도 아니다 — 위 `PAYMENT_FAIL_MESSAGE_RETENTION_YEARS`의
 *   주석과 같은 판정이다. 그래서 **그 자리에서 이름·연락처·이메일을 파기한다.**
 *   후원자 표시 이름도 함께 지운다 — `pending_card`·`paused`는 공개 명단에서 이미 빠져
 *   있어(`lib/artistSupport/supporters.ts`) 목적이 남아 있지 않다.
 * - **`pending` 회차가 남아 있는 구독**: 결판나지 않은 결제다. 파기 분기에서만 빼고 전이는
 *   시킨다 — 자세한 이유는 아래 `neverPaid`의 주석에 적었다.
 * - **`paid` 회차가 있는 구독**: 계약과 대금결제 기록이 있어 5년 보존 대상이다. 여기서는
 *   **종료로 판정만 하고 고객 정보는 건드리지 않는다.** `ended`가 되는 순간부터
 *   `purgeExpiredSubscriptionCustomerData`(5년)·`purgeExpiredSubscriptionCancelReasons`(3년)·
 *   `purgeEndedSubscriptionDisplayNames`·`purgeUnusableBillingKeyRawResponses`가 이 행을
 *   맡는다.
 *
 * ## 왜 파기가 아니라 상태 전이인가
 *
 * 결제 이력이 있는 쪽은 **전이 말고는 길이 없다.** 기존 구독 파기 셋이 전부
 * `status = 'ended'`를 요구하므로, 상태를 그대로 두고 파기 조건만 넓히면 같은 5년 판정이
 * 두 벌로 갈라져 한쪽이 먼저 낡는다. 결제 이력이 없는 쪽도 같이 넘기는 이유는 **파기만
 * 하면 "고객 정보 없는 pending_card"가 남기 때문이다** — 관리자 상세 화면의 '카드 등록
 * 링크 재발급' 버튼은 `pending_card`에서만 뜨고(`pages/admin/subscriptions/[id].tsx`),
 * 그 버튼은 파기 표식이 들어간 주소로 메일을 보내려 든다.
 *
 * ## 전이가 건드리는 것 (전수 확인)
 *
 * - `SETUP_ALLOWED_STATUSES`: 카드 등록·변경 링크가 막힌다. 링크 자체가 7일 만료라
 *   1년 방치 구독에는 이미 유효한 토큰이 없다.
 * - `OCCUPYING_STATUSES`: 같은 계약에 구독을 새로 만들 수 있게 된다. 방치된 행이 계약
 *   하나를 영구히 점유하던 상태가 풀린다.
 * - `REACTIVATABLE_STATUSES`: 뒤늦은 승인이 이 구독을 되살리지 못한다. 대신 회차 기록은
 *   그대로 남고 운영자에게 `late_approval` 메일이 간다(`lib/billing/service.ts`) —
 *   1년 방치 뒤 도착한 승인은 되살릴 것이 아니라 환불 판단 대상이라 이 쪽이 맞다.
 * - `listDueSubscriptions`는 `active`·`past_due`만 집어 가므로 청구에는 변화가 없다.
 * - 관리자 대시보드의 '주의' 집계(`lib/ops/adminDashboard.ts`)에서 빠진다.
 * - 고객 관리 화면(`pages/[locale]/subscribe/manage/[id].tsx`)은 '종료'로 표시하고
 *   해지 버튼을 감춘다 — 청구가 돌지 않는 행이라 맞는 표시다.
 * - 헬스체크의 '구독이 끝난 뒤에 들어온 결제'(`lib/ops/healthCheck.ts`)는 결제 시각이
 *   `cancelled_at`(없으면 `ends_at`)보다 뒤인 건만 센다. 여기서 넘기는 구독은 둘 다
 *   비워 두므로 그 항목에 잡히지 않는다 — 과거의 정상 회차 때문에 매일 뜨는 경보가
 *   되지 않는다. 뒤늦은 승인이 실제로 도착하면 그때는 `late_approval` 메일이 맡는다.
 *
 * ## `ends_at`을 채우지 않는 이유
 *
 * 그 칸의 뜻은 "이미 결제한 기간의 끝"이다(`db/schema.ts`). 방치 구독에 지금 시각을 적으면
 * 결제하지도 않은 기간을 이용한 것으로 기록하는 셈이다. 비워 두면 5년 파기가 `updated_at`을
 * 대체 기산점으로 쓰므로(`purgeExpiredSubscriptionCustomerData`), 법정 5년은 **마지막 활동
 * 시각**부터 센다 — 전자상거래법이 세는 대상이 그 기록이라 기산점으로도 맞다.
 *
 * ## 순서
 *
 * 파기가 먼저, 전이가 나중이다. 전이가 먼저 돌면 상태가 `ended`로 바뀌어 같은 실행의
 * 파기 조건(`DORMANT_STATUSES`)에서 빠져나가고, 결제 이력이 없는 구독이 5년을 더 기다리게
 * 된다. 한 함수에 묶어 둔 이유도 그것이다 — 크론에서 둘로 갈라 각자 try/catch에 넣으면
 * 파기만 실패하고 전이가 성공하는 조합이 생긴다. **한 함수에 두는 것만으로는 부족해서**
 * 두 UPDATE를 `db.batch`(libsql 트랜잭션)로 묶는다 — 따로 보내면 함수 안에서도 그 사이에
 * 죽을 수 있고, 그러면 "고객 정보 없는 pending_card"가 그대로 남는다.
 *
 * `updated_at`은 갱신하지 않는다 — 위 파기들과 같은 이유이고, 여기서는 특히 그 값이 이
 * 함수가 넘긴 행의 법정 5년 기산점이 된다. 갱신하면 그 시계가 통째로 되감긴다.
 */
export const closeDormantSubscriptions = async (
  now: Date = new Date(),
): Promise<DormantSubscriptionResult> => {
  const db = getDb();
  const boundary = dormancyBoundary(now);

  const dormant = and(
    inArray(subscriptions.status, [...DORMANT_STATUSES]),
    dormantActivityCondition(boundary),
  );

  /**
   * 결제 이력이 없고 **결판나지 않은 회차도 없는** 구독.
   *
   * `paid`가 0건인지만 보면 부족하다. 회차 결제가 NETWORK_ERROR로 끝나면 회차는 `pending`으로
   * 남고, 그 대사(對査)는 **다음 청구 때** 도는데 `paused`·`pending_card`는 영원히 청구되지
   * 않는다. `payments` 행도 없어 `paymentMismatch` 헬스체크에도 걸리지 않는다. 그 상태로
   * 1년이 지나면 "계약 미성립"으로 판정해 연락처를 덮게 되고, 뒤늦게 승인이 확인돼도
   * **환불 연락을 보낼 수단이 남지 않는다.**
   *
   * 그래서 `pending` 회차가 하나라도 있으면 **파기 분기에서만** 뺀다. `dormant` 자체에서
   * 빼면 그 구독은 영영 닫히지 않아 이 함수가 메우려던 구멍으로 되돌아간다 — 전이는 시키고,
   * 뒤는 `purgeExpiredSubscriptionCustomerData`의 법정 5년이 받는다.
   */
  const neverPaid = and(
    notExists(
      db
        .select({ one: sql`1` })
        .from(subscriptionPayments)
        .where(
          and(
            eq(subscriptionPayments.subscriptionId, subscriptions.id),
            eq(subscriptionPayments.status, 'paid'),
          ),
        ),
    ),
    notExists(
      db
        .select({ one: sql`1` })
        .from(subscriptionPayments)
        .where(
          and(
            eq(subscriptionPayments.subscriptionId, subscriptions.id),
            eq(subscriptionPayments.status, 'pending'),
          ),
        ),
    ),
  );

  /**
   * 파기와 전이는 **한 트랜잭션**이어야 한다.
   *
   * 두 UPDATE를 따로 보내면 그 사이에서 죽었을 때 `customer_email = '(개인정보 파기됨)'`인
   * `pending_card`가 남는다. 관리자 상세의 '카드 등록 링크 재발급' 버튼은 `pending_card`에서만
   * 뜨고, 그 버튼은 파기 표식이 든 주소로 메일을 보내려 든다 — 이 함수가 "파기만 하면
   * 안 되는 이유"로 적어 둔 상태 그대로다. `db.batch`는 libsql이 트랜잭션으로 실행한다.
   *
   * 순서는 파기가 먼저다. 전이가 먼저 돌면 상태가 `ended`로 바뀌어 같은 배치의 파기 조건
   * (`DORMANT_STATUSES`)에서 빠져나간다.
   */
  const [purgeResult, endResult] = await db.batch([
    db
      .update(subscriptions)
      .set({
        customerName: PURGED_MARK,
        customerPhone: PURGED_MARK,
        customerEmail: PURGED_MARK,
        displayName: null,
      })
      .where(
        and(
          dormant,
          neverPaid,
          or(
            ne(subscriptions.customerName, PURGED_MARK),
            ne(subscriptions.customerPhone, PURGED_MARK),
            ne(subscriptions.customerEmail, PURGED_MARK),
            isNotNull(subscriptions.displayName),
          ),
        ),
      ),
    db.update(subscriptions).set({ status: 'ended' }).where(dormant),
  ]);

  return { purged: Number(purgeResult.rowsAffected ?? 0), ended: Number(endResult.rowsAffected ?? 0) };
};

/**
 * 지난 일정의 운영 메모(`availability_blocks.memo`)를 붙들어 두는 기간.
 *
 * **법이 정한 것이 아니라 운영 판단이다.** 그 표에는 고객도 주문도 매달려 있지 않고
 * (`db/schema.ts` — 컬럼은 시작·종료 시각과 메모뿐), 계약도 결제도 아니라 전자상거래법이
 * 보존을 요구하는 기록이 아니다. 막아 둔 시간이 지나면 메모의 목적은 끝나지만, 지난 일정을
 * 되짚는 운영상의 쓰임이 한동안 남아 1년을 둔다.
 */
export const AVAILABILITY_MEMO_RETENTION_YEARS = 1;

/**
 * 법정 보존 기간이 지난 결제 승인 응답 원본(`payments.raw_response`)을 파기한다.
 *
 * ## 이 컬럼에 무엇이 들어가는가
 *
 * 승인·재조회 응답(토스 Payment 객체)의 **본문 전체**다. `lib/booking/toss.ts`의 `request`가
 * `await res.json()`을 통째로 `json as TossPayment`로 넘기고(필드를 골라 담지 않는다), 그
 * 객체가 세 곳에서 `JSON.stringify` 되어 그대로 저장된다 — `lib/booking/confirm.ts`
 * (예약·믹싱 승인), `lib/funding/confirm.ts`(후원 승인), `lib/billing/service.ts`
 * (회차 결제·웹훅 복구). 우리 타입이 선언한 7개 필드는 저장 범위의 하한일 뿐이다.
 *
 * **최상위에는 구매자 개인정보 필드가 없다**(토스 레퍼런스 확인) — `customerName`·
 * `customerEmail`·`customerMobilePhone`은 Payment 객체의 최상위 필드가 아니다. 개인정보는
 * **결제수단별 하위 객체**에 실린다:
 *
 * - `virtualAccount`: `customerName`(구매자명)·`depositorName`(입금자명)·`accountNumber`,
 *   그리고 환불 계좌를 등록했다면 `refundReceiveAccount.holderName`·`.accountNumber`
 * - `mobilePhone`: `customerMobilePhone`(결제에 쓴 휴대폰 번호)
 * - `card`: `number`는 **마스킹된** 값이고 소유자 이름은 없다
 *
 * 우리 결제에 그 객체들이 실제로 붙는지는 수단에 달렸다. 위젯은 토스 콘솔에서 개통된 수단을
 * 그대로 그리므로 코드에 수단 제한이 없고(`lib/booking/toss.ts`), 가상계좌는 승인 단계에서
 * 거절하지만 그 거절은 `status !== 'DONE'`일 때뿐이라 **입금이 끝나 DONE으로 도착한 건은
 * 웹훅 복구 경로로 들어와 저장될 수 있다**(`lib/booking/webhook.ts`).
 *
 * 우리가 토스에 보내는 값은 `customerName`·`customerEmail`이다
 * (`components/booking/TossPaymentWidget.tsx`의 `requestPayment`,
 * `lib/billing/toss-billing.ts`의 `chargeBillingKey`). `metadata`를 보내는 코드는 없다(확인).
 *
 * **확인되지 않은 것**: 보낸 `customerEmail`이 응답에 되돌아오는 경로가 있는지, `receipt.url`·
 * `checkout.url`이 가리키는 문서에 개인정보가 있는지, 현금영수증의 신분확인번호가 응답에
 * 실리는지 — 셋 다 문서로 확인하지 못했다. 응답 본문을 읽는 코드가 없어 실제 키 목록도
 * 코드만으로는 특정되지 않는다.
 *
 * ## 판정
 *
 * - **법정 기록이다.** 대금이 실제로 오간 승인의 원본이고, 스키마 주석이 밝히는 보관 목적도
 *   분쟁·대사(reconciliation)다. 전자상거래법이 5년 보존을 요구하는 "대금결제 및 재화등의
 *   공급에 관한 기록"의 근거 자료라 그 전에는 파기하지 않는다.
 * - **다만 5년이 지나면 남길 근거가 없다.** 수단에 따라 이름·계좌번호·휴대폰 번호가 섞여
 *   들어오는 값을 기한 없이 들고 있는 것이 제21조①이 막으려는 상태다. 대사에 필요한 값
 *   (`payment_key`·`method`·`approved_at`·`receipt_url`)은 별도 컬럼에 따로 있어 원본을
 *   비워도 기록은 남는다.
 * - **기산점은 승인 시각(`approved_at`)**, 없으면 행 생성일.
 */
export const purgeExpiredPaymentRawResponses = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, ORDER_LEGAL_RETENTION_YEARS);

  const result = await getDb()
    .update(payments)
    .set({ rawResponse: null })
    .where(
      and(
        isNotNull(payments.rawResponse),
        or(
          and(isNotNull(payments.approvedAt), lt(payments.approvedAt, boundary)),
          and(isNull(payments.approvedAt), lt(payments.createdAt, boundary)),
        ),
      ),
    );

  return rows(result);
};

/**
 * 더는 쓸 수 없는 카드의 빌링키 발급 응답 원본(`billing_keys.raw_response`)을 파기한다.
 *
 * ## 이 컬럼에 무엇이 들어가는가
 *
 * 빌링키 발급 응답(토스 Billing 객체)의 **본문 전체**다(`lib/billing/toss-billing.ts`의
 * `request`가 응답 JSON을 그대로 `json`으로 돌려주고, `lib/billing/service.ts`가
 * `JSON.stringify(issued.raw)`로 저장한다).
 *
 * 그 본문에는 **빌링키 문자열 자체**가 들어 있다 — 같은 파일이 `json.billingKey`를 거기서
 * 꺼내 쓰기 때문에 확인된 사실이다. 스키마가 빌링키를 두고 "서버 밖으로 나가지 않는다"고
 * 적어 둔 그 값이 같은 행에 한 번 더, 이번에는 자유 형식의 JSON 안에 복사돼 있는 셈이다.
 * 카드 정보(`card.company`·`card.number`·`card.cardType`)도 같은 본문에서 꺼내므로 들어 있고,
 * `card.number`는 마스킹된 값이다.
 *
 * **이름·생년월일·사업자등록번호는 들어 있지 않다**(토스 레퍼런스 확인). 생년월일 6자리 또는
 * 사업자등록번호인 `customerIdentityNumber`는 **요청에만** 있는 값이고 응답에 되돌아오지
 * 않는다. 우리 발급 요청은 `authKey`·`customerKey` 둘뿐이라 애초에 보내지도 않는다
 * (`issueBillingKey`). 응답에 있는 것은 `billingKey`·`customerKey`·마스킹 카드번호·발급사 코드다.
 *
 * `customerKey`도 개인정보가 아니다 — `lib/billing/token.ts`의 `generateCustomerKey()`가
 * 만드는 `sub_` + UUID 난수이고, 구독 id를 그대로 쓰지 않는 이유도 예측 불가여야 한다는
 * 토스 규격 때문이다.
 *
 * 그래서 이 컬럼에서 실제로 문제가 되는 값은 **빌링키**, 즉 결제수단 자격증명이다.
 *
 * ## 판정
 *
 * - **행을 남기는 것은 여전히 옳다.** 스키마 주석이 말하는 이유("과거 회차의 결제 수단
 *   근거")는 지금도 유효하고, 그 근거는 `card_company`·`card_number_masked`·`issued_at`이
 *   감당한다. 이 함수는 행도, 그 컬럼들도 건드리지 않는다.
 * - **응답 원본은 그 근거가 아니다.** 결제 자체의 기록은 `payments`에 있고(위 함수), 빌링키
 *   발급 시점에는 대금이 오가지 않는다 — 전자상거래법이 5년 보존을 요구하는 대금결제 기록에
 *   해당하지 않는다. 읽는 코드도 없다.
 * - **그래서 쓸 수 없게 된 순간이 곧 "불필요하게 되었을 때"다**(제21조①). 별도 기간을 두지
 *   않는다 — 못 쓰는 결제수단 자격증명을 더 들고 있을 근거가 없다.
 * - 대상은 **폐기된 키**(`revoked_at`)와 **끝난 구독에 매달린 키** 둘 다다. 카드 교체만
 *   `revoked_at`을 남기고(`lib/billing/service.ts`) 구독 종료는 키를 폐기하지 않기 때문에,
 *   폐기 표시만 보면 해지된 구독의 마지막 카드가 영영 대상에서 빠진다.
 */
export const purgeUnusableBillingKeyRawResponses = async (): Promise<OrderPurgeResult> => {
  const db = getDb();
  const endedSubscriptions = db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'ended'));

  const result = await db
    .update(billingKeys)
    .set({ rawResponse: null })
    .where(
      and(
        isNotNull(billingKeys.rawResponse),
        or(
          isNotNull(billingKeys.revokedAt),
          inArray(billingKeys.subscriptionId, endedSubscriptions),
        ),
      ),
    );

  return rows(result);
};

/**
 * 법정 보존 기간이 지난 환불 사유(`refunds.reason`)를 파기한다.
 *
 * ## 판정
 *
 * - **법정 기록이다.** 환불은 청약철회·계약해제의 이행이고, 그 사유는 "계약 또는 청약철회
 *   등에 관한 기록"의 내용 그 자체다. 같은 문자열이 토스에 `cancelReason`으로 나가 결제사
 *   쪽 취소 기록에도 남는다(`lib/booking/toss.ts`). 5년 전에는 파기하지 않는다.
 * - **그래도 파기 대상인 이유는 자유 입력이기 때문이다.** 고객 셀프 취소는 고정 문구
 *   ('고객 셀프 취소')지만 관리자 환불은 500자까지 자유 서술이라
 *   (`pages/api/admin/bookings/[id].ts`) 이름·연락처 조각이 들어갈 수 있다. 계약서 쪽
 *   `title`·`termination_reason`을 파기 대상에 넣은 것과 같은 이유다
 *   (`lib/contracts/retention.ts`).
 * - **NOT NULL이라 표식으로 덮는다**(`db/schema.ts`). 환불이 있었다는 사실·금액·요청자·
 *   토스 거래키는 다른 컬럼에 그대로 남는다.
 * - 기산점은 환불 기록의 생성일. 환불 행은 만들어진 뒤 사유가 바뀌지 않는다.
 */
export const purgeExpiredRefundReasons = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, ORDER_LEGAL_RETENTION_YEARS);

  const result = await getDb()
    .update(refunds)
    .set({ reason: PURGED_MARK })
    .where(and(lt(refunds.createdAt, boundary), ne(refunds.reason, PURGED_MARK)));

  return rows(result);
};

/**
 * 보관 기간이 지난 예약 요청사항(`bookings.customer_note`)을 파기한다.
 *
 * ## 판정
 *
 * - **법정 기록이 아니다.** 계약·청약철회 기록으로 보존해야 하는 것은 누가·무엇을·언제·
 *   얼마에 계약했는가이고, 그것은 `orders`와 `bookings`의 상품·시각·금액 컬럼이 담는다.
 *   요청사항은 그 위에 고객이 자유롭게 적는 500자다(`lib/booking/validation.ts`) — 계약
 *   내용을 특정하는 항목이 아니다. **전자상거래법의 5년은 보존 의무이지 보존 항목을 넓히는
 *   근거가 아니므로**, 이 컬럼을 5년 붙들 근거로 쓰지 않는다.
 * - **무엇이 적히는지 알 수 없다.** 확인 메일과 관리자 화면에 "요청사항"으로 그대로 실리는
 *   자유 입력이라(`lib/booking/email.ts`, `pages/admin/bookings/[id].tsx`) 다른 사람의
 *   이름·연락처는 물론 건강 상태 같은 사정도 적힐 수 있다.
 * - **기간은 3년으로 둔다.** "요청한 대로 작업했는가"는 소비자 분쟁의 내용이 될 수 있어,
 *   전자상거래법이 소비자의 불만·분쟁처리 기록에 정한 기간과 같은 값을 쓴다.
 * - **기산점은 이용일(`start_at`)**, 취소된 예약은 취소 시각. 여기에 더해 생성일도 그만큼
 *   지났을 것을 요구한다 — 날짜를 잘못 잡은 예약이 만들자마자 대상이 되는 것을 막는다.
 */
export const purgeExpiredBookingCustomerNotes = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, DISPUTE_RETENTION_YEARS);

  const result = await getDb()
    .update(bookings)
    .set({ customerNote: null })
    .where(
      and(
        isNotNull(bookings.customerNote),
        or(
          and(isNotNull(bookings.cancelledAt), lt(bookings.cancelledAt, boundary)),
          and(isNull(bookings.cancelledAt), lt(bookings.startAt, boundary)),
        ),
        lt(bookings.createdAt, boundary),
      ),
    );

  return rows(result);
};

/**
 * 보관 기간이 지난 믹싱 주문의 요청사항(`work_orders.customer_note`)을 파기한다.
 *
 * ## 판정
 *
 * 예약 쪽과 같은 이유로 법정 기록이 아니고 같은 3년을 쓴다. 다만 **적히는 내용이 다르다** —
 * 믹싱 주문에서 이 칸은 고객이 음원 파일을 올려 둔 링크가 들어가는 자리다
 * (`lib/booking/customerDraft.ts`: "예약은 요청사항, 믹싱은 파일 링크"). 남의 개인 저장소로
 * 들어가는 주소이므로 작업이 끝난 뒤 들고 있을 이유는 더 적다.
 *
 * 기산점은 납품 시각(`delivered_at`), 취소됐으면 취소 시각, 둘 다 없으면 생성일. 예약과 달리
 * 이용일이 없어(`db/schema.ts` workOrders 주석 — 상태 전이로만 진행을 표현한다) 상태가
 * 끝난 시각을 기산점으로 쓴다. 생성일 조건은 같은 이유로 함께 건다.
 */
export const purgeExpiredWorkOrderCustomerNotes = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, DISPUTE_RETENTION_YEARS);

  const result = await getDb()
    .update(workOrders)
    .set({ customerNote: null })
    .where(
      and(
        isNotNull(workOrders.customerNote),
        or(
          and(isNotNull(workOrders.deliveredAt), lt(workOrders.deliveredAt, boundary)),
          and(
            isNull(workOrders.deliveredAt),
            isNotNull(workOrders.cancelledAt),
            lt(workOrders.cancelledAt, boundary),
          ),
          and(
            isNull(workOrders.deliveredAt),
            isNull(workOrders.cancelledAt),
            lt(workOrders.createdAt, boundary),
          ),
        ),
        lt(workOrders.createdAt, boundary),
      ),
    );

  return rows(result);
};

/**
 * 지난 일정의 운영 메모(`availability_blocks.memo`)를 파기한다.
 *
 * ## 판정
 *
 * - **법정 기록이 아니다.** 그 표는 운영자가 예약을 막아 두는 시간대이고, 고객도 주문도
 *   결제도 매달려 있지 않다. 보존해야 할 계약·결제 기록의 일부가 아니다.
 * - **그래도 파기한다 — 개인정보가 들어갈 수 있는 자유 입력이기 때문이다.** 관리자 화면의
 *   "메모 (선택)" 칸에 제한 없이 적는 값이라(`pages/admin/bookings/index.tsx`,
 *   `pages/api/admin/blocks/index.ts`) 누구 때문에 비워 둔 시간인지를 이름으로 적어 두는
 *   것이 가장 자연스럽다. 계약서 제목(`lib/contracts/retention.ts`의 `title`)을 파기 대상에
 *   넣은 것과 같은 판단이다.
 * - 시각(`start_at`·`end_at`)은 남긴다 — 개인을 식별하지 않고, 지난 일정이 있었다는 사실은
 *   운영 기록으로 쓸 수 있다.
 * - 기산점은 그 시간대의 끝(`end_at`), 기간은 `AVAILABILITY_MEMO_RETENTION_YEARS`.
 */
export const purgeExpiredAvailabilityBlockMemos = async (
  now: Date = new Date(),
): Promise<OrderPurgeResult> => {
  const boundary = yearsAgo(now, AVAILABILITY_MEMO_RETENTION_YEARS);

  const result = await getDb()
    .update(availabilityBlocks)
    .set({ memo: null })
    .where(and(isNotNull(availabilityBlocks.memo), lt(availabilityBlocks.endAt, boundary)));

  return rows(result);
};

/**
 * 여기서 **일부러 파기하지 않는 것**: 정산 메모
 * (`funding_project_payouts.memo` · `artist_payouts.memo`).
 *
 * 두 컬럼 모두 운영자가 **이체를 마친 뒤** 그 지급 건에 붙이는 메모다
 * (`lib/funding/payout.ts`의 `markFundingPayoutPaid`, `lib/artistSupport/payout.ts`의
 * `markArtistPayoutPaid` — 둘 다 `status: 'paid'`로 올리면서 함께 쓴다). 상대는 소비자가
 * 아니라 정산을 받는 개설자·아티스트이고, 행 자체가 지급액·수수료·원천징수액을 담은 정산
 * 기록이다.
 *
 * 파기 대상에서 빼는 이유는 두 가지다. 첫째, **메모가 새로 드러내는 개인정보가 없다** —
 * 누구에게 얼마를 지급했는가는 같은 행의 금액 컬럼과 개설자·아티스트 식별자가 이미 담고
 * 있고, 그쪽은 정산·세무 기록으로 보존한다. 둘째, **지급 경위가 곧 그 기록의 내용이다**
 * (재이체·상계·보류 사유가 적히는 자리라 지우면 장부의 숫자를 설명할 수 없다).
 *
 * 그래서 이 판단은 "개인정보가 아니다"가 아니라 "그 행의 보존 근거 안에 있다"에 가깝다.
 * 정산 기록 자체의 보존 기간을 정하게 되면 이 메모도 같은 기간을 따라야 한다 — 그때 이
 * 주석을 다시 읽고 판단할 것.
 */
