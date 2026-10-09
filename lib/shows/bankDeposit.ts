import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SEND_PENDING } from '../ops/notificationSentinel';
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
import { liveShowtimeCondition } from './conditions';
import { assignEntryNumbers } from './confirm';
import { resolveShowRecipient, sendShowTicketEmail, showDateTimeLabel } from './email';
import { showDateTimeLabelEn } from './emailEn';
import { showTranslationFor } from './localize';
import { loadShowOrderLocale } from './orderLocale';

/**
 * 공연 티켓 **계좌 입금** 운영 전이 — 입금 확인(발권) · 미입금 취소(입금 전 신청 취소) · 입금 안내 발송.
 * 생성은 `createShowOrder`의 `paymentMethod: 'bank_transfer'`(티켓 `held` + `hold_expires_at` NULL — 기한 없는
 * 좌석 점유). 규칙의 근거는 lib/payments/bankDeposit.ts 머리 주석.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

export type ShowDepositOutcome =
  | { ok: true; emailSent?: boolean; warnings?: string[] }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'showtime_closed'; message: string };

/** 입금 안내 기한 — 신청 + 3일, 회차 시작이 더 빠르면 시작 시각까지. */
export const showDepositDeadline = (createdAtSec: number, startsAtSec: number): Date =>
  bankDepositDeadlineOf({
    createdAt: new Date(createdAtSec * 1000), startsAt: new Date(startsAtSec * 1000), guideDays: BANK_DEPOSIT_GUIDE_DAYS,
  });

const loadTicketOrder = async (where: { id: string } | { orderNo: string }) =>
  getDb().query.orders.findFirst({
    where: (o, { and, eq }) => and('id' in where ? eq(o.id, where.id) : eq(o.orderNo, where.orderNo), eq(o.type, 'ticket')),
    with: { showOrder: { with: { tickets: true, showtime: { with: { show: true } } } } },
  });

type TicketOrder = NonNullable<Awaited<ReturnType<typeof loadTicketOrder>>>;

/** 입금 안내·신청 취소 알림이 함께 쓰는 "무엇을 신청했나" 줄(한국어 — 운영자 알림은 언제나 한국어). */
const showSummaryLines = (so: NonNullable<TicketOrder['showOrder']>): string[] => {
  const show = so.showtime.show;
  return [
    `공연: ${show.subtitle ? `${show.title} — ${show.subtitle}` : show.title}`,
    `일시: ${showDateTimeLabel(so.showtime.startsAt)}`,
    `장소: ${show.venueName}`,
    `티켓: ${so.tickets.length}매`,
  ];
};

/**
 * **입금 안내 메일**(고객 + 운영자). 신청 직후와 관리자 "입금 안내 재발송"이 같은 함수를 쓴다. 입금 대기가
 * 아니면 보내지 않는다. 결과는 `notification_error`에 남는다(예외는 삼킨다).
 */
export const deliverShowDepositGuide = async (
  orderNo: string,
  opts: { throttleCustomer?: boolean } = {},
): Promise<string | null> => {
  const order = await loadTicketOrder({ orderNo });
  const so = order?.showOrder;
  if (!order || !so || order.status !== AWAITING_DEPOSIT) return 'invalid_state';
  const show = so.showtime.show;
  const recipient = resolveShowRecipient(order.customerEmail, so.buyerContact);
  // 영어 화면으로 신청한 주문이면 고객 메일만 영어로(운영자 알림은 한국어 그대로).
  const locale = await loadShowOrderLocale(order.orderNo);
  const en = locale === 'en' ? showTranslationFor(show.slug) : null;
  const enTitle = en ? (en.subtitle ? `${en.title} — ${en.subtitle}` : en.title) : null;
  let failure: string | null;
  try {
    const to = recipient ?? order.customerEmail;
    const skipCustomer = opts.throttleCustomer ? !(await allowCustomerDepositGuideMail(to)) : false;
    failure = await sendDepositGuideEmails({
      skipCustomer,
      orderNo: order.orderNo, customerName: so.buyerName, customerEmail: recipient ?? order.customerEmail,
      customerPhone: so.buyerContact, totalAmount: order.totalAmount,
      deadline: showDepositDeadline(order.createdAt.getTime() / 1000, so.showtime.startsAt),
      kindLabel: '공연 예매', applicantLabel: '예매하신 분',
      summaryLines: [
        ...showSummaryLines(so),
        '입금을 확인할 때까지 좌석을 잡아 둬요. 확인되면 티켓(QR)을 메일로 보내 드려요.',
      ],
      manageUrl: `${SITE_URL}/${locale}/shows/manage/${order.orderNo}?token=${order.manageToken}`,
      adminUrl: `${SITE_URL}/admin/shows/${show.id}`,
      ...(locale === 'en'
        ? {
            customerLocale: 'en' as const,
            customerKindLabel: 'show tickets',
            customerApplicantLabel: 'person who booked',
            customerSummaryLines: [
              `Show: ${enTitle ?? (show.subtitle ? `${show.title} — ${show.subtitle}` : show.title)}`,
              `Date: ${showDateTimeLabelEn(so.showtime.startsAt)}`,
              `Venue: ${en?.venueName ?? show.venueName}`,
              `Tickets: ${so.tickets.length}`,
              'Your seats are held until we confirm the transfer. Once confirmed, we email your ticket (QR code).',
            ],
          }
        : {}),
    });
  } catch (error) {
    console.error('[shows-bank-deposit] 입금 안내 메일 발송 중 예외', { orderNo, error: safeDbErrorSummary(error) });
    failure = error instanceof Error ? error.message : String(error);
  }
  await recordDepositGuideResult(order.id, failure);
  return failure;
};

