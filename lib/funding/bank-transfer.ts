import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders } from '../../db/schema';
import { sendFundingConfirmedEmails } from './email';
import { getFundingProject } from './projects';
import { findFundingOrderById } from './service';

/** 관리자 입금 확인. pending뿐 아니라 expired(기한 초과 입금)도 되살린다 — 무통장은 무제한 리워드뿐이라 재고 재검증이 필요 없다. */
export const confirmBankDeposit = async (input: { orderId: string; now: Date }): Promise<{ ok: true } | { ok: false; code: 'not_found' | 'invalid_state'; message: string }> => {
  const order = await findFundingOrderById(input.orderId);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '후원을 찾을 수 없습니다.' };
  if (order.fundingPledge.paymentMethod !== 'bank_transfer') return { ok: false, code: 'invalid_state', message: '무통장 후원이 아닙니다.' };
  const db = getDb();
  const claim = await db.run(sql`
    UPDATE orders SET status = 'paid', updated_at = unixepoch()
    WHERE id = ${order.id} AND status IN ('pending', 'expired')
  `);
  if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '입금 확인할 수 있는 상태가 아닙니다.' };
  await db.update(fundingPledges).set({ paidAt: input.now, updatedAt: input.now }).where(eq(fundingPledges.id, order.fundingPledge.id));
  const fresh = (await findFundingOrderById(order.id)) ?? order;
  const emailError = await sendFundingConfirmedEmails(fresh, getFundingProject(fresh.fundingPledge?.projectSlug ?? ''));
  if (emailError) await db.update(orders).set({ notificationError: emailError }).where(eq(orders.id, order.id));
  return { ok: true };
};
