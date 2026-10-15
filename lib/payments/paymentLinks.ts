import { randomBytes } from 'node:crypto';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { availabilityBlocks, paymentLinks } from '../../db/schema';
import { getPaymentLink, type PaymentLink } from '../../data/paymentLinks';
import { kstDateString } from '../booking/kst';
import { PAYMENT_LINK_SLUG_PATTERN, type PaymentLinkInput } from './paymentLinkRules';
import { safeDbErrorSummary } from './refundAccount';

export { PAYMENT_LINK_LIMITS, PAYMENT_LINK_SLUG_PATTERN, validatePaymentLinkInput, type PaymentLinkInput } from './paymentLinkRules';

/**
 * 예약금·맞춤 결제 링크(`/ko/pay/<slug>`)의 조회·발급·닫기.
 *
 * 링크 정의는 DB 표 `payment_links`가 정본이다(관리자 `/admin/payment-links`·`scripts/pay-link.mjs`가 만든다 — 배포 없이 즉시 열린다).
 * 표가 생기기 전의 링크는 `data/paymentLinks.ts` 파일에 남아 있고 **계속 동작한다** — 조회는 DB → 파일 순서다. 새 표가 없는 DB
 * (마이그레이션 0060 전)에서는 조회가 파일로만 돈다(조회 실패를 삼키고 파일로 내려간다).
 *
 * **금액·품목명은 여기서만 읽는다**(주문 API는 클라이언트가 보낸 금액을 받지 않는다). **발급한 링크의 금액은 바꾸지 않는다** —
 * 결제 기록과 어긋난다. 틀렸으면 닫고 새로 만든다. 금액은 **VAT 포함 총액**이다(2026-10-15 사고: 상품가에 VAT를 한 번 더 얹어
 * 275,000원 링크를 만들었다 — 관리자 화면이 공급가·VAT를 풀어서 보여 주는 이유).
 */

/** DB 링크의 열림 판정 — 닫히지 않았고 만료일(KST) 당일 끝까지. */
const isOpenRow = (row: { closedAt: number | null; expiresOn: string | null }, now: Date): boolean =>
  row.closedAt === null && !(row.expiresOn && kstDateString(now) > row.expiresOn);

/**
 * 유효한 링크만 돌려준다 — 없는 slug·닫힌·만료된 링크는 null. DB(표가 없으면 건너뜀) → 파일 순서.
 * `/pay/[slug]` 페이지·주문 API·실패 화면이 같은 함수를 쓴다.
 */
export const findPaymentLink = async (slug: unknown, now: Date = new Date()): Promise<PaymentLink | null> => {
  if (typeof slug !== 'string' || !PAYMENT_LINK_SLUG_PATTERN.test(slug)) return null;
  try {
    const row = await getDb().query.paymentLinks.findFirst({ where: (t, { eq: equals }) => equals(t.slug, slug) });
    if (row) {
      return isOpenRow(row, now)
        ? {
            itemName: row.itemName, totalAmount: row.totalAmount, ...(row.expiresOn ? { expiresOn: row.expiresOn } : {}),
            ...(row.sessionAt !== null && row.sessionHours !== null ? { sessionAt: row.sessionAt, sessionHours: row.sessionHours } : {}),
          }
        : null;
    }
  } catch (error) {
    // 표가 없는 DB(0060 전)·일시 장애 — 파일 링크로 내려간다. DB에만 있는 링크는 이때 못 연다(그래서 로그를 남긴다).
    console.error('[payment-links] DB 조회 실패 — 파일 링크로 대신한다', { error: safeDbErrorSummary(error) });
  }
  return getPaymentLink(slug, now);
};

export interface PaymentLinkListRow {
  slug: string;
  itemName: string;
  totalAmount: number;
  expiresOn: string | null;
  memo: string | null;
  closedAt: number | null;
  createdAt: number;
  open: boolean;
  sessionAt: number | null;
  sessionHours: number | null;
  /** 이 링크가 만든 슬롯 차단이 아직 걸려 있는가. */
  blocked: boolean;
}

/**
 * 새 링크를 만든다. slug는 서버가 만든다(추측 불가 24자리 hex).
 *
 * 이용 일시·시간이 있고 `blockSlot`이면 같은 batch에서 **"예약 불가 블록"**(`availability_blocks`, 녹음실)을 함께 만든다 — 링크를 받은
 * 고객이 결제하기 전에도 그 시간대를 웹에서 다른 사람이 예약하지 못한다(이중 예약 방지, 2026-10-15). 블록은 링크를 결제 없이
 * 닫으면 같이 지운다(`closePaymentLink`). 연습실 방은 막지 않는다(`room_number` NULL = 녹음실만).
 */