/**
 * **입금 확인** — `awaiting_deposit` → `paid`, 같은 batch에서 결제 행(`bankDepositPaymentKey`)을 남기고 티켓
 * held → issued. 그다음 토스 확정과 같은 후처리(정리번호 배정, 티켓 QR 메일 — `send_pending` 센티널 선점).
 *
 * - 낙관적 조건 한 문장(`WHERE status = 'awaiting_deposit'`) — 두 번 눌러도 1행은 한쪽뿐.
 * - **회차가 살아 있어야 한다**(취소되지 않았고 아직 시작 전, `liveShowtimeCondition`). 시작한 뒤에 확인된
 *   입금은 발권해도 쓸 데가 없다 — 운영자에게 돌려주라고 알린다(대기는 그대로 두어 "미입금 취소"로 닫는다).
 * - 좌석은 대기 내내 잡혀 있었으므로(기한 없는 held) 정원을 다시 세지 않는다.
 * - 미입금 취소로 닫힌 건(`deposit_cancelled`)은 확정하지 않는다 — 그 사이 좌석이 풀려 팔렸을 수 있다.
 */
export const confirmShowBankDeposit = async (input: { orderId: string; now: Date }): Promise<ShowDepositOutcome> => {
  const order = await loadTicketOrder({ id: input.orderId });
  const so = order?.showOrder;
  if (!order || !so) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  const db = getDb();
  const paymentKey = bankDepositPaymentKey(order.orderNo);
  const approvedAt = Math.floor(input.now.getTime() / 1000);
  const isPaidNow = sql`EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`;
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET status = 'paid', notification_error = ${SEND_PENDING}, updated_at = unixepoch()
      WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT} AND ${liveShowtimeCondition(so.showtimeId, input.now)}
    `),
    db.run(sql`
      INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
      SELECT ${randomUUID().replace(/-/g, '')}, ${order.id}, ${paymentKey}, ${BANK_DEPOSIT_PAYMENT_METHOD}, ${approvedAt}, NULL, NULL
      WHERE ${isPaidNow} AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_key = ${paymentKey})
    `),
    db.run(sql`
      UPDATE show_tickets SET status = 'issued'
      WHERE order_no = ${order.orderNo} AND status = 'held' AND ${isPaidNow}
    `),
  ]);
  if (rowsOf(claim) === 0) {
    const again = await loadTicketOrder({ id: order.id });
    if (again?.status === AWAITING_DEPOSIT) {
      return {
        ok: false, code: 'showtime_closed',
        message: '회차가 취소됐거나 이미 시작해 발권할 수 없어요. 입금을 받으셨다면 고객에게 돌려주고, 이 신청은 "미입금 취소"로 닫아 주세요.',
      };
    }
    return { ok: false, code: 'invalid_state', message: '이미 확인됐거나 입금을 확인할 수 있는 상태가 아니에요(미입금 취소된 신청은 확정할 수 없어요). 새로고침해 주세요.' };
  }
  await assignEntryNumbers(order.orderNo);
  let emailSent = false;
  try {
    emailSent = (await sendShowTicketEmail(order.orderNo)).sent;
  } catch (error) {
    // 센티널(send_pending/inflight)이 남아 관리자 화면·헬스체크가 잡는다 — 확정은 뒤집지 않는다.
    console.error('[shows-bank-deposit] 티켓 메일 발송 실패', { orderNo: order.orderNo, error: safeDbErrorSummary(error) });
  }
  return { ok: true, emailSent };
};

/**
 * **입금 전 신청을 닫는다** — 관리자 "미입금 취소"와 고객 "입금 전 신청 취소". `awaiting_deposit` →
 * `deposit_cancelled`, 같은 batch에서 보류 티켓을 void(좌석이 바로 풀린다). 받은 돈이 없으니 메일이 없고,
 * `notification_error`도 비운다(펀딩·예약과 같은 판단).
 */
export const cancelAwaitingShowDeposit = async (input: { orderId: string }): Promise<ShowDepositOutcome> => {
  const order = await loadTicketOrder({ id: input.orderId });
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  const db = getDb();
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET status = ${DEPOSIT_CANCELLED}, notification_error = NULL, updated_at = unixepoch()
      WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT}
    `),
    db.run(sql`
      UPDATE show_tickets SET status = 'void'
      WHERE order_no = ${order.orderNo} AND status = 'held'
        AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = ${DEPOSIT_CANCELLED})
    `),
  ]);
  if (rowsOf(claim) === 0) {
    return { ok: false, code: 'invalid_state', message: '입금 대기 중인 계좌 입금 신청이 아니에요. 새로고침해 주세요.' };
  }
  return { ok: true };
};

/** 고객이 "입금 전 신청 취소"를 눌러 닫힌 신청의 운영자 알림(pages/api/shows/refund.ts의 withdraw). 예외는 삼킨다. */
export const notifyShowDepositWithdrawn = async (orderId: string): Promise<void> => {
  try {
    const order = await loadTicketOrder({ id: orderId });
    const so = order?.showOrder;
    if (!order || !so) return;
    await sendDepositWithdrawnOperatorAlert({
      orderNo: order.orderNo, customerName: so.buyerName, customerEmail: order.customerEmail,
      customerPhone: so.buyerContact, totalAmount: order.totalAmount,
      kindLabel: '공연 예매', summaryLines: showSummaryLines(so),
      adminUrl: `${SITE_URL}/admin/shows/${so.showtime.show.id}`,
    });
  } catch (error) {
    console.error('[shows-bank-deposit] 신청 취소 알림 준비 실패', { orderId, error: safeDbErrorSummary(error) });
  }
};
