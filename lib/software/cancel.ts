import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SOFTWARE_SELF_CANCEL_DAYS } from '../../data/software/policy';
import { remainingRefundable, settleRefund, type CancelInput } from '../booking/cancel';
import { isBankDepositPayment } from '../payments/bankDeposit';
import { sendSoftwareCancelledEmails } from './email';
import { findSoftwareOrder, type SoftwareOrderWithDetails } from './order';

/**
 * 소프트웨어 주문 환불 — **전액만.** 돈을 움직이는 구간은 예약·상점과 같은 `settleRefund`(멱등키·잔액 상한·실패 기록 한 벌).
 *
 * - **고객**: 결제 뒤 `SOFTWARE_SELF_CANCEL_DAYS`일 안, 그리고 라이선스를 **한 번도 활성화하지 않았을 때만.** 활성화가 디지털콘텐츠
 *   제공 개시라 그 뒤의 단순 변심 철회는 제한된다(결제 화면에서 고지·동의 — `software_orders.withdrawal_ack_at`).
 * - **운영자**: 언제든(하자·분쟁 대응). 활성화 여부는 관리자 화면이 보여 준다.
 *
 * 선점은 라이선스를 `refunded`로 바꾸는 UPDATE다. 고객 경로는 WHERE에 "활성화 기록 없음"을 함께 건다 — 활성화 API도
 * `status='active'`인 라이선스에만 자리를 내주므로(lib/software/service.ts), 둘이 겹치면 어느 쪽이 먼저든 다른 쪽은 0행이다.
 * 토스가 거절하면 선점을 되돌린다.
 */

export type SoftwareCancelOutcome =
  | { ok: true; refundAmount: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'activated' | 'expired_window' | 'toss_failed' | 'recording_failed' | 'temporarily_unavailable'; message: string };

const ACTIVATED_MESSAGE =
  '라이선스를 활성화한 주문은 여기서 환불할 수 없어요(전자상거래법 제17조 제2항 제5호). 설치·동작에 문제가 있으면 카카오톡이나 010-4255-7893으로 알려 주세요.';
const WINDOW_MESSAGE = `결제 후 ${SOFTWARE_SELF_CANCEL_DAYS}일이 지나 여기서는 환불할 수 없어요. 카카오톡이나 010-4255-7893으로 문의해 주세요.`;

const DAY_MS = 24 * 60 * 60 * 1000;

const paidAtOf = (order: SoftwareOrderWithDetails): Date => order.payments[0]?.approvedAt ?? order.createdAt;

/** 고객이 지금 셀프 환불할 수 있는가 — manage 화면의 버튼 표시와 API 판정이 같은 함수를 쓴다. */
export const softwareSelfCancelBlocker = (order: SoftwareOrderWithDetails, now: Date): 'activated' | 'expired_window' | 'invalid_state' | null => {
  if (order.status !== 'paid') return 'invalid_state';
  if (order.licenses.some((l) => l.firstActivatedAt !== null)) return 'activated';
  if (now.getTime() - paidAtOf(order).getTime() > SOFTWARE_SELF_CANCEL_DAYS * DAY_MS) return 'expired_window';
  return null;
};

const rowsAffectedOf = (result: unknown): number => (result as { rowsAffected?: number } | undefined)?.rowsAffected ?? 0;