export const createPaymentLink = async (input: PaymentLinkInput): Promise<{ slug: string; blockId: string | null }> => {
  const db = getDb();
  const slug = randomBytes(12).toString('hex');
  const blockId = input.blockSlot && input.sessionAt !== null && input.sessionHours !== null ? randomBytes(16).toString('hex') : null;
  const linkInsert = db.insert(paymentLinks).values({
    slug, itemName: input.itemName, totalAmount: input.totalAmount, expiresOn: input.expiresOn, memo: input.memo,
    sessionAt: input.sessionAt, sessionHours: input.sessionHours, blockId,
  });
  if (blockId && input.sessionAt !== null && input.sessionHours !== null) {
    await db.batch([
      db.insert(availabilityBlocks).values({
        id: blockId,
        roomNumber: null,
        startAt: new Date(input.sessionAt * 1000),
        endAt: new Date((input.sessionAt + input.sessionHours * 3600) * 1000),
        memo: `결제 링크 · ${input.memo ?? input.itemName}`,
      }),
      linkInsert,
    ]);
  } else {
    await linkInsert;
  }
  return { slug, blockId };
};

export const listPaymentLinks = async (limit = 200, now: Date = new Date()): Promise<PaymentLinkListRow[]> => {
  const db = getDb();
  const rows = await db.select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt)).limit(limit);
  const blockIds = rows.map((r) => r.blockId).filter((id): id is string => Boolean(id));
  const alive = new Set<string>();
  if (blockIds.length > 0) {
    const found = await db.select({ id: availabilityBlocks.id }).from(availabilityBlocks).where(sql`${availabilityBlocks.id} IN (${sql.join(blockIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const f of found) alive.add(f.id);
  }
  return rows.map((r) => ({
    slug: r.slug, itemName: r.itemName, totalAmount: r.totalAmount, expiresOn: r.expiresOn, memo: r.memo,
    closedAt: r.closedAt, createdAt: r.createdAt, open: isOpenRow(r, now),
    sessionAt: r.sessionAt, sessionHours: r.sessionHours, blocked: r.blockId !== null && alive.has(r.blockId),
  }));
};

/**
 * 링크를 닫는다(되돌릴 수 없다 — 다시 열려면 새로 만든다). 이미 닫혔거나 없으면 `closed: false`.
 *
 * 링크가 슬롯을 막고 있었고 **이 링크로 들어온 결제가 없으면**(입금 대기 포함) 블록을 지운다 — 안 쓰는 시간대를 계속 막지 않는다.
 * 결제·입금 대기가 있으면 블록은 그대로다(그 시간은 예약된 것이다). 링크가 만료돼 저절로 닫힌 경우는 지우지 않는다(자동 해제 크론이 없다)
 * — 안 쓸 링크는 만료를 기다리지 말고 닫는다.
 */
export const closePaymentLink = async (slug: string, now: Date = new Date()): Promise<{ closed: boolean; blockReleased: boolean }> => {
  if (!PAYMENT_LINK_SLUG_PATTERN.test(slug)) return { closed: false, blockReleased: false };
  const db = getDb();
  const closed = await db
    .update(paymentLinks)
    .set({ closedAt: Math.floor(now.getTime() / 1000) })
    .where(and(eq(paymentLinks.slug, slug), isNull(paymentLinks.closedAt)))
    .returning({ slug: paymentLinks.slug, blockId: paymentLinks.blockId });
  if (closed.length === 0) return { closed: false, blockReleased: false };
  const blockId = closed[0].blockId;
  if (!blockId) return { closed: true, blockReleased: false };
  const used = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM payment_link_orders plo JOIN orders o ON o.order_no = plo.order_no
    WHERE plo.slug = ${slug} AND o.status IN ('paid', 'partially_refunded', 'awaiting_deposit')
  `);
  if (Number(used[0]?.n ?? 0) > 0) return { closed: true, blockReleased: false };
  const removed = await db.delete(availabilityBlocks).where(eq(availabilityBlocks.id, blockId)).returning({ id: availabilityBlocks.id });
  return { closed: true, blockReleased: removed.length > 0 };
};
