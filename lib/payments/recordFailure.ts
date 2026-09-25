import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders } from '../../db/schema';
import { isRefundedFundingOrderStatus } from '../funding/refundable';

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
    const rows = await getDb()
      .update(orders)
      .set({
        paymentFailCode: input.code,
        paymentFailMessage: input.message ? String(input.message).slice(0, MESSAGE_MAX) : null,
        paymentFailedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.orderNo, input.orderNo))
      .returning({ status: orders.status });
    const row = rows[0];
    if (!row) return false;
    // 이미 결제가 끝난 주문이면 되돌린다 — where 절에 status를 넣으면 드라이버마다
    // returning 동작이 갈려, 한 번 읽고 판단하는 대신 쓰고 되돌리는 쪽이 단순하다.
    //
    // `partially_refunded`도 환불된 주문이다. 목록에서 빠져 있어서, 부분 환불된 주문에
    // 뒤늦은 실패 비콘이 닿으면 실패 사유가 그대로 박혔다 — 이 함수의 주석이 지키겠다고
    // 적어 둔 "확정·환불된 주문"에 구멍이 있었다. 판정은 저장소의 다른 곳과 같은 함수를
    // 쓴다(lib/funding/refundable.ts).
    if (row.status === 'paid' || isRefundedFundingOrderStatus(row.status)) {
      await getDb()
        .update(orders)
        .set({ paymentFailCode: null, paymentFailMessage: null, paymentFailedAt: null })
        .where(eq(orders.orderNo, input.orderNo));
      return false;
    }
    return true;
  } catch (error: unknown) {
    // 컬럼이 아직 운영 DB에 없을 수도 있다(마이그레이션 수동 적용). 그때도 화면은 떠야 한다.
    console.error('[payment-failure] 사유 기록 실패:', input.orderNo, error);
    return false;
  }
};
