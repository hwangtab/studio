import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, type FundingPledge, type Order, type Payment } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { generateManageToken } from '../booking/token';
import { computeFundingAmounts, type FundingAmounts } from './amounts';
import { BANK_HOLD_SECONDS, TOSS_HOLD_SECONDS } from './policy';
import type { FundingProject, FundingReward } from './projects';
import type { CreatePledgePayload } from './validation';

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

export const generateFundingOrderNo = (now: Date, manual = false): string =>
  `FND-${manual ? 'M-' : ''}${kstDateString(now).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

export type FundingOrder = Order & { fundingPledge: FundingPledge | null; payments: Payment[] };

export const findFundingOrderByOrderNo = async (orderNo: string): Promise<FundingOrder | undefined> => {
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.orderNo, orderNo),
    with: { fundingPledge: true, payments: true },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

export const findFundingOrderById = async (id: string): Promise<FundingOrder | undefined> => {
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, id),
    with: { fundingPledge: true, payments: true },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

/**
 * 재고 조건이 붙은 단일 INSERT — 동시 요청은 한쪽만 rowsAffected 1.
 * remaining = totalQuantity − Σpaid − Σ(pending ∧ hold 미만료). 무제한이면 조건 없음.
 */
export const createFundingPledge = async (
  payload: CreatePledgePayload, project: FundingProject, reward: FundingReward, now: Date,
): Promise<{ ok: true; orderNo: string; manageToken: string; holdExpiresAt: Date; amounts: FundingAmounts } | { ok: false; code: 'sold_out' }> => {
  const db = getDb();
  const amounts = computeFundingAmounts(reward.amount, payload.quantity, payload.additionalAmount);
  const orderNo = generateFundingOrderNo(now);
  const manageToken = generateManageToken();
  const holdSeconds = payload.paymentMethod === 'toss' ? TOSS_HOLD_SECONDS : BANK_HOLD_SECONDS;
  const holdExpiresAt = new Date(now.getTime() + holdSeconds * 1000);

  // 자기 홀드 해제 — 위저드에서 되돌아가 재제출한 같은 고객의 pending 펀딩 주문을 만료시킨다.
  // 무통장(bank_transfer) pending은 제외 — 이미 입금했을 수 있어 재제출만으로 만료시키면 안 된다.
  await db.run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'funding' AND status = 'pending'
      AND customer_email = ${payload.customerEmail} AND customer_phone = ${payload.customerPhone}
      AND id IN (SELECT order_id FROM funding_pledges WHERE project_slug = ${project.slug} AND payment_method != 'bank_transfer')
  `);

  const [order] = await db.insert(orders).values({
    orderNo, type: 'funding',
    customerName: payload.customerName, customerPhone: payload.customerPhone, customerEmail: payload.customerEmail,
    itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
    manageToken,
  }).returning({ id: orders.id });

  const pledgeId = randomUUID().replace(/-/g, '');
  const s = payload.shipping;
  const stockCondition = reward.totalQuantity === null
    ? sql`1 = 1`
    : sql`(
        SELECT COALESCE(SUM(fp.quantity), 0) FROM funding_pledges fp
        JOIN orders o ON o.id = fp.order_id
        WHERE fp.project_slug = ${project.slug} AND fp.reward_id = ${reward.id}
          AND (o.status = 'paid' OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
      ) + ${payload.quantity} <= ${reward.totalQuantity}`;

  const result = await db.run(sql`
    INSERT INTO funding_pledges (
      id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount,
      payment_method, hold_expires_at, supporter_message, display_name_public,
      shipping_name, shipping_phone, shipping_postcode, shipping_address1, shipping_address2, shipping_memo
    )
    SELECT ${pledgeId}, ${order.id}, ${project.slug}, ${reward.id}, ${reward.title}, ${reward.amount},
           ${payload.quantity}, ${payload.additionalAmount}, ${payload.paymentMethod}, ${toEpoch(holdExpiresAt)},
           ${payload.supporterMessage ?? null}, ${payload.displayNamePublic ? 1 : 0},
           ${s?.name ?? null}, ${s?.phone ?? null}, ${s?.postcode ?? null}, ${s?.address1 ?? null}, ${s?.address2 ?? null}, ${s?.memo ?? null}
    WHERE ${stockCondition}
  `);

  if (Number(result.rowsAffected) === 0) {
    await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    return { ok: false, code: 'sold_out' };
  }
  return { ok: true, orderNo, manageToken, holdExpiresAt, amounts };
};

/** 홀드가 지난 pending 펀딩 주문을 expired로. 상태 API·생성·관리자 목록·confirm 진입에서 lazy 호출. */
export const expireStalePledges = async (now: Date): Promise<void> => {
  await getDb().run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'funding' AND status = 'pending'
      AND id IN (SELECT order_id FROM funding_pledges WHERE hold_expires_at < ${toEpoch(now)})
  `);
};

export interface ProjectStatus {
  raisedAmount: number; backerCount: number; remaining: Record<string, number | null>; publicBackers: string[];
}

export const aggregateProjectStatus = async (project: FundingProject, now: Date): Promise<ProjectStatus> => {
  const db = getDb();
  const totals = await db.all<{ raised: number | null; backers: number | null }>(sql`
    SELECT SUM(o.total_amount) AS raised, COUNT(*) AS backers
    FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status = 'paid'
  `);
  const claimed = await db.all<{ reward_id: string; qty: number }>(sql`
    SELECT fp.reward_id, SUM(fp.quantity) AS qty
    FROM funding_pledges fp JOIN orders o ON o.id = fp.order_id
    WHERE fp.project_slug = ${project.slug}
      AND (o.status = 'paid' OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
    GROUP BY fp.reward_id
  `);
  const claimedBy = new Map(claimed.map((r) => [r.reward_id, Number(r.qty)]));
  const remaining: Record<string, number | null> = {};
  for (const r of project.rewards) {
    remaining[r.id] = r.totalQuantity === null ? null : Math.max(0, r.totalQuantity - (claimedBy.get(r.id) ?? 0));
  }
  const names = await db.all<{ customer_name: string }>(sql`
    SELECT o.customer_name FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status = 'paid' AND fp.display_name_public = 1
    ORDER BY fp.paid_at DESC, o.created_at DESC LIMIT 100
  `);
  return {
    raisedAmount: Number(totals[0]?.raised ?? 0),
    backerCount: Number(totals[0]?.backers ?? 0),
    remaining,
    publicBackers: names.map((n) => n.customer_name),
  };
};
