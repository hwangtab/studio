import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { BANK_DEPOSIT_GUIDE_DAYS } from '../payments/bankAccount';
import {
  AWAITING_DEPOSIT,
  BANK_DEPOSIT_PAYMENT_METHOD,
  DEPOSIT_CANCELLED,
  bankDepositDeadlineOf,
  bankDepositPaymentKey,
} from '../payments/bankDeposit';
import { recordDepositGuideResult, rowsOf, sendDepositGuideEmails, sendDepositWithdrawnOperatorAlert } from '../payments/bankDepositOrders';
import { allowCustomerDepositGuideMail } from '../payments/depositGuideThrottle';
import { safeDbErrorSummary } from '../payments/refundAccount';
import { shopLineName } from './catalog';
import { sendShopOrderConfirmedEmails, shopManageUrl } from './email';
import { alertIfSerialsMissing, serialInsertStatements } from './serials';
import { findShopOrderByOrderNo, type ShopOrderWithDetails } from './service';

/**
 * 상점 주문 **계좌 입금** 운영 전이 — 입금 확인(확정) · 미입금 취소(입금 전 신청 취소) · 입금 안내 발송.
 * 생성은 `createShopOrder`의 `paymentMethod: 'bank_transfer'`(`awaiting_deposit` — 재고를 기한 없이 점유, lib/shop/stock.ts).
 * 규칙의 근거는 lib/payments/bankDeposit.ts 머리 주석. 공연(lib/shows/bankDeposit.ts)과 같은 모양이다.
 *
 * **환불은 운영자가 한다.** 입금으로 확정된 주문(`bank-deposit:` 결제 행)은 고객이 여기서 셀프 취소하지 못한다 — 환불 계좌 표
 * (`refund_accounts`)의 종류에 상점이 없어(DB 제약), 고객에게 계좌를 받아 두는 길이 아직 없다. 운영자가 카톡·전화로 계좌를 받아
 * 송금하고 관리자 화면의 "환불"로 기록한다(lib/shop/cancel.ts).
 */

export type ShopDepositOutcome =
  | { ok: true; warnings?: string[] }
  | { ok: false; code: 'not_found' | 'invalid_state'; message: string };

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

/** 입금 안내 기한 — 신청 + 3일(안내용, 지나도 자동 취소하지 않는다). */
export const shopDepositDeadline = (createdAt: Date): Date =>
  bankDepositDeadlineOf({ createdAt, startsAt: null, guideDays: BANK_DEPOSIT_GUIDE_DAYS });

/** 입금 안내·신청 취소 알림이 함께 쓰는 "무엇을 주문했나" 줄(운영자 알림은 언제나 한국어). */
const shopSummaryLines = (order: ShopOrderWithDetails): string[] => {
  const items = order.shopOrder?.items ?? [];
  return items.map((i) => `상품: ${shopLineName(i.productTitle, i.optionLabel)} ${i.quantity}개`);
};

/**
 * **입금 안내 메일**(고객 + 운영자). 신청 직후와 관리자 재발송이 같은 함수를 쓴다. 입금 대기가 아니면 보내지 않는다.
 * 결과는 `notification_error`에 남는다(예외는 삼킨다).
 */
export const deliverShopDepositGuide = async (
  orderNo: string,
  opts: { throttleCustomer?: boolean } = {},
): Promise<string | null> => {
  const order = await findShopOrderByOrderNo(orderNo);
  if (!order || !order.shopOrder || order.status !== AWAITING_DEPOSIT) return 'invalid_state';
  let failure: string | null;
  try {
    const skipCustomer = opts.throttleCustomer ? !(await allowCustomerDepositGuideMail(order.customerEmail)) : false;
    failure = await sendDepositGuideEmails({
      skipCustomer,
      orderNo: order.orderNo, customerName: order.customerName, customerEmail: order.customerEmail,
      customerPhone: order.customerPhone, totalAmount: order.totalAmount,
      deadline: shopDepositDeadline(order.createdAt),
      kindLabel: '상점 주문', applicantLabel: '주문하신 분',
      summaryLines: [...shopSummaryLines(order), '입금을 확인할 때까지 상품을 잡아 둬요. 확인되면 주문이 접수되고 메일로 알려 드려요.'],
      manageUrl: shopManageUrl(order.orderNo, order.manageToken),
      adminUrl: `${SITE_URL}/admin/shop/${order.orderNo}`,
    });
  } catch (error) {
    console.error('[shop-bank-deposit] 입금 안내 메일 발송 중 예외', { orderNo, error: safeDbErrorSummary(error) });
    failure = error instanceof Error ? error.message : String(error);
  }
  await recordDepositGuideResult(order.id, failure);
  return failure;
};

