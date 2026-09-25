import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders } from '../../db/schema';

/**
 * 결제창에서 승인이 안 난 사유를 주문에 남긴다.
 *
 * **왜 있나.** 토스는 승인이 안 나면 `failUrl`로 `?code=&message=`를 붙여 돌려보내는데,
 * 그 경로는 confirm 라우트에 도달하지 않는다(confirm은 승인 성공 후 successUrl에서만
 * 불린다). 그래서 실패 사유가 우리 쪽에 한 글자도 남지 않았다 — 2026-09-19에 한 후원자가
 * 3분 동안 세 번 시도하고 떠났는데(각 2만원) 왜 실패했는지 확인할 길이 없었다.
 * 유일한 기록이 토스 대시보드였다.
 *
 * saf-2026이 같은 문제를 `app/api/payments/funding/toss/fail` 비콘으로 풀었다. 이쪽도
 * **전부 비콘으로 보낸다** — 실패 화면의 getServerSideProps에서 곧장 쓰면 자바스크립트가
 * 꺼져 있어도 남지만, 그 주소는 인증도 Origin 검사도 없는 GET이라 남의 주문번호를 넣은
 * 링크 한 번으로(링크 프리뷰 봇 포함) 그 주문의 실패 사유가 덮인다. 비콘
 * (`/api/payments/failed`)에는 Origin 검사와 IP 레이트리밋이 걸려 있다.
 * 결제창이 열리기도 전에 SDK가 던지는 경우도 같은 비콘을 쓴다.
 *
 * 지금 이 함수를 부르는 곳은 그 비콘 하나다. 실패 화면(펀딩·예약)은
 * `useReportPaymentFailureOnMount`(utils/reportPaymentFailure.ts)로 비콘을 쏜다.
 *
 * **best-effort.** 실패해도 호출한 화면은 그대로 뜬다 — 사유 기록이 실패 안내를 막으면
 * 안 된다.
 */

/** 토스 실패 코드 형태. 화면·DB 양쪽에서 같은 잣대를 쓴다. */
export const PAYMENT_FAIL_CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;
/** 주문번호 형태 — 예약(SNB)·펀딩(FND), 믹싱은 SNB-M-. 이걸 벗어나면 기록하지 않는다. */
export const PAYMENT_ORDER_NO_PATTERN = /^(SNB|FND)-(M-)?\d{8}-[0-9A-F]{8}$/;

const MESSAGE_MAX = 300;

/**
 * 실패 사유를 남겨도 되는 주문 상태. 확정(`paid`)·환불(`refunded`·`partially_refunded`)된
 * 주문에는 쓰지 않는다 — 뒤늦은 비콘(새로고침·뒤로가기로 같은 실패 URL이 여러 번 열린다)이
 * 상태를 흐리게 한다. `expired`·`failed`는 결제가 안 된 주문이라 사유가 남을 자리다.
 */
const RECORDABLE_ORDER_STATUSES = ['pending', 'failed', 'expired'] as const;

export interface PaymentFailureInput {
  orderNo: string;
  code: string | null;
  /** 토스 원문. 화면에는 쓰지 않고 기록만 한다. */
  message?: string | null;
}

/**
 * 기록 대상이면 true. 형태 검증만 한다(DB 접근 없음) — API 라우트가 값싼 거절을
 * 먼저 하고, 통과한 것만 DB를 건드리게 하려는 분리다.
 */
export const isRecordablePaymentFailure = ({ orderNo, code }: PaymentFailureInput): boolean => {
  if (!PAYMENT_ORDER_NO_PATTERN.test(orderNo)) return false;
  // 코드가 없으면 남길 것이 없다 — 창을 닫은 경우도 토스가 코드를 준다.
  return code !== null && PAYMENT_FAIL_CODE_PATTERN.test(code);
};

/**
 * 주문에 실패 사유를 남긴다. **아직 결제되지 않은 주문에만 쓴다** — 이미 확정·환불된
 * 주문에 뒤늦은 실패 비콘이 닿아 상태를 흐리는 일이 없게 한다(새로고침·뒤로가기로
 * 같은 실패 URL이 여러 번 열린다).
 *
 * 반환값은 "실제로 기록했나"다. 호출부는 무시해도 된다.
 */
export const recordPaymentFailure = async (input: PaymentFailureInput): Promise<boolean> => {
  if (!isRecordablePaymentFailure(input)) return false;
  try {
    /**
     * **상태를 먼저 읽는다.** 예전엔 무조건 쓰고 `paid` 이상이면 되돌렸는데, 그 왕복이
     * `orders.updated_at`을 두 번 밀었다 — 그 컬럼은 파기 기준선(`lib/privacy/orderRetention.ts`)이
     * 읽는 값이라, 남의 주문번호로 비콘을 반복해 쏘면 그 주문의 5년 파기를 무한히 연기할 수
     * 있었다(방어가 Origin 헤더 하나뿐이다). 되돌림도 `payment_fail_*`만 지우고 밀린
     * `updated_at`은 되돌리지 못한다.
     *
     * 읽고-쓰기 사이의 경합은 쓰기의 WHERE가 막는다 — 그 사이 결제가 확정되면 0행이 되고
     * 아무것도 바뀌지 않는다. 쓰고-되돌리기와 달리 흔적이 남지 않는다.
     */
    const [before] = await getDb()
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.orderNo, input.orderNo))
      .limit(1);
    if (!before) return false;
    // 기록 대상은 결제 전(`pending`)과 이미 실패한 주문뿐이다. `paid`·환불된 주문에는
    // 아예 쓰지 않는다 — `partially_refunded`도 환불된 주문이다(lib/funding/refundable.ts).
    if (!(RECORDABLE_ORDER_STATUSES as readonly string[]).includes(before.status)) return false;

    /**
     * `updated_at`을 건드리지 않는다 — 실패 기록은 `payment_failed_at`이 자기 시각을 갖는다.
     * 여기서 `updated_at`을 밀면 위 주석이 말하는 파기 연기가 그대로 남는다.
     */
    const written = await getDb()
      .update(orders)
      .set({
        paymentFailCode: input.code,
        paymentFailMessage: input.message ? String(input.message).slice(0, MESSAGE_MAX) : null,
        paymentFailedAt: new Date(),
      })
      .where(and(
        eq(orders.orderNo, input.orderNo),
        inArray(orders.status, [...RECORDABLE_ORDER_STATUSES]),
      ));
    return Number(written.rowsAffected) > 0;
  } catch (error: unknown) {
    // 컬럼이 아직 운영 DB에 없을 수도 있다(마이그레이션 수동 적용). 그때도 화면은 떠야 한다.
    console.error('[payment-failure] 사유 기록 실패:', input.orderNo, error);
    return false;
  }
};
