import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { sendEmail } from '../email/resend';
import { adminUrl, buildEmailLayout, escapeHtml } from '../email/layout';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import { SEND_INFLIGHT, SEND_PENDING } from '../ops/notificationSentinel';
import { isPurgedValue } from '../privacy/orderRetention';
import { formatPriceAmount } from '../../data/pricing';
import {
  buildShowRefundEmailHtml,
  buildShowTicketEmailHtml,
  buildShowtimeCancelledEmailHtml,
  showRefundHeading,
  showRefundViaSentence,
  type ShowRefundVia,
  showtimeCancelledRefundSentence,
} from './emailHtml';
import { buildShowRefundEmailEn, buildShowTicketEmailEn, buildShowtimeCancelledEmailEn } from './emailEn';
import { formatEntryNumber, formatShowtimeLabel } from './format';
import type { ShowLocale } from './i18n';
import { showTranslationFor } from './localize';
import { loadShowOrderLocale } from './orderLocale';
import { ticketQrPngBase64 } from './qr';
import { refundRateForNotice } from './refundPolicy';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const KST_OFFSET_SEC = 9 * 3600;

/** 회차 일시 — 연도를 붙인 KST 표기. 예) 2026.10.17(토) 19:00 */
export const showDateTimeLabel = (startsAtSec: number): string => {
  const year = new Date((startsAtSec + KST_OFFSET_SEC) * 1000).getUTCFullYear();
  return `${year}.${formatShowtimeLabel(startsAtSec)}`;
};

const manageUrl = (orderNo: string, token: string, locale: ShowLocale = 'ko'): string =>
  `${SITE_URL}/${locale}/shows/manage/${orderNo}?token=${token}`;

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
  /** HTML 본문용 — 부제·포스터는 텍스트 본문엔 없어도 된다(제목에 부제가 이미 들어 있다). */
  showSubtitle?: string | null;
  coverImage?: string | null;
  venueName: string;
  venueAddress: string;
  startsAtSec: number;
  totalAmount: number;
  tickets: ShowMailTicket[];
  /** 주문 언어(show_order_locales) — en이면 영어 메일·/en 내 티켓 주소. 없으면 한국어. */
  locale?: ShowLocale;
}

