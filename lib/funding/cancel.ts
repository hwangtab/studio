import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, refunds } from '../../db/schema';
import { VIRTUAL_ACCOUNT_CANCEL_ADMIN_MESSAGE, VIRTUAL_ACCOUNT_ERROR_CODE, cancelPayment } from '../booking/toss';
import { sendFundingCancelledEmails } from './email';
import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from './policy';
import { computeProjectState, getFundingProject } from './projects';
import { liveFundingOrderStatusList, remainingRefundable } from './refundable';
import { findFundingOrderByOrderNo, type FundingOrder } from './service';
import type { FundingProject } from './projects';

export type FundingCancelOutcome =
  | { ok: true; mode: 'refunded' | 'refund_requested' | 'recorded'; refundAmount: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'toss_failed' | 'recording_failed'; message: string };

const GENERIC = '취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const refundIdempotencyKey = (orderNo: string, amount: number): string => `refund:${orderNo}:${amount}`;

/**
 * 취소 메일 발송 + notificationError 기록. 돈은 이미 나갔으므로(또는 확정 취소됨) 메일 예외나
 * 기록 실패가 outcome을 바꿔서는 안 된다 — confirm.ts의 notificationError 패턴과 동일하게
 * 둘 다 try/catch로 감싼다.
 */
const notifyCancelled = async (
  db: ReturnType<typeof getDb>,
  order: FundingOrder,
  project: FundingProject | null,
  mode: 'refunded' | 'refund_requested' | 'recorded',
  refundAmount: number,
): Promise<void> => {
  let emailError: string | null = null;
  // 플레이스홀더 주소(수기 등록에서 연락처를 비운 건)로 가는 **고객 항목**은 발송 계층이
  // 조용히 떨어뜨린다(email.ts withoutUndeliverableCustomer). 여기서 통째로 건너뛰면
  // 운영자 사본까지 사라지는데, 수기 건의 환불은 손으로 계좌에 송금하는 작업이라 그
  // 메일이 실무의 시작점이다.
  try {
    emailError = await sendFundingCancelledEmails(order, project, mode, refundAmount);
  } catch (error) {
    console.error('[funding-cancel] 취소 메일 발송 중 예외', { orderNo: order.orderNo, error });
    emailError = error instanceof Error ? error.message : String(error);
  }
  try {
    await db.update(orders).set({ notificationError: emailError }).where(eq(orders.id, order.id));
  } catch (error) {
    console.error('[funding-cancel] notificationError 기록 실패', { orderNo: order.orderNo, emailError, error });
  }
};

