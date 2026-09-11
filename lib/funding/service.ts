import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, type FundingPledge, type Order, type Payment, type Refund } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { generateManageToken } from '../booking/token';
import { computeFundingAmounts, type FundingAmounts } from './amounts';
import { BANK_HOLD_SECONDS, FUNDING_TERMS_VERSION, TOSS_HOLD_SECONDS } from './policy';
import type { FundingProject, FundingReward } from './projects';
import type { CreatePledgePayload } from './validation';

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

/**
 * 같은 고객(이메일+전화)이 한 프로젝트에서 **같은 결제수단으로** 동시에 열어 둘 수 있는
 * 미만료 pending 홀드 수. 결제수단을 섞어 세면 무통장 대기 2건이 토스 후원까지 막는다.
 * 토스는 바로 위 자기 홀드 해제로 매번 0이 되므로, 실질적으로는 무통장 홀드 상한이다.
 */
export const MAX_OPEN_HOLDS_PER_CUSTOMER = 2;

export const generateFundingOrderNo = (now: Date, manual = false): string =>
  `FND-${manual ? 'M-' : ''}${kstDateString(now).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

/** payments 각각의 done/failed 환불까지 물고 온다 — 환불 잔액 계산(refundable.ts)이 전 결제행을 봐야 한다. */
export type FundingPaymentWithRefunds = Payment & { refunds?: Refund[] };
export type FundingOrder = Order & { fundingPledge: FundingPledge | null; payments: FundingPaymentWithRefunds[] };

export const findFundingOrderByOrderNo = async (orderNo: string): Promise<FundingOrder | undefined> => {
  // middleware.ts가 대문자 포함 경로를 소문자로 308 리다이렉트하므로, URL에서 온
  // orderNo는 소문자로 도착할 수 있다(generateFundingOrderNo는 항상 대문자만 생성) —
  // 대문자로 정규화해 비교한다. SQLite `=`는 대소문자 구분.
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.orderNo, orderNo.toUpperCase()),
    with: { fundingPledge: true, payments: { with: { refunds: true } } },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

export const findFundingOrderById = async (id: string): Promise<FundingOrder | undefined> => {
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, id),
    with: { fundingPledge: true, payments: { with: { refunds: true } } },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

/**
 * 재고 조건이 붙은 단일 INSERT — 동시 요청은 한쪽만 rowsAffected 1.
 * remaining = totalQuantity − Σ(paid ∨ partially_refunded) − Σ(pending ∧ hold 미만료). 무제한이면 조건 없음.
 * partially_refunded를 빼먹으면 aggregateProjectStatus(품절 표시)와 이 INSERT 조건이 어긋나,
 * 화면엔 품절인데 서버는 재고가 남았다고 보고 한정 리워드를 초과 판매한다.
 */
export const createFundingPledge = async (
  payload: CreatePledgePayload, project: FundingProject, reward: FundingReward, now: Date,
): Promise<{ ok: true; orderNo: string; manageToken: string; holdExpiresAt: Date; amounts: FundingAmounts } | { ok: false; code: 'sold_out' | 'too_many_bank_holds' }> => {
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

  // 한 사람이 결제 대기(pending) 홀드를 무한정 쌓아 한정 리워드 재고를 잠그는 것을 막는다.
  // 위 자기 홀드 해제는 toss pending만 푼다(무통장은 이미 입금했을 수 있어 못 푼다) — 그래서
  // 무통장으로 반복 제출하면 12시간짜리 홀드가 계속 쌓여 재고가 통째로 묶인다.
  // 해제 뒤에 세므로, 정상적인 위저드 되돌아가기·재제출은 걸리지 않는다.
  const [openHolds] = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM orders o
    JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE o.type = 'funding' AND o.status = 'pending'
      AND o.customer_email = ${payload.customerEmail} AND o.customer_phone = ${payload.customerPhone}
      AND fp.project_slug = ${project.slug} AND fp.payment_method = ${payload.paymentMethod}
      AND fp.hold_expires_at > ${toEpoch(now)}
  `);
  if (Number(openHolds?.n ?? 0) >= MAX_OPEN_HOLDS_PER_CUSTOMER) {
    return { ok: false, code: 'too_many_bank_holds' };
  }

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
          AND (o.status IN ('paid', 'partially_refunded') OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
      ) + ${payload.quantity} <= ${reward.totalQuantity}`;

  // terms_agreed_at을 now로 적는 근거: validateCreatePledgePayload가 termsAgreed !== true를
  // 먼저 막으므로(lib/funding/validation.ts), 이 지점에 온 요청은 동의를 마친 요청뿐이다.
  const result = await db.run(sql`
    INSERT INTO funding_pledges (
      id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount,
      payment_method, hold_expires_at, supporter_message, display_name_public,
      shipping_name, shipping_phone, shipping_postcode, shipping_address1, shipping_address2, shipping_memo,
      terms_agreed_at, terms_version
    )
    SELECT ${pledgeId}, ${order.id}, ${project.slug}, ${reward.id}, ${reward.title}, ${reward.amount},
           ${payload.quantity}, ${payload.additionalAmount}, ${payload.paymentMethod}, ${toEpoch(holdExpiresAt)},
           ${payload.supporterMessage ?? null}, ${payload.displayNamePublic ? 1 : 0},
           ${s?.name ?? null}, ${s?.phone ?? null}, ${s?.postcode ?? null}, ${s?.address1 ?? null}, ${s?.address2 ?? null}, ${s?.memo ?? null},
           ${toEpoch(now)}, ${FUNDING_TERMS_VERSION}
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

