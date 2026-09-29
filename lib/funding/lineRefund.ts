import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refunds } from '../../db/schema';
import { cancelPayment } from '../booking/toss';
import { sendFundingLineRefundEmails } from './email';
import { pledgeLines } from './pledgeLines';
import { getFundingProjectAsync } from './repository';
import { liveFundingOrderStatusList, remainingRefundable } from './refundable';
import { findFundingOrderByOrderNo } from './service';

/**
 * **줄 단위 부분 환불** — 한 주문에 담긴 리워드 중 하나(의 일부 수량)만 돌려준다. 관리자 전용.
 *
 * 한 주문에 여러 리워드를 담게 되면서(0042) "책만 청약철회"가 생겼는데, 취소는 주문 전체만
 * 됐다. 토스 콘솔에서 금액으로 부분 취소하면 돈은 맞아도 **어느 리워드를 돌려줬는지**가 어디에도
 * 없어서, 그 책이 재고로 돌아오지 않고 배송 목록에도 남았다.
 *
 * 순서는 cancel.ts와 같은 "선점 → 토스 → 기록"이다.
 * 1. **선점**: 줄의 `refunded_quantity`를 먼저 올린다. WHERE에 "남은 수량이 충분하다"와 "주문이
 *    살아 있다"를 실어 두 관리자가 같은 줄을 동시에 눌러도 한쪽만 이긴다. 줄이 없는 옛 후원은
 *    같은 batch에서 옛 칸을 줄로 옮겨 담은 뒤 선점한다(이후 그 후원은 줄 표를 읽는다).
 * 2. **토스 부분 취소**: 금액 = 단가 × 수량. 멱등 키에 "이 줄의 누적 환불 수량"을 넣어, 같은
 *    요청의 재시도는 한 번만 나가고 다음 환불은 새 키가 된다.
 * 3. **기록**: 환불 행은 웹훅 동기화(syncFundingCancelledFromToss)와 같은 **델타 INSERT**로 쓴다
 *    — 토스 응답의 누적 취소액에서 이미 기록된 합을 뺀 만큼만. 웹훅이 먼저 도착해 기록했어도
 *    이중으로 남지 않는다.
 *
 * 토스가 **확실히 거절**하면(응답이 온 실패) 선점을 되돌린다. 응답을 못 받은 실패(네트워크·
 * 타임아웃)는 "취소는 됐는데 응답만 늦었다"일 수 있어 되돌리지 않는다 — 되돌리면 돈은 나갔는데
 * 리워드가 다시 살아난다. 그 경우는 운영자에게 확인을 요청한다(웹훅이 금액을 맞춘다).
 *
 * 계좌(수기) 후원은 다루지 않는다 — 토스 결제가 없어 환불 행을 달 자리가 없고, 금액 기록 없이
 * 수량만 줄이면 잔액 계산(remainingRefundable)과 어긋난다.
 */

export type LineRefundOutcome =
  | { ok: true; amount: number; orderStatus: 'paid' | 'partially_refunded' | 'refunded' }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'invalid_quantity' | 'offline_payment' | 'toss_failed' | 'toss_unknown'; message: string };

