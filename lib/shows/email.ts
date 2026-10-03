import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO } from '../operatorContact';
import { SEND_INFLIGHT, SEND_PENDING } from '../ops/notificationSentinel';
import { isPurgedValue } from '../privacy/orderRetention';
import { formatPriceAmount } from '../../data/pricing';
import { formatEntryNumber, formatShowtimeLabel } from './format';
import { ticketQrPngBase64 } from './qr';
import { refundRateForNotice } from './refundPolicy';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const KST_OFFSET_SEC = 9 * 3600;

/** 회차 일시 — 연도를 붙인 KST 표기. 예) 2026.10.17(토) 19:00 */
export const showDateTimeLabel = (startsAtSec: number): string => {
  const year = new Date((startsAtSec + KST_OFFSET_SEC) * 1000).getUTCFullYear();
  return `${year}.${formatShowtimeLabel(startsAtSec)}`;
};

const manageUrl = (orderNo: string, token: string): string =>
  `${SITE_URL}/ko/shows/manage/${orderNo}?token=${token}`;

/**
 * 환불 규정 요약 — 표를 베끼지 않고 refundRateForNotice를 날짜별로 불러 만든다.
 * 규정이 바뀌면 메일 문구도 따라간다(lib/shows/refundPolicy.ts가 정본).
 */
export const buildRefundPolicyLines = (): string[] => {
  const start = new Date('2030-01-31T00:00:00Z');
  const at = (daysBefore: number) => new Date(start.getTime() - (daysBefore + 0.5) * 86400000);
  const rate = (d: number) => refundRateForNotice(start, at(d));
  return [
    `공연 10일 전까지 ${rate(10)}%`,
    `9~7일 전 ${rate(7)}%`,
    `6~3일 전 ${rate(3)}%`,
    `2~1일 전 ${rate(1)}%`,
    `공연 당일 ${rate(0)}%, 공연 시작 후에는 환불할 수 없습니다`,
  ];
};

export interface ShowMailTicket {
  code: string;
  entryNumber: number | null;
  typeName: string;
}

export interface ShowMailData {
  orderNo: string;
  manageToken: string;
  buyerName: string;
  showTitle: string;
  venueName: string;
  venueAddress: string;
  startsAtSec: number;
  totalAmount: number;
  tickets: ShowMailTicket[];
}

/** 티켓 메일 본문. QR 이미지는 첨부(ticket-<순번>.png)로 나가고, 본문에는 코드·입장번호를 적는다. */
export const buildShowTicketEmail = (d: ShowMailData): { subject: string; text: string } => {
  const when = showDateTimeLabel(d.startsAtSec);
  return {
    subject: `[스튜디오 놀] 티켓이 발권되었습니다 — ${d.showTitle} ${when}`,
    text: [
      `${d.buyerName}님, 결제가 확인되어 티켓이 발권되었습니다.`,
      '',
      `공연: ${d.showTitle}`,
      `일시: ${when}`,
      `장소: ${d.venueName} (${d.venueAddress})`,
      `결제 금액: ${formatPriceAmount(d.totalAmount)}원 (VAT 포함)`,
      `주문번호: ${d.orderNo}`,
      '',
      `티켓 ${d.tickets.length}매`,
      ...d.tickets.map((t, i) =>
        `${i + 1}. ${t.typeName}${t.entryNumber != null ? ` · 입장번호 ${formatEntryNumber(t.entryNumber)}` : ''}\n   티켓 코드: ${t.code}\n   QR: 첨부 ticket-${i + 1}.png`),
      '',
      '입장할 때 QR 이미지를 보여 주세요. 첨부가 보이지 않으면 아래 링크에서 티켓을 열 수 있습니다.',
      `내 티켓 보기·환불: ${manageUrl(d.orderNo, d.manageToken)}`,
      '',
      '환불 규정',
      ...buildRefundPolicyLines().map((l) => `- ${l}`),
      '',
      `문의: ${CUSTOMER_REPLY_TO}`,
    ].join('\n'),
  };
};

