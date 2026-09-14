import { sql, type SQL } from 'drizzle-orm';

import type { FundingOrder } from './service';

/**
 * 아직 환불하지 않고 남은 금액 = totalAmount − Σ(done 환불, **모든 payments 행**).
 *
 * 결제 행이 하나뿐이라는 가정은 깨진다 — 웹훅 대사(syncFundingCancelledFromToss)는
 * paymentKey로 행을 골라 환불을 기록하고, 관리자 상세 화면은 전 행의 환불을 합산한다.
 * 그래서 payments[0]만 보고 계산하면 payments[1]에 기록된 환불이 통째로 빠져, 이미
 * 환불된 금액을 다시 토스에 요청하게 된다(초과 취소 거절 또는 이중 환불).
 *
 * refunds 관계가 로딩되지 않은 행은 0으로 다룬다 — 관계 없이 만든 픽스처 방어.
 */
export const remainingRefundable = (order: FundingOrder): number => {
  const refunded = order.payments.reduce(
    (sum, p) => sum + (p.refunds ?? []).filter((r) => r.status === 'done').reduce((s, r) => s + r.amount, 0),
    0,
  );
  return Math.max(0, order.totalAmount - refunded);
};

/**
 * "아직 살아 있는 후원"으로 볼 orders.status 집합 — 돈을 받았고, 리워드 의무가 남아 있다.
 *
 * `partially_refunded`가 들어가는 이유: 일부만 환불한 건도 **리워드는 나가야 한다.** 이 판정이
 * 저장소 안에서 네 군데로 흩어져 있었고, 발송 기록 한 곳만 `paid` 하나로 굳어 있었다. 그래서
 * 부분환불된 후원은 실제로 발송해도 상태를 기록할 수 없었고(API 409 + UPDATE WHERE 0행),
 * CSV·목록에는 영구히 '미발송'으로 남아 다음 회차 중복 발송 후보가 됐다. `delivered_at`도
 * 못 찍혀 약관 제13조의 '전달 완료 후 1년 파기' 기산점이 아예 생기지 않았다.
 *
 * 지금 이 상수 하나를 보는 곳: CSV export(admin-list.ts), 공개·관리자 집계(service.ts,
 * admin-list.ts), 관리자 환불 버튼(pages/admin/funding/[id].tsx), 발송 기록 API
 * (pages/api/admin/funding/pledges/[id].ts). 다시 갈리지 않도록
 * `lib/funding/refundable.test.ts`가 policy.ts의 REFUND_PENDING_ORDER_STATUSES와 같은
 * 집합인지까지 대조한다 — 둘은 근거가 달라도 같은 "살아 있는 후원"을 가리켜야 한다.
 */
export const LIVE_FUNDING_ORDER_STATUSES = ['paid', 'partially_refunded'] as const;

export const isLiveFundingOrderStatus = (status: string): boolean =>
  (LIVE_FUNDING_ORDER_STATUSES as readonly string[]).includes(status);

/**
 * 위 집합의 SQL 조각 — `o.status IN (…)` 자리에 그대로 넣는다.
 *
 * 문자열 리터럴을 쿼리마다 다시 적으면 한 곳만 고치는 사고가 정확히 이 버그의 형태였다.
 * 호출할 때마다 새 조각을 만든다(하나를 여러 쿼리에 돌려 쓰지 않는다 — service.ts의
 * backerIdentitySql과 같은 관례).
 */
export const liveFundingOrderStatusList = (): SQL =>
  sql.join(LIVE_FUNDING_ORDER_STATUSES.map((s) => sql`${s}`), sql`, `);
