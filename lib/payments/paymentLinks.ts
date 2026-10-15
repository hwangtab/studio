import { randomBytes } from 'node:crypto';

import { and, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { paymentLinks } from '../../db/schema';
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
      return isOpenRow(row, now) ? { itemName: row.itemName, totalAmount: row.totalAmount, ...(row.expiresOn ? { expiresOn: row.expiresOn } : {}) } : null;
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
}

/** 새 링크를 만든다. slug는 서버가 만든다(추측 불가 24자리 hex). */
export const createPaymentLink = async (input: PaymentLinkInput): Promise<{ slug: string }> => {
  const slug = randomBytes(12).toString('hex');
  await getDb().insert(paymentLinks).values({
    slug, itemName: input.itemName, totalAmount: input.totalAmount, expiresOn: input.expiresOn, memo: input.memo,
  });
  return { slug };
};

export const listPaymentLinks = async (limit = 200, now: Date = new Date()): Promise<PaymentLinkListRow[]> => {
  const rows = await getDb().select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt)).limit(limit);
  return rows.map((r) => ({
    slug: r.slug, itemName: r.itemName, totalAmount: r.totalAmount, expiresOn: r.expiresOn, memo: r.memo,
    closedAt: r.closedAt, createdAt: r.createdAt, open: isOpenRow(r, now),
  }));
};

/** 링크를 닫는다(되돌릴 수 없다 — 다시 열려면 새로 만든다). 이미 닫혔거나 없으면 false. */
export const closePaymentLink = async (slug: string, now: Date = new Date()): Promise<boolean> => {
  if (!PAYMENT_LINK_SLUG_PATTERN.test(slug)) return false;
  const closed = await getDb()
    .update(paymentLinks)
    .set({ closedAt: Math.floor(now.getTime() / 1000) })
    .where(and(eq(paymentLinks.slug, slug), isNull(paymentLinks.closedAt)))
    .returning({ slug: paymentLinks.slug });
  return closed.length > 0;
};