export const buildShowRefundEmail = (
  d: Pick<ShowMailData, 'orderNo' | 'manageToken' | 'buyerName' | 'showTitle' | 'startsAtSec'>
    & { refundedAmount: number; fullyRefunded: boolean },
): { subject: string; text: string } => {
  const when = showDateTimeLabel(d.startsAtSec);
  return {
    subject: `[스튜디오 놀] 환불이 완료되었습니다 — ${d.showTitle}`,
    text: [
      `${d.buyerName}님, 환불이 완료되었습니다.`,
      '',
      `공연: ${d.showTitle} (${when})`,
      `주문번호: ${d.orderNo}`,
      `환불 금액: ${formatPriceAmount(d.refundedAmount)}원`,
      d.fullyRefunded ? '이 주문의 티켓은 모두 환불되어 입장에 사용할 수 없습니다.' : '환불한 티켓은 입장에 사용할 수 없습니다. 남은 티켓은 그대로 사용할 수 있습니다.',
      '카드 결제는 카드사에 따라 취소 반영까지 영업일 기준 며칠이 걸릴 수 있습니다.',
      '',
      `주문 내역: ${manageUrl(d.orderNo, d.manageToken)}`,
      `문의: ${CUSTOMER_REPLY_TO}`,
    ].join('\n'),
  };
};

export const buildShowtimeCancelledEmail = (
  d: Pick<ShowMailData, 'orderNo' | 'manageToken' | 'buyerName' | 'showTitle' | 'startsAtSec' | 'totalAmount'>
    & { refundCompleted: boolean },
): { subject: string; text: string } => {
  const when = showDateTimeLabel(d.startsAtSec);
  return {
    subject: `[스튜디오 놀] 공연 회차가 취소되었습니다 — ${d.showTitle} ${when}`,
    text: [
      `${d.buyerName}님, 예매하신 아래 회차가 취소되었습니다.`,
      '',
      `공연: ${d.showTitle}`,
      `취소된 회차: ${when}`,
      `주문번호: ${d.orderNo}`,
      d.refundCompleted
        ? `결제하신 ${formatPriceAmount(d.totalAmount)}원은 전액 환불 처리되었습니다. 카드사에 따라 취소 반영까지 영업일 기준 며칠이 걸릴 수 있습니다.`
        : '환불은 접수되어 처리 중입니다. 완료되면 다시 안내드립니다.',
      '',
      `주문 내역: ${manageUrl(d.orderNo, d.manageToken)}`,
      `문의: ${CUSTOMER_REPLY_TO}`,
    ].join('\n'),
  };
};

/**
 * 받는 주소. 티켓 주문은 orders.customer_email을 빈 문자열로 만들고(createShowOrder),
 * buyer_contact에 구매자가 적은 연락처가 들어간다 — 그 값이 이메일이면 쓴다. 둘 다 이메일이
 * 아니면 보낼 곳이 없다(null). 파기된 값은 보내지 않는다.
 */
export const resolveShowRecipient = (customerEmail: string, buyerContact: string): string | null => {
  for (const v of [customerEmail, buyerContact]) {
    const t = (v ?? '').trim();
    if (t && !isPurgedValue(t) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return t;
  }
  return null;
};

interface LoadedShowOrder extends ShowMailData {
  recipient: string | null;
  orderId: string;
  status: string;
  issuedTickets: ShowMailTicket[];
}

const loadShowOrder = async (orderNo: string): Promise<LoadedShowOrder | null> => {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (o, { eq, and }) => and(eq(o.orderNo, orderNo), eq(o.type, 'ticket')),
    with: { showOrder: { with: { tickets: true, showtime: { with: { show: true } } } } },
  });
  if (!order || !order.showOrder) return null;
  const so = order.showOrder;
  const show = so.showtime.show;
  const types = await db.query.showTicketTypes.findMany({ where: (t, { eq }) => eq(t.showId, show.id) });
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const issuedTickets: ShowMailTicket[] = so.tickets
    .filter((t) => t.status === 'issued')
    .map((t) => ({ code: t.code, entryNumber: t.entryNumber, typeName: typeName.get(t.ticketTypeId) ?? '티켓' }));
  return {
    orderId: order.id,
    status: order.status,
    orderNo: order.orderNo,
    manageToken: order.manageToken,
    buyerName: so.buyerName,
    showTitle: show.title,
    venueName: show.venueName,
    venueAddress: show.venueAddress,
    startsAtSec: so.showtime.startsAt,
    totalAmount: order.totalAmount,
    tickets: issuedTickets,
    issuedTickets,
    recipient: resolveShowRecipient(order.customerEmail, so.buyerContact),
  };
};

const recordResult = async (orderId: string, value: string | null): Promise<void> => {
  try {
    await getDb().run(sql`UPDATE orders SET notification_error = ${value} WHERE id = ${orderId}`);
  } catch (error) {
    console.error('[shows-email] notificationError 기록 실패', { orderId, value, error });
  }
};