/**
 * **입금 확인** — `awaiting_deposit` → `paid`, 같은 batch에서 결제 행(`bankDepositPaymentKey`)을 남기고 한정판 번호를 배정한다.
 * 그다음 토스 확정과 같은 후처리(주문 확정 메일 — 디지털 상품이면 내려받기 안내 포함).
 *
 * - 낙관적 조건 한 문장(`WHERE status = 'awaiting_deposit'`) — 두 번 눌러도 1행은 한쪽뿐.
 * - 재고는 대기 내내 점유돼 있었으므로(기한 없는 점유) 다시 세지 않는다. 한정판 번호도 같은 이유로 남아 있다(점유 중인 줄의
 *   "아직 못 받은 번호"가 남은 번호에서 빠져 있다 — lib/shop/stock.ts).
 * - 미입금 취소로 닫힌 건(`deposit_cancelled`)은 확정하지 않는다 — 그 사이 재고가 풀려 팔렸을 수 있다.
 */
export const confirmShopBankDeposit = async (input: { orderNo: string; now: Date }): Promise<ShopDepositOutcome> => {
  const order = await findShopOrderByOrderNo(input.orderNo);
  if (!order || !order.shopOrder) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  const db = getDb();
  const paymentKey = bankDepositPaymentKey(order.orderNo);
  const approvedAt = Math.floor(input.now.getTime() / 1000);
  const items = order.shopOrder.items;
  const isPaidNow = sql`EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`;
  const [claim] = await db.batch([
    db.run(sql`UPDATE orders SET status = 'paid', updated_at = unixepoch() WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT}`),
    db.run(sql`
      INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
      SELECT ${randomUUID().replace(/-/g, '')}, ${order.id}, ${paymentKey}, ${BANK_DEPOSIT_PAYMENT_METHOD}, ${approvedAt}, NULL, NULL
      WHERE ${isPaidNow} AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_key = ${paymentKey})
    `),
    // 한정판 번호 — paid UPDATE 뒤, 같은 batch(토스 확정과 같은 자리). `db-` 줄에만(없으면 빈 배열).
    ...serialInsertStatements({ id: order.id, orderNo: order.orderNo }, items).map((s) => db.run(s)),
  ] as [ReturnType<typeof db.run>, ...Array<ReturnType<typeof db.run>>]);
  if (rowsOf(claim) === 0) {
    return { ok: false, code: 'invalid_state', message: '이미 확인됐거나 입금을 확인할 수 있는 상태가 아니에요(미입금 취소된 신청은 확정할 수 없어요). 새로고침해 주세요.' };
  }
  await alertIfSerialsMissing(order.orderNo, items);
  await sendShopOrderConfirmedEmails(order.orderNo);
  return { ok: true };
};

/**
 * **입금 전 신청을 닫는다** — 관리자 "미입금 취소"와 고객 "입금 전 신청 취소". `awaiting_deposit` → `deposit_cancelled`
 * (재고는 점유에서 빠져 바로 풀린다). 받은 돈이 없으니 메일이 없고 `notification_error`도 비운다(공연·예약과 같은 판단).
 */
export const cancelAwaitingShopDeposit = async (input: { orderNo: string }): Promise<ShopDepositOutcome> => {
  const order = await findShopOrderByOrderNo(input.orderNo);
  if (!order || !order.shopOrder) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  const claim = await getDb().run(sql`
    UPDATE orders SET status = ${DEPOSIT_CANCELLED}, notification_error = NULL, updated_at = unixepoch()
    WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT}
  `);
  if (rowsOf(claim) === 0) return { ok: false, code: 'invalid_state', message: '입금 대기 중인 계좌 입금 신청이 아니에요. 새로고침해 주세요.' };
  return { ok: true };
};

/** 고객이 "입금 전 신청 취소"를 눌러 닫힌 신청의 운영자 알림. 예외는 삼킨다(취소는 이미 끝났다). */
export const notifyShopDepositWithdrawn = async (orderNo: string): Promise<void> => {
  try {
    const order = await findShopOrderByOrderNo(orderNo);
    if (!order || !order.shopOrder) return;
    await sendDepositWithdrawnOperatorAlert({
      orderNo: order.orderNo, customerName: order.customerName, customerEmail: order.customerEmail,
      customerPhone: order.customerPhone, totalAmount: order.totalAmount,
      kindLabel: '상점 주문', summaryLines: shopSummaryLines(order),
      adminUrl: `${SITE_URL}/admin/shop/${order.orderNo}`,
    });
  } catch (error) {
    console.error('[shop-bank-deposit] 신청 취소 알림 준비 실패', { orderNo, error: safeDbErrorSummary(error) });
  }
};
