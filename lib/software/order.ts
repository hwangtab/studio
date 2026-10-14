import { randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SOFTWARE_SALES_OPEN } from '../../data/software/policy';
import { splitInclusiveAmount } from '../booking/amounts';
import { kstDateString } from '../booking/kst';
import { generateManageToken } from '../booking/token';
import { validateCustomerContact } from '../booking/validation';
import { getPublishedSoftware } from './catalog';

/**
 * 소프트웨어 주문(국내 토스 결제). 한 주문 = 상품 하나 = 라이선스 하나. 금액·상품명은 요청이 아니라 카탈로그에서만 읽는다.
 * 재고가 없으므로 홀드도 없다 — 결제창을 연 채 버려진 `pending`은 크론이 `expired`로 닫는다(관리자 목록 정리용).
 */

/** `SWR-YYYYMMDD-XXXXXXXX`(KST 날짜 + 대문자 hex). 토스 orderId로 그대로 쓴다. 경로의 소문자 308에 견디게 비교는 대문자로. */
export const generateSoftwareOrderNo = (now: Date): string =>
  `SWR-${kstDateString(now).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

export const SOFTWARE_ORDER_NO_PATTERN = /^SWR-\d{8}-[0-9A-F]{8}$/;

export const normalizeSoftwareOrderNo = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return SOFTWARE_ORDER_NO_PATTERN.test(upper) ? upper : null;
};

export type CreateSoftwareOrderResult =
  | { ok: true; orderNo: string; totalAmount: number; orderName: string }
  | { ok: false; code: 'sales_closed' | 'unknown_item' | 'withdrawal_ack_required'; message?: string }
  | { ok: false; code: 'invalid_contact'; message: string };

export const createSoftwareOrder = async (
  body: Record<string, unknown>,
  now: Date,
  opts: { salesOpen?: boolean } = {},
): Promise<CreateSoftwareOrderResult> => {
  if (!(opts.salesOpen ?? SOFTWARE_SALES_OPEN)) return { ok: false, code: 'sales_closed' };
  const product = getPublishedSoftware(body.productSlug);
  // 지금 파는 가격(맨 앞)만 받는다 — 옛 가격 id로 싸게 사는 길을 막는다.
  const price = product?.prices?.[0];
  if (!product || !price || price.id !== body.priceId) return { ok: false, code: 'unknown_item' };
  // 청약철회 제한은 결제 전에 알리고 동의를 받아야 성립한다 — 동의 없는 주문은 만들지 않는다.
  if (body.withdrawalAck !== true) return { ok: false, code: 'withdrawal_ack_required' };
  const contact = validateCustomerContact(body);
  if (!contact.ok) return { ok: false, code: 'invalid_contact', message: contact.message };

  const { itemAmount, vatAmount, totalAmount } = splitInclusiveAmount(price.krw);
  const orderNo = generateSoftwareOrderNo(now);
  const nowSec = Math.floor(now.getTime() / 1000);
  const db = getDb();
  await db.batch([
    db.run(sql`
      INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
                          item_amount, vat_amount, total_amount, manage_token)
      VALUES (lower(hex(randomblob(16))), ${orderNo}, 'software', 'pending', ${contact.value.customerName}, ${contact.value.customerPhone},
              ${contact.value.customerEmail}, ${itemAmount}, ${vatAmount}, ${totalAmount}, ${generateManageToken()})
    `),
    db.run(sql`
      INSERT INTO software_orders (order_no, product_slug, price_id, product_title, unit_price, currency, withdrawal_ack_at)
      VALUES (${orderNo}, ${product.slug}, ${price.id}, ${product.title}, ${price.krw}, 'KRW', ${nowSec})
    `),
  ]);
  return { ok: true, orderNo, totalAmount, orderName: `${product.title} 라이선스`.slice(0, 100) };
};

/** 소프트웨어 주문 한 건 — 결제·환불 포함. 하위 표(software_orders·licenses)는 관계로 싣지 않고 따로 읽는다. */
export const findSoftwareOrder = async (orderNo: string) => {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (o, { and, eq }) => and(eq(o.orderNo, orderNo), eq(o.type, 'software')),
    with: { payments: { with: { refunds: true } } },
  });
  if (!order) return null;
  const item = await db.query.softwareOrders.findFirst({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
  const licenses = await db.query.softwareLicenses.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
  return { ...order, item: item ?? null, licenses };
};

export type SoftwareOrderWithDetails = NonNullable<Awaited<ReturnType<typeof findSoftwareOrder>>>;

/** 결제창을 연 뒤 1시간이 지나도 `pending`인 주문을 `expired`로(크론). 늦게 온 승인은 웹훅 신뢰 경로가 expired도 받는다. */
export const expireStaleSoftwareOrders = async (now: Date): Promise<number> => {
  const cutoff = Math.floor(now.getTime() / 1000) - 3600;
  const result = await getDb().run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'software' AND status = 'pending' AND created_at < ${cutoff}
  `);
  return Number(result.rowsAffected);
};
