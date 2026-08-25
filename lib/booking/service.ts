import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, type Booking, type Order, type Payment } from '../../db/schema';
import { computeAmounts } from './amounts';
import { kstDateTime } from './kst';
import { getProduct } from './products';
import { generateManageToken, generateOrderNo } from './token';
import type { CreateBookingPayload } from './validation';

export { rangesOverlap } from './overlap';

export const PENDING_HOLD_SECONDS = 900;

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

export const createBookingOrder = async (
  payload: CreateBookingPayload,
  now: Date,
): Promise<{ ok: true; orderNo: string; totalAmount: number; bookingId: string } | { ok: false; code: 'slot_taken' }> => {
  const db = getDb();
  const product = getProduct(payload.productId)!; // validation이 보장
  const hours = payload.hours!;
  const amounts = computeAmounts(product, hours);
  const startAt = kstDateTime(payload.date, payload.startHour);
  const endAt = kstDateTime(payload.date, payload.startHour + hours);
  const orderNo = generateOrderNo(now);
  const manageToken = generateManageToken();

  const [order] = await db
    .insert(orders)
    .values({
      orderNo, type: 'session',
      customerName: payload.customerName, customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
      manageToken,
    })
    .returning({ id: orders.id });

  // 겹침 검사 + INSERT를 한 문장으로 — 동시 요청은 한쪽만 rowsAffected 1.
  const bookingId = randomUUID().replace(/-/g, '');
  const result = await db.run(sql`
    INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status, customer_note)
    SELECT ${bookingId}, ${order.id}, ${product.id}, ${product.service},
           ${toEpoch(startAt)}, ${toEpoch(endAt)}, ${hours}, 'pending', ${payload.customerNote ?? null}
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.start_at < ${toEpoch(endAt)} AND b.end_at > ${toEpoch(startAt)}
        AND (b.status = 'confirmed'
             OR (b.status = 'pending' AND b.created_at > unixepoch() - ${PENDING_HOLD_SECONDS}))
    )
    AND NOT EXISTS (
      SELECT 1 FROM availability_blocks ab
      WHERE ab.start_at < ${toEpoch(endAt)} AND ab.end_at > ${toEpoch(startAt)}
    )
  `);

  if (Number(result.rowsAffected) === 0) {
    await db.run(sql`UPDATE orders SET status = 'failed' WHERE id = ${order.id} AND status = 'pending'`);
    return { ok: false, code: 'slot_taken' };
  }
  return { ok: true, orderNo, totalAmount: amounts.totalAmount, bookingId };
};

export const findOrderByOrderNo = async (
  orderNo: string,
): Promise<(Order & { bookings: Booking[]; payments: Payment[] }) | undefined> =>
  getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.orderNo, orderNo),
    with: { bookings: true, payments: true },
  });

/**
 * 결제가 오지 않은 선점을 정리한다. 슬롯 조회·관리자 목록에서 lazy 호출
 * (expireOverdueContracts 패턴). 두 UPDATE는 원자성이 필요 없다 — 겹침 검사가
 * 어차피 900초 지난 pending을 무시하므로, 이 정리는 표시용 상태 정합일 뿐이다.
 */
export const expireStaleOrders = async (now: Date): Promise<void> => {
  const db = getDb();
  const cutoff = toEpoch(now) - PENDING_HOLD_SECONDS;
  await db.run(sql`
    UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
    WHERE status = 'pending' AND created_at < ${cutoff}
  `);
  await db.run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE status = 'pending' AND created_at < ${cutoff}
  `);
};