export const cancelFundingPledge = async (input: { orderNo: string; requestedBy: 'customer' | 'admin'; reason: string; now: Date }): Promise<FundingCancelOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '펀딩 내역을 찾을 수 없습니다.' };
  const pledge = order.fundingPledge;
  const project = getFundingProject(pledge.projectSlug);
  // 부분환불 건은 관리자만 다룰 수 있다 — 남은 금액 계산이 걸려 있어 고객 셀프 취소에 맡기지 않는다.
  if (order.status === 'partially_refunded' && input.requestedBy !== 'admin') {
    return { ok: false, code: 'invalid_state', message: '일부 환불된 펀딩은 문의해 주세요.' };
  }
  if (order.status !== 'paid' && !(order.status === 'partially_refunded' && input.requestedBy === 'admin')) {
    return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES.not_paid };
  }
  if (input.requestedBy === 'customer') {
    const verdict = assessSelfCancel({
      orderStatus: order.status,
      projectState: project ? computeProjectState(project, input.now) : 'closed',
      fulfillmentStatus: pledge.fulfillmentStatus,
      paymentMethod: pledge.paymentMethod,
      downloadedAt: pledge.downloadedAt ?? null,
    });
    if (!verdict.ok) return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES[verdict.code] };
  }
  const db = getDb();
  // 토스 취소를 걸 결제 행 — 여러 행이 있을 수 있으므로(재승인·분할) done 환불이 아직
  // 잔액을 다 덮지 않은 행을 고른다. 그런 행이 없으면 가장 마지막 결제 행을 쓴다
  // (syncFundingCancelledFromToss도 paymentKey로 행을 고르므로 payments[0] 고정은 위험하다).
  const doneRefundedOn = (p: (typeof order.payments)[number]): number =>
    (p.refunds ?? []).filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
  const payment =
    order.payments.find((p) => doneRefundedOn(p) < order.totalAmount) ?? order.payments[order.payments.length - 1];

  // 이미 done으로 기록된 환불을 **모든 결제 행에서** 뺀 잔액만 취소한다 — payments[0]만 보면
  // 웹훅이 다른 행에 기록한 환불이 빠져 이중 환불이 되고, 잔액이 0인데도 토스를 부르게 된다.
  const refundAmount = remainingRefundable(order);

  if (pledge.paymentMethod === 'toss' && !payment) {
    return { ok: false, code: 'invalid_state', message: '결제 기록이 없는 펀딩입니다. 관리자에게 문의해 주세요.' };
  }

  /**
   * 무통장입금은 2026-09-11에 중단했다 — 새 무통장 후원은 만들어질 수 없다
   * (lib/funding/validation.ts가 결제수단을 toss로 못박는다).
   *
   * 그래도 이 분기를 남기는 이유: 중단 전에 만들어진 행이 DB에 남아 있고, 그 행들이
   * 토스 취소 경로로 흘러가면 결제 기록이 없어 엉뚱하게 실패한다. 관리자 쪽 기록 경로만
   * 남겨 두면 옛 행을 닫을 수단이 있고, 고객 셀프 취소는 명시적으로 거절한다 —
   * 셀프 취소를 받아 두면 운영자가 손으로 송금할 환불 요청이 다시 쌓인다. 그것이
   * 이 결제수단을 걷어낸 이유다.
   */
  if (pledge.paymentMethod === 'bank_transfer') {
    if (input.requestedBy === 'customer') {
      // 위 assessSelfCancel이 먼저 걸러내므로 여기까지 오지 않는다 — 두 판정이 갈리면
      // 화면은 버튼을 띄우는데 서버가 거절하는 조합이 생기므로, 같은 문구로 방어만 남긴다.
      return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES.offline_payment };
    }
    if (refundAmount <= 0) return { ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' };
    const claim = await db.run(
      sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status IN (${liveFundingOrderStatusList()})`,
    );
    if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리된 펀딩입니다.' };
    await notifyCancelled(db, order, project, 'recorded', refundAmount);
    return { ok: true, mode: 'recorded', refundAmount };
  }

  // 잔액이 0이면 토스를 아예 부르지 않는다 — 부르면 취소 금액 0(또는 초과)으로 거절되거나,
  // 잔액이 남은 것처럼 계산된 금액이 이중으로 나간다.
  if (refundAmount <= 0) return { ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' };

  // 토스: 선점 → 취소 API → 기록. 실패 시 되돌림(예약 cancel.ts와 같은 순서).
  //
  // 셀프 취소는 "발송 준비 전"이라는 조건을 선점 WHERE에 함께 건다 — assessSelfCancel이 읽기
  // 시점에만 보므로, 판정과 선점 사이에 관리자가 발송 준비로 넘기면 환불과 발송이 둘 다
  // 성립한다(돈은 나가고 리워드도 나간다). 관리자 취소는 발송 중에도 허용해야 하므로 제외한다.
  const selfCancelGuard =
    input.requestedBy === 'customer'
      ? sql` AND EXISTS (SELECT 1 FROM funding_pledges WHERE order_id = ${order.id} AND fulfillment_status = 'none')`
      : sql.empty();
  const claim = await db.run(
    sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = ${order.status}${selfCancelGuard}`,
  );
  if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 펀딩입니다.' };
  const toss = await cancelPayment({
    paymentKey: payment!.paymentKey, cancelReason: input.reason, cancelAmount: refundAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, refundAmount),
    // 가상계좌면 토스를 부르지 않고 운영자가 알아볼 수 있는 문구로 끝낸다 — 부르면 토스가
    // refundReceiveAccount 누락으로 거절하고 그 원문이 고객 화면에 그대로 나간다.
    paymentMethod: payment!.method,
  });
  if (!toss.ok) {
    /**
     * 되돌리기 전에 **그 사이 진짜 환불이 기록됐는지**를 본다.
     *
     * 토스 호출은 12초에 타임아웃하는데(booking/toss.ts), 그 실패는 "취소가 거절됐다"와
     * "취소는 됐는데 응답만 늦었다"를 구분하지 못한다. 후자라면 토스가 보낸 CANCELED 웹훅이
     * 먼저 도착해 `syncFundingCancelledFromToss`가 done 환불 행을 남긴다. 그 상태에서
     * 되돌리면 **환불이 끝난 건이 paid로 살아난다** — 공개 모금액에 환불된 돈이 남고,
     * 그 사람이 음원을 계속 받고, 재취소는 잔액 0이라 막힌다. 스스로 낫지 않는다.
     *
     * 선점 WHERE의 `status = 'refunded'`만으로는 내가 찍은 refunded와 웹훅이 찍은 refunded를
     * 구분할 수 없다 — 둘이 같은 값이다. 그래서 **done 환불 건수가 그대로인지**를 함께 본다.
     * 건수로 보는 이유: 부분 환불이 이미 있던 건도 정상적으로 되돌아가야 한다.
     */
    const doneRefundsBefore = order.payments.reduce(
      (n, p) => n + (p.refunds ?? []).filter((r) => r.status === 'done').length,
      0,
    );
    try {
      const reverted = await db.run(
        sql`UPDATE orders SET status = ${order.status}, updated_at = unixepoch()
            WHERE id = ${order.id} AND status = 'refunded'
              AND (SELECT COUNT(*) FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE order_id = ${order.id}) AND status = 'done') = ${doneRefundsBefore}`,
      );
      if (Number(reverted.rowsAffected) === 0) {
        console.error('[funding-cancel] 선점을 되돌리지 않았다 — 그 사이 환불이 기록됐다(웹훅 대사로 추정)', {
          orderNo: order.orderNo, doneRefundsBefore,
        });
      }
    } catch (revertError) {
      console.error('[funding-cancel] 선점 revert 실패 — 수동 복구 필요', { orderNo: order.orderNo, error: revertError });
    }
    await db.insert(refunds).values({ paymentId: payment!.id, amount: refundAmount, reason: input.reason, requestedBy: input.requestedBy, status: 'failed' });
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    console.error('[funding-cancel] 토스 취소 실패', { orderNo: order.orderNo, code: toss.code, message: toss.message });
    // 이 message는 **후원자 셀프 취소 응답 본문에 그대로 실린다.** 가상계좌 거절의 기본
    // 문구는 고객용이고(toss.ts), 운영 지시는 관리자가 요청했을 때만 바꿔 단다.
    const adminOnly = toss.code === VIRTUAL_ACCOUNT_ERROR_CODE && input.requestedBy === 'admin';
    return {
      ok: false, code: 'toss_failed',
      message: internal ? GENERIC : adminOnly ? VIRTUAL_ACCOUNT_CANCEL_ADMIN_MESSAGE : toss.message,
    };
  }
  try {
    await db.insert(refunds).values({
      paymentId: payment!.id, amount: refundAmount, reason: input.reason, requestedBy: input.requestedBy,
      tossTransactionKey: toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null, status: 'done',
    });
  } catch (error) {
    console.error('[funding-cancel] 환불 완료, 기록 실패 — 웹훅 CANCELED 동기화가 보정', { orderNo: order.orderNo, error });
    return { ok: false, code: 'recording_failed', message: '환불은 완료되었으나 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.' };
  }
  await notifyCancelled(db, order, project, 'refunded', refundAmount);
  return { ok: true, mode: 'refunded', refundAmount };
};