export const refundFundingLine = async (input: {
  orderNo: string; rewardId: string; quantity: number; reason: string;
}): Promise<LineRefundOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  const pledge = order?.fundingPledge;
  if (!order || !pledge) return { ok: false, code: 'not_found', message: '펀딩 내역을 찾을 수 없습니다.' };
  if (order.status !== 'paid' && order.status !== 'partially_refunded') {
    return { ok: false, code: 'invalid_state', message: '결제가 살아 있는 펀딩만 일부 환불할 수 있습니다.' };
  }
  if (pledge.paymentMethod !== 'toss') {
    return { ok: false, code: 'offline_payment', message: '계좌로 받은 후원은 일부 환불을 기록할 수 없습니다. 계좌로 송금한 뒤 전액 환불 기록이나 관리자 메모로 남겨 주세요.' };
  }

  const line = pledgeLines(pledge).find((l) => l.rewardId === input.rewardId);
  if (!line) return { ok: false, code: 'not_found', message: '이 후원에 담긴 리워드가 아닙니다.' };
  const available = line.quantity - line.refundedQuantity;
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > available) {
    return { ok: false, code: 'invalid_quantity', message: `환불할 수 있는 수량은 1~${available}개입니다.` };
  }
  const amount = line.unitAmount * input.quantity;
  if (amount > remainingRefundable(order)) {
    return { ok: false, code: 'invalid_state', message: '환불 가능한 잔액보다 큽니다. 이미 환불된 금액을 확인해 주세요.' };
  }

  // cancel.ts와 같은 규칙으로 취소를 걸 결제 행을 고른다.
  const doneRefundedOn = (p: (typeof order.payments)[number]): number =>
    (p.refunds ?? []).filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
  const payment = order.payments.find((p) => doneRefundedOn(p) < order.totalAmount) ?? order.payments[order.payments.length - 1];
  if (!payment) return { ok: false, code: 'invalid_state', message: '결제 기록이 없는 펀딩입니다.' };

  const db = getDb();
  const hasItems = (pledge.items?.length ?? 0) > 0;
  const statements = [];
  if (!hasItems) {
    // 옛 후원 — 옛 칸을 줄 하나로 옮겨 담는다. 이후 pledgeLines는 이 줄을 읽는다.
    statements.push(db.run(sql`
      INSERT INTO funding_pledge_items (id, pledge_id, position, reward_id, reward_title, unit_amount, quantity)
      SELECT ${randomUUID().replace(/-/g, '')}, fp.id, 0, fp.reward_id, fp.reward_title, fp.unit_amount, fp.quantity
      FROM funding_pledges fp
      WHERE fp.id = ${pledge.id} AND NOT EXISTS (SELECT 1 FROM funding_pledge_items i WHERE i.pledge_id = fp.id)
    `));
  }
  statements.push(db.run(sql`
    UPDATE funding_pledge_items SET refunded_quantity = refunded_quantity + ${input.quantity}
    WHERE pledge_id = ${pledge.id} AND reward_id = ${input.rewardId}
      AND quantity - refunded_quantity >= ${input.quantity}
      AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status IN (${liveFundingOrderStatusList()}))
  `));
  const claimed = await db.batch(statements as [typeof statements[number], ...typeof statements]);
  if (Number(claimed[claimed.length - 1].rowsAffected) === 0) {
    return { ok: false, code: 'invalid_state', message: '이미 처리됐거나 남은 수량이 부족합니다. 새로고침해 주세요.' };
  }

  const refundedAfter = line.refundedQuantity + input.quantity;
  const toss = await cancelPayment({
    paymentKey: payment.paymentKey,
    cancelReason: input.reason,
    cancelAmount: amount,
    idempotencyKey: `line-refund:${order.orderNo}:${input.rewardId}:${refundedAfter}`,
    paymentMethod: payment.method,
  });

  if (!toss.ok) {
    // 응답을 못 받았다 — 취소가 됐을 수 있다. 선점을 두고 운영자에게 확인을 맡긴다.
    if (toss.code === 'NETWORK_ERROR') {
      console.error('[funding-line-refund] 토스 응답 없음 — 선점 유지, 확인 필요', { orderNo: order.orderNo, rewardId: input.rewardId, amount });
      return {
        ok: false, code: 'toss_unknown',
        message: '토스 응답을 받지 못했습니다. 토스 콘솔에서 취소 여부를 확인해 주세요. 취소됐다면 기록은 곧 자동으로 맞춰집니다.',
      };
    }
    try {
      await db.run(sql`
        UPDATE funding_pledge_items SET refunded_quantity = refunded_quantity - ${input.quantity}
        WHERE pledge_id = ${pledge.id} AND reward_id = ${input.rewardId} AND refunded_quantity >= ${input.quantity}
      `);
    } catch (error) {
      console.error('[funding-line-refund] 선점 되돌리기 실패 — 수동 복구 필요', { orderNo: order.orderNo, rewardId: input.rewardId, error });
    }
    await db.insert(refunds).values({ paymentId: payment.id, amount, reason: input.reason, requestedBy: 'admin', status: 'failed' });
    console.error('[funding-line-refund] 토스 부분 취소 거절', { orderNo: order.orderNo, code: toss.code, message: toss.message });
    return { ok: false, code: 'toss_failed', message: toss.message };
  }

  // 토스가 말한 누적 취소액 − 이미 기록된 합. 웹훅이 먼저 기록했으면 0행이다.
  const cancelledTotal = toss.payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? amount;
  await db.run(sql`
    INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
    SELECT lower(hex(randomblob(16))), ${payment.id},
           ${cancelledTotal} - COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0),
           ${input.reason}, 'admin', ${toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null}, 'done'
    WHERE ${cancelledTotal} > COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id = ${payment.id} AND status = 'done'), 0)
  `);

  // 다시 읽어 상태를 정한다 — 잔액이 0이면 전액 환불, 아니면 부분 환불.
  const after = await findFundingOrderByOrderNo(order.orderNo);
  const orderStatus = after && remainingRefundable(after) <= 0 ? 'refunded' : 'partially_refunded';
  await db.run(sql`
    UPDATE orders SET status = ${orderStatus}, updated_at = unixepoch()
    WHERE id = ${order.id} AND status IN (${liveFundingOrderStatusList()})
  `);

  // 메일 실패가 환불을 뒤집지 않는다 — 기록만 남긴다.
  try {
    const fresh = await findFundingOrderByOrderNo(order.orderNo);
    const emailError = fresh
      ? await sendFundingLineRefundEmails(fresh, await getFundingProjectAsync(pledge.projectSlug), {
          rewardTitle: line.rewardTitle, quantity: input.quantity, amount, reason: input.reason,
        })
      : null;
    if (emailError) console.error('[funding-line-refund] 알림 메일 실패', { orderNo: order.orderNo, emailError });
  } catch (error) {
    console.error('[funding-line-refund] 알림 메일 예외', { orderNo: order.orderNo, error });
  }

  return { ok: true, amount, orderStatus };
};