/**
 * partially_refunded는 paid와 같이 집계한다 — 리워드 일부만 환불한 건이라 후원 자체는 살아
 * 있고, 리워드 재고도 여전히 나간 상태다. 모금액은 엄밀히는 total_amount − Σ(done 환불)이
 * 정확하지만, 그 차감은 payments/refunds 조인이 필요해 이 집계(핫 경로, 상태 API가 폴링)를
 * 무겁게 만든다. 부분환불은 드물고 오차는 하향이 아니라 상향이라, 지금은 total_amount를
 * 그대로 더한다.
 */
export const aggregateProjectStatus = async (project: FundingProject, now: Date): Promise<ProjectStatus> => {
  const db = getDb();
  const totals = await db.all<{ raised: number | null; backers: number | null }>(sql`
    SELECT SUM(o.total_amount) AS raised, COUNT(*) AS backers
    FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status IN ('paid', 'partially_refunded')
  `);
  const claimed = await db.all<{ reward_id: string; qty: number }>(sql`
    SELECT fp.reward_id, SUM(fp.quantity) AS qty
    FROM funding_pledges fp JOIN orders o ON o.id = fp.order_id
    WHERE fp.project_slug = ${project.slug}
      AND (o.status IN ('paid', 'partially_refunded') OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
    GROUP BY fp.reward_id
  `);
  const claimedBy = new Map(claimed.map((r) => [r.reward_id, Number(r.qty)]));
  const remaining: Record<string, number | null> = {};
  for (const r of project.rewards) {
    remaining[r.id] = r.totalQuantity === null ? null : Math.max(0, r.totalQuantity - (claimedBy.get(r.id) ?? 0));
  }
  const names = await db.all<{ customer_name: string }>(sql`
    SELECT o.customer_name FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status IN ('paid', 'partially_refunded') AND fp.display_name_public = 1
    ORDER BY fp.paid_at DESC, o.created_at DESC LIMIT 100
  `);
  return {
    raisedAmount: Number(totals[0]?.raised ?? 0),
    backerCount: Number(totals[0]?.backers ?? 0),
    remaining,
    publicBackers: names.map((n) => n.customer_name),
  };
};