/**
 * 티켓 메일 발송. lib/booking/confirm.ts와 같은 두 단계 센티널 CAS다 —
 * `notification_error = 'send_pending'`인 주문만 `send_inflight`로 선점한 쪽이 보낸다.
 * 웹훅과 SSR 확정이 동시에 와도 한 통만 나간다. 끝나면 성공 null / 실패 사유로 덮는다.
 *
 * **전제: 확정 batch(lib/shows/confirm.ts의 orders UPDATE)가 `notification_error`에
 * `send_pending`을 함께 써야 한다.** 지금은 쓰지 않아 이 함수가 0행을 선점하고 `sent:false`로
 * 끝난다 — 호출부 배선 때 같이 고칠 것(보고서 참조). `force`는 관리자 재발송용으로 inflight가
 * 아닌 모든 상태에서 선점한다.
 */
export const sendShowTicketEmail = async (
  orderNo: string,
  opts: { force?: boolean } = {},
): Promise<{ sent: boolean }> => {
  const db = getDb();
  const claim = await db.run(sql`
    UPDATE orders SET notification_error = ${SEND_INFLIGHT}
    WHERE order_no = ${orderNo} AND type = 'ticket' AND status IN ('paid', 'partially_refunded')
      AND ${opts.force
        ? sql`(notification_error IS NULL OR notification_error != ${SEND_INFLIGHT})`
        : sql`notification_error = ${SEND_PENDING}`}
  `);
  if (((claim as { rowsAffected?: number }).rowsAffected ?? 0) === 0) return { sent: false };

  const data = await loadShowOrder(orderNo).catch((e) => {
    console.error('[shows-email] 주문 조회 실패', { orderNo, e });
    return null;
  });
  if (!data) {
    // 선점만 하고 끝내면 inflight가 남아 운영 점검이 잡는다 — 실패 사유로 바꿔 둔다.
    await db.run(sql`UPDATE orders SET notification_error = 'customer:LOAD_FAILED' WHERE order_no = ${orderNo}`);
    return { sent: false };
  }
  if (!data.recipient) {
    await recordResult(data.orderId, 'customer:NO_EMAIL_ADDRESS');
    return { sent: false };
  }
  if (data.issuedTickets.length === 0) {
    await recordResult(data.orderId, 'customer:NO_ISSUED_TICKETS');
    return { sent: false };
  }

  const attachments: Array<{ filename: string; content: string }> = [];
  for (let i = 0; i < data.tickets.length; i++) {
    try {
      attachments.push({ filename: `ticket-${i + 1}.png`, content: await ticketQrPngBase64(data.tickets[i].code) });
    } catch (error) {
      // QR 생성 실패는 메일을 막지 않는다 — 코드 문자열과 관리 링크로 입장할 수 있다.
      console.error('[shows-email] QR 생성 실패 — 첨부 없이 발송', { orderNo, error: (error as Error).message });
    }
  }

  const { subject, text } = buildShowTicketEmail(data);
  const r = await sendEmail({
    to: data.recipient, replyTo: CUSTOMER_REPLY_TO, subject, text,
    ...(attachments.length ? { attachments } : {}),
  });
  const failure = r.ok ? null : `customer:${r.errorCode ?? 'API_ERROR'}`;
  await recordResult(data.orderId, failure);
  return { sent: r.ok };
};

/** 환불 완료 안내. 호출부: refundShowTickets가 `refunded`를 돌려준 직후(API 라우트)·syncShowCancelsFromToss. */
export const sendShowRefundEmail = async (
  orderNo: string,
  refund: { refundedAmount: number; fullyRefunded: boolean },
): Promise<{ sent: boolean }> => {
  const data = await loadShowOrder(orderNo).catch(() => null);
  if (!data?.recipient) return { sent: false };
  const { subject, text } = buildShowRefundEmail({ ...data, ...refund });
  const r = await sendEmail({ to: data.recipient, replyTo: CUSTOMER_REPLY_TO, subject, text });
  if (!r.ok) console.error('[shows-email] 환불 안내 발송 실패', { orderNo, code: r.errorCode });
  return { sent: r.ok };
};

/** 회차 취소 안내. 호출부: cancelShowtime 뒤, 대상 주문마다(환불 실패 주문은 refundCompleted:false). */
export const sendShowtimeCancelledEmail = async (
  orderNo: string,
  opts: { refundCompleted: boolean },
): Promise<{ sent: boolean }> => {
  const data = await loadShowOrder(orderNo).catch(() => null);
  if (!data?.recipient) return { sent: false };
  const { subject, text } = buildShowtimeCancelledEmail({ ...data, ...opts });
  const r = await sendEmail({ to: data.recipient, replyTo: CUSTOMER_REPLY_TO, subject, text });
  if (!r.ok) console.error('[shows-email] 회차 취소 안내 발송 실패', { orderNo, code: r.errorCode });
  return { sent: r.ok };
};