/** 티켓 메일 본문. QR 이미지는 첨부(ticket-<순번>.png)로 나가고, 본문에는 코드·입장번호를 적는다. */
export const buildShowTicketEmail = (d: ShowMailData): { subject: string; text: string; html: string } => {
  if (d.locale === 'en') {
    return buildShowTicketEmailEn({
      ...d,
      showTitle: d.showSubtitle ? d.showTitle.replace(` — ${d.showSubtitle}`, '') : d.showTitle,
      posterUrl: d.coverImage ? `${SITE_URL}${d.coverImage}` : null,
      manageUrl: manageUrl(d.orderNo, d.manageToken, 'en'),
    });
  }
  const when = showDateTimeLabel(d.startsAtSec);
  return {
    subject: `[스튜디오 놀] 티켓이 발권되었습니다 — ${d.showTitle} ${when}`,
    html: buildShowTicketEmailHtml({
      buyerName: d.buyerName,
      showTitle: d.showSubtitle ? d.showTitle.replace(` — ${d.showSubtitle}`, '') : d.showTitle,
      showSubtitle: d.showSubtitle ?? null,
      posterUrl: d.coverImage ? `${SITE_URL}${d.coverImage}` : null,
      when,
      venueName: d.venueName,
      venueAddress: d.venueAddress,
      totalAmount: d.totalAmount,
      orderNo: d.orderNo,
      manageUrl: manageUrl(d.orderNo, d.manageToken),
      tickets: d.tickets,
      refundLines: buildRefundPolicyLines(),
      contact: CUSTOMER_REPLY_TO,
    }),
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
  d: Pick<ShowMailData, 'orderNo' | 'manageToken' | 'buyerName' | 'showTitle' | 'startsAtSec' | 'locale'>
    & { refundedAmount: number; fullyRefunded: boolean; refundVia?: ShowRefundVia },
): { subject: string; text: string; html: string } => {
  if (d.locale === 'en') return buildShowRefundEmailEn({ ...d, manageUrl: manageUrl(d.orderNo, d.manageToken, 'en') });
  const when = showDateTimeLabel(d.startsAtSec);
  return {
    subject: `[스튜디오 놀] ${showRefundHeading(d.refundVia)} — ${d.showTitle}`,
    html: buildShowRefundEmailHtml({ ...d, when, manageUrl: manageUrl(d.orderNo, d.manageToken), contact: CUSTOMER_REPLY_TO }),
    text: [
      `${d.buyerName}님, ${showRefundHeading(d.refundVia)}.`,
      '',
      `공연: ${d.showTitle} (${when})`,
      `주문번호: ${d.orderNo}`,
      `환불 금액: ${formatPriceAmount(d.refundedAmount)}원`,
      d.fullyRefunded ? '이 주문의 티켓은 모두 환불되어 입장에 사용할 수 없습니다.' : '환불한 티켓은 입장에 사용할 수 없습니다. 남은 티켓은 그대로 사용할 수 있습니다.',
      showRefundViaSentence(d.refundVia),
      '',
      `주문 내역: ${manageUrl(d.orderNo, d.manageToken)}`,
      `문의: ${CUSTOMER_REPLY_TO}`,
    ].join('\n'),
  };
};

export const buildShowtimeCancelledEmail = (
  d: Pick<ShowMailData, 'orderNo' | 'manageToken' | 'buyerName' | 'showTitle' | 'startsAtSec' | 'totalAmount' | 'locale'>
    & { refundCompleted: boolean; bankNotice?: 'refund_account_needed' | 'not_deposited' },
): { subject: string; text: string; html: string } => {
  if (d.locale === 'en') return buildShowtimeCancelledEmailEn({ ...d, manageUrl: manageUrl(d.orderNo, d.manageToken, 'en') });
  const when = showDateTimeLabel(d.startsAtSec);
  return {
    subject: `[스튜디오 놀] 공연 회차가 취소되었습니다 — ${d.showTitle} ${when}`,
    html: buildShowtimeCancelledEmailHtml({ ...d, when, manageUrl: manageUrl(d.orderNo, d.manageToken), contact: CUSTOMER_REPLY_TO }),
    text: [
      `${d.buyerName}님, 예매하신 아래 회차가 취소되었습니다.`,
      '',
      `공연: ${d.showTitle}`,
      `취소된 회차: ${when}`,
      `주문번호: ${d.orderNo}`,
      showtimeCancelledRefundSentence(d),
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
  showId: string;
  buyerContact: string;
  recipient: string | null;
  orderId: string;
  status: string;
  issuedTickets: ShowMailTicket[];
}

/** `localize: false`면 주문 언어와 무관하게 한국어 값 — 운영자 알림용. */
const loadShowOrder = async (orderNo: string, opts: { localize?: boolean } = {}): Promise<LoadedShowOrder | null> => {
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (o, { eq, and }) => and(eq(o.orderNo, orderNo), eq(o.type, 'ticket')),
    with: { showOrder: { with: { tickets: true, showtime: { with: { show: true } } } } },
  });
  if (!order || !order.showOrder) return null;
  const so = order.showOrder;
  const show = so.showtime.show;
  const types = await db.query.showTicketTypes.findMany({ where: (t, { eq }) => eq(t.showId, show.id) });
  // 영어 주문이면 공연 정의의 영어 제목·장소·티켓 이름으로 바꾼다(lib/shows/localize.ts와 같은 표). 번역이 없으면 한국어.
  const locale: ShowLocale = opts.localize === false ? 'ko' : await loadShowOrderLocale(order.orderNo);
  const en = locale === 'en' ? showTranslationFor(show.slug) : null;
  const typeName = new Map(types.map((t) => [t.id, en?.ticketTypeNames?.[t.name] ?? t.name]));
  const issuedTickets: ShowMailTicket[] = so.tickets
    .filter((t) => t.status === 'issued')
    .map((t) => ({ code: t.code, entryNumber: t.entryNumber, typeName: typeName.get(t.ticketTypeId) ?? (locale === 'en' ? 'Ticket' : '티켓') }));
  const title = en?.title ?? show.title;
  const subtitle = en ? en.subtitle ?? null : show.subtitle ?? null;
  return {
    locale,
    showId: show.id,
    buyerContact: so.buyerContact,
    orderId: order.id,
    status: order.status,
    orderNo: order.orderNo,
    manageToken: order.manageToken,
    buyerName: so.buyerName,
    showTitle: subtitle ? `${title} — ${subtitle}` : title,
    showSubtitle: subtitle,
    coverImage: show.coverImage ?? null,
    venueName: en?.venueName ?? show.venueName,
    venueAddress: en?.venueAddress ?? show.venueAddress,
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

  const { subject, text, html } = buildShowTicketEmail(data);
  const r = await sendEmail({
    to: data.recipient, replyTo: CUSTOMER_REPLY_TO, subject, text, html,
    ...(attachments.length ? { attachments } : {}),
  });
  const failure = r.ok ? null : `customer:${r.errorCode ?? 'API_ERROR'}`;
  await recordResult(data.orderId, failure);
  return { sent: r.ok };
};

/** 환불 완료 안내. 호출부: refundShowTickets가 `refunded`를 돌려준 직후(API 라우트)·syncShowCancelsFromToss. */
export const sendShowRefundEmail = async (
  orderNo: string,
  refund: { refundedAmount: number; fullyRefunded: boolean; refundVia?: ShowRefundVia },
): Promise<{ sent: boolean }> => {
  const data = await loadShowOrder(orderNo).catch(() => null);
  if (!data?.recipient) return { sent: false };
  const { subject, text, html } = buildShowRefundEmail({ ...data, ...refund });
  const r = await sendEmail({ to: data.recipient, replyTo: CUSTOMER_REPLY_TO, subject, text, html });
  if (!r.ok) console.error('[shows-email] 환불 안내 발송 실패', { orderNo, code: r.errorCode });
  return { sent: r.ok };
};

/** 회차 취소 안내. 호출부: cancelShowtime 뒤, 대상 주문마다(환불 실패 주문은 refundCompleted:false). */
export const sendShowtimeCancelledEmail = async (
  orderNo: string,
  opts: { refundCompleted: boolean; bankNotice?: 'refund_account_needed' | 'not_deposited' },
): Promise<{ sent: boolean }> => {
  const data = await loadShowOrder(orderNo).catch(() => null);
  if (!data?.recipient) return { sent: false };
  const { subject, text, html } = buildShowtimeCancelledEmail({ ...data, ...opts });
  const r = await sendEmail({ to: data.recipient, replyTo: CUSTOMER_REPLY_TO, subject, text, html });
  if (!r.ok) console.error('[shows-email] 회차 취소 안내 발송 실패', { orderNo, code: r.errorCode });
  return { sent: r.ok };
};

export interface ShowOperatorMailData {
  orderNo: string;
  showId: string;
  showTitle: string;
  buyerName: string;
  buyerContact: string;
  startsAtSec: number;
  totalAmount: number;
  tickets: Array<{ typeName: string }>;
}

/** 연락처가 이메일이면 mailto:, 전화번호면 tel: — 운영자가 받은편지함에서 바로 누른다. 그 밖은 링크 없음. */
const contactHref = (contact: string): string | undefined => {
  const t = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
  const digits = t.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 8 ? `tel:${digits}` : undefined;
};

/** 티켓 종류별 매수 요약 — "일반 2매 · 학생 1매". */
const ticketSummary = (tickets: Array<{ typeName: string }>): string => {
  const counts = new Map<string, number>();
  for (const t of tickets) counts.set(t.typeName, (counts.get(t.typeName) ?? 0) + 1);
  const parts = [...counts].map(([name, n]) => `${name} ${n}매`);
  return `${tickets.length}매${counts.size > 0 ? ` (${parts.join(' · ')})` : ''}`;
};

/** 카드 결제 완료 운영자 알림. 계좌 입금 확인은 운영자가 직접 누른 일이라 보내지 않는다. */
export const buildShowPaymentOperatorEmail = (d: ShowOperatorMailData): { subject: string; text: string; html: string } => {
  const when = showDateTimeLabel(d.startsAtSec);
  const amount = `${formatPriceAmount(d.totalAmount)}원`;
  const tickets = ticketSummary(d.tickets);
  const manage = adminUrl(`/admin/shows/${d.showId}`);
  return {
    subject: `[공연 예매] 결제 완료 — ${d.showTitle} ${when} · ${d.buyerName}`,
    text: [
      '공연 티켓 결제가 완료되었습니다.',
      `공연: ${d.showTitle}`,
      `회차: ${when}`,
      `티켓: ${tickets}`,
      `금액: ${amount} (VAT 포함)`,
      `구매자: ${d.buyerName} / ${d.buyerContact}`,
      `주문번호: ${d.orderNo}`,
      `관리자: ${manage}`,
    ].join('\n'),
    html: buildEmailLayout({
      audience: 'operator',
      preheader: `${d.showTitle} ${when} · ${tickets} · ${amount}`,
      heading: '공연 티켓 결제가 완료되었습니다',
      paragraphs: [`${escapeHtml(d.buyerName)}님이 카드로 결제했습니다. 티켓은 자동으로 발권되어 고객에게 메일이 나갑니다.`],
      rows: [
        { label: '공연', value: d.showTitle },
        { label: '회차', value: when },
        { label: '티켓', value: tickets },
        { label: '금액', value: amount, emphasis: true },
        { label: '구매자', value: d.buyerName },
        { label: '연락처', value: d.buyerContact, href: contactHref(d.buyerContact) },
        { label: '주문번호', value: d.orderNo },
      ],
      cta: { label: '관리자에서 보기', url: manage },
    }),
  };
};

/**
 * 카드 결제로 **새로 확정된** 주문의 운영자 알림 한 통. 호출부: `confirmShowOrder`가 `confirmed`를 돌려주는 자리 한 곳.
 * 그 자리는 orders가 paid로 바뀐 batch를 이긴 실행만 지나므로(웹훅 재전달·새로고침·경합의 진 쪽은 `already_confirmed`)
 * 주문당 한 통이다. 실패해도 확정은 그대로이고 로그만 남긴다 — `notificationError`(고객 메일 발송 센티널)는 건드리지 않는다.
 */
export const notifyShowPaymentToOperator = async (orderNo: string): Promise<void> => {
  try {
    const data = await loadShowOrder(orderNo, { localize: false });
    if (!data) return;
    const { subject, text, html } = buildShowPaymentOperatorEmail(data);
    const r = await sendEmail({ to: OPERATOR_EMAIL, subject, text, html });
    if (!r.ok) console.error('[shows-email] 운영자 결제 알림 발송 실패', { orderNo, code: r.errorCode });
  } catch (error) {
    console.error('[shows-email] 운영자 결제 알림 예외', { orderNo, error: (error as Error).message });
  }
};

export interface ShowRefundOperatorMailData extends ShowOperatorMailData {
  refundedAmount: number;
  refundedCount: number;
  refundVia: ShowRefundVia;
}

/**
 * 고객 셀프 환불의 운영자 알림 — 순수 함수. 카드 결제는 토스가 이미 돌려줬다는 안내, 계좌 입금 결제는
 * **운영자가 환불 계좌로 송금해야 한다**는 할 일이다(관리자 공연 화면의 환불 계좌 패널 "송금 완료").
 */
export const buildShowRefundOperatorEmail = (d: ShowRefundOperatorMailData): { subject: string; text: string; html: string } => {
  const when = showDateTimeLabel(d.startsAtSec);
  const amount = `${formatPriceAmount(d.refundedAmount)}원`;
  const manage = adminUrl(`/admin/shows/${d.showId}`);
  const needsTransfer = d.refundVia === 'bank_account';
  const lead = needsTransfer
    ? `${d.buyerName}님이 계좌 입금으로 산 티켓 ${d.refundedCount}매를 취소했습니다. 고객이 적은 환불 계좌로 ${amount}을 보내고 관리자 화면에서 "송금 완료"를 눌러 주세요.`
    : `${d.buyerName}님이 티켓 ${d.refundedCount}매를 취소했습니다. 카드 결제는 ${amount}이 자동으로 환불되었습니다.`;
  return {
    subject: `[공연 예매] ${needsTransfer ? '환불 송금 필요' : '고객 환불'} ${amount} — ${d.showTitle} ${when} · ${d.buyerName}`,
    text: [
      lead,
      `공연: ${d.showTitle}`,
      `회차: ${when}`,
      `환불: ${d.refundedCount}매 · ${amount}`,
      `구매자: ${d.buyerName} / ${d.buyerContact}`,
      `주문번호: ${d.orderNo}`,
      `관리자: ${manage}`,
    ].join('\n'),
    html: buildEmailLayout({
      audience: 'operator',
      ...(needsTransfer
        ? { noticeTone: 'alert' as const, notices: ['송금한 뒤 관리자 화면의 환불 계좌 칸에서 <strong>"송금 완료"</strong>를 눌러 주세요.'] }
        : {}),
      preheader: `${d.showTitle} ${when} · ${d.refundedCount}매 · ${amount}`,
      heading: needsTransfer ? '공연 티켓 환불 — 송금이 필요합니다' : '고객이 공연 티켓을 환불했습니다',
      paragraphs: [escapeHtml(lead)],
      rows: [
        { label: '공연', value: d.showTitle },
        { label: '회차', value: when },
        { label: '환불', value: `${d.refundedCount}매 · ${amount}`, emphasis: true },
        { label: '구매자', value: d.buyerName },
        { label: '연락처', value: d.buyerContact, href: contactHref(d.buyerContact) },
        { label: '주문번호', value: d.orderNo },
      ],
      cta: { label: needsTransfer ? '환불 계좌 보러 가기' : '관리자에서 보기', url: manage },
    }),
  };
};

/** 고객 셀프 환불(pages/api/shows/refund.ts)의 운영자 알림 한 통. 관리자 환불에서는 부르지 않는다. 예외는 삼킨다. */
export const notifyShowRefundToOperator = async (
  orderNo: string,
  refund: { refundedAmount: number; refundedCount: number; refundVia: ShowRefundVia },
): Promise<void> => {
  try {
    const data = await loadShowOrder(orderNo, { localize: false });
    if (!data) return;
    const r = await sendEmail({ to: OPERATOR_EMAIL, ...buildShowRefundOperatorEmail({ ...data, ...refund }) });
    if (!r.ok) console.error('[shows-email] 운영자 환불 알림 발송 실패', { orderNo, code: r.errorCode });
  } catch (error) {
    console.error('[shows-email] 운영자 환불 알림 예외', { orderNo, error: (error as Error).message });
  }
};
