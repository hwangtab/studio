import { and, eq, isNotNull, isNull, lt, ne, or } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, subscriptions } from '../../db/schema';

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
    .set({
      customerName: PURGED_MARK,
      customerPhone: PURGED_MARK,
      customerEmail: PURGED_MARK,
      updatedAt: now,
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
    .set({
      customerName: PURGED_MARK,
      customerPhone: PURGED_MARK,
      customerEmail: PURGED_MARK,
      updatedAt: now,
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