export const cancelSoftwareOrder = async (input: {
  orderNo: string;
  requestedBy: 'customer' | 'admin';
  reason: string;
  now: Date;
}): Promise<SoftwareCancelOutcome> => {
  const order = await findSoftwareOrder(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    return { ok: false, code: 'invalid_state', message: '이미 환불됐거나 결제가 끝나지 않은 주문이에요.' };
  }
  const customer = input.requestedBy === 'customer';
  if (customer) {
    const blocker = softwareSelfCancelBlocker(order, input.now);
    if (blocker === 'activated') return { ok: false, code: 'activated', message: ACTIVATED_MESSAGE };
    if (blocker === 'expired_window') return { ok: false, code: 'expired_window', message: WINDOW_MESSAGE };
    if (blocker) return { ok: false, code: 'invalid_state', message: '여기서는 환불할 수 없는 주문이에요. 010-4255-7893으로 문의해 주세요.' };
  }
  const payment = order.payments[0];
  if (!payment || isBankDepositPayment(payment)) {
    console.error('[software-cancel] 토스 결제 행이 없는 소프트웨어 주문', { orderNo: order.orderNo });
    return { ok: false, code: 'invalid_state', message: '결제 기록을 찾지 못했어요. 010-4255-7893으로 문의해 주세요.' };
  }

  const db = getDb();
  // 선점 — 라이선스가 없는 주문(발급 전 장애)은 선점할 것 없이 환불만 한다(운영자 경로에서만 생긴다).
  const previous = order.licenses.map((l) => ({ id: l.id, status: l.status }));
  let claimed = false;
  if (previous.length > 0) {
    const claim = await db.run(sql`
      UPDATE software_licenses SET status = 'refunded', revoked_at = unixepoch()
      WHERE order_no = ${order.orderNo} AND status <> 'refunded'
      ${customer ? sql`AND status = 'active' AND first_activated_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM software_activations a WHERE a.license_id = software_licenses.id)` : sql``}
    `);
    claimed = rowsAffectedOf(claim) > 0;
    if (!claimed) {
      if (customer) {
        // 읽은 뒤에 활성화가 먼저 들어왔을 수 있다 — 문구를 맞춘다.
        const fresh = await findSoftwareOrder(order.orderNo).catch(() => null);
        if (fresh?.licenses.some((l) => l.firstActivatedAt !== null)) return { ok: false, code: 'activated', message: ACTIVATED_MESSAGE };
        return { ok: false, code: 'invalid_state', message: '방금 상태가 바뀌었어요. 화면을 새로고침해 주세요.' };
      }
      // 운영자: 이미 전부 refunded — 돈만 남았을 수 있으니 계속 진행한다(잔액 상한이 이중 환불을 막는다).
    }
  }

  const revertClaim = claimed
    ? async (): Promise<void> => {
        try {
          for (const l of previous) {
            await db.run(sql`UPDATE software_licenses SET status = ${l.status}, revoked_at = NULL WHERE id = ${l.id} AND status = 'refunded'`);
          }
        } catch (error) {
          console.error('[software-cancel] 선점 되돌리기 실패 — 수동 복구 필요', { orderNo: order.orderNo, error });
        }
      }
    : null;

  const remaining = remainingRefundable(order, order.payments);
  if (remaining <= 0) {
    if (revertClaim) await revertClaim();
    return { ok: false, code: 'invalid_state', message: '환불할 금액이 남아 있지 않아요.' };
  }

  const cancelInput: CancelInput = { orderNo: order.orderNo, requestedBy: input.requestedBy, reason: input.reason, now: input.now };
  const failure = await settleRefund({
    order, payment, refundAmount: remaining, remaining, input: cancelInput, revertClaim,
    recordFailureLog: '[software-cancel] 소프트웨어 환불 완료, DB 기록 실패',
  });
  if (failure) {
    const code = failure.code === 'not_found' ? 'invalid_state' : failure.code;
    return { ok: false, code, message: failure.message };
  }

  await sendSoftwareCancelledEmails(order.orderNo, remaining, input.requestedBy);
  return { ok: true, refundAmount: remaining };
};

/** 토스 쪽에서 전액 취소된 주문(웹훅 CANCELED)의 라이선스를 닫는다 — 돈이 다 돌아간 주문의 키로 새 기기를 받지 않게. */
export const refundLicensesOnFullCancel = async (orderNo: string): Promise<void> => {
  try {
    await getDb().run(sql`
      UPDATE software_licenses SET status = 'refunded', revoked_at = COALESCE(revoked_at, unixepoch())
      WHERE order_no = ${orderNo} AND status <> 'refunded'
    `);
  } catch (error) {
    console.error('[software-webhook] 전액 취소 뒤 라이선스 닫기 실패', { orderNo, error });
  }
};
