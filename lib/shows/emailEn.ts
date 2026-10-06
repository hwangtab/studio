import { buildEmailLayout, escapeHtml, strong } from '../email/layout';
import { formatPriceAmount } from '../../data/pricing';
import { formatEntryNumber, formatShowtimeLabel } from './format';
import type { ShowRefundVia } from './emailHtml';
import { SHOW_CONTACT_PHONE_INTL } from './i18n';
import { refundTierLinesEn } from './refundPolicy';

/**
 * 공연 메일의 영어판 — 영어 화면(/en/shows)으로 예매한 주문(`show_order_locales`)에만 나간다. 순수 함수.
 * 한국어판(lib/shows/email.ts·emailHtml.ts)과 같은 구성·같은 사실이다. 한쪽을 고치면 다른 쪽도 고친다.
 * 공연 제목·장소·티켓 이름은 호출부(email.ts loadShowOrder)가 이미 영어로 바꿔 넘긴다.
 */

const KST_OFFSET_SEC = 9 * 3600;
const won = (n: number): string => `₩${formatPriceAmount(n)}`;
const CONTACT = `${SHOW_CONTACT_PHONE_INTL} · hello@studionol.co.kr`;

/** 회차 일시 — 연도를 붙인 KST 표기. 예) Sat, Oct 24, 2026, 18:30 KST */
export const showDateTimeLabelEn = (startsAtSec: number): string => {
  const year = new Date((startsAtSec + KST_OFFSET_SEC) * 1000).getUTCFullYear();
  return formatShowtimeLabel(startsAtSec, 'en').replace(/, (\d{2}:\d{2} KST)$/, `, ${year}, $1`);
};

interface TicketMail {
  orderNo: string;
  manageUrl: string;
  buyerName: string;
  showTitle: string;
  showSubtitle?: string | null;
  posterUrl?: string | null;
  venueName: string;
  venueAddress: string;
  startsAtSec: number;
  totalAmount: number;
  tickets: Array<{ code: string; entryNumber: number | null; typeName: string }>;
}

const LINE = '#e5e5e5';
const INK = '#1a1a1a';
const BODY = '#374151';
const MUTED = '#666666';

const ticketCards = (tickets: TicketMail['tickets']): string => {
  const cards = tickets
    .map(
      (t, i) => `
      <tr>
        <td style="padding: 12px 16px; ${i > 0 ? `border-top: 1px solid ${LINE};` : ''}">
          <div style="color: ${MUTED}; font-size: 12px;">Ticket ${i + 1}</div>
          <div style="margin-top: 2px; color: ${INK}; font-size: 15px; font-weight: 700;">${escapeHtml(t.typeName)}${t.entryNumber != null ? ` <span style="font-weight: 400; color: ${BODY};">· Entry no.</span> <span style="font-size: 20px;">${formatEntryNumber(t.entryNumber)}</span>` : ''}</div>
          <div style="margin-top: 4px; color: ${MUTED}; font-size: 12px;">QR: attached ticket-${i + 1}.png · Code <span style="font-family: Menlo, Consolas, monospace;">${escapeHtml(t.code)}</span></div>
        </td>
      </tr>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 0 0 24px; background-color: #ffffff; border: 1px solid ${LINE}; border-radius: 10px; border-collapse: separate;">
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid ${LINE}; color: ${INK}; font-size: 14px; font-weight: 700;">${tickets.length} ticket${tickets.length === 1 ? '' : 's'}</td></tr>
      ${cards}
    </table>`;
};

export const buildShowTicketEmailEn = (d: TicketMail): { subject: string; text: string; html: string } => {
  const when = showDateTimeLabelEn(d.startsAtSec);
  const fullTitle = d.showSubtitle ? `${d.showTitle} — ${d.showSubtitle}` : d.showTitle;
  const refund = refundTierLinesEn();
  return {
    subject: `[Studio NOL] Your ticket is ready — ${d.showTitle}, ${when}`,
    html: buildEmailLayout({
      locale: 'en',
      preheader: `${d.showTitle}, ${when} — open your ticket (QR code) to get in.`,
      heading: 'Your ticket has been issued',
      hero: d.posterUrl ? { imageUrl: d.posterUrl, alt: d.showTitle } : undefined,
      paragraphs: [
        `Hi ${escapeHtml(d.buyerName)}, your payment has been confirmed.`,
        `Admission is ${strong('general admission, first come, first served')}. At the door, show the QR code from the button below or the attached image.`,
      ],
      rows: [
        { label: 'Show', value: fullTitle },
        { label: 'Date', value: when, emphasis: true },
        { label: 'Venue', value: `${d.venueName} (${d.venueAddress})` },
        { label: 'Amount paid', value: `${won(d.totalAmount)} (VAT incl.)`, emphasis: true },
        { label: 'Order no.', value: d.orderNo },
      ],
      blocks: d.tickets.length > 0 ? [ticketCards(d.tickets)] : undefined,
      cta: { label: 'Open my tickets (QR)', url: d.manageUrl },
      notices: [
        `${strong('Refund policy')}<br />${refund.map(escapeHtml).join('<br />')}`,
        'You can request a refund for each ticket on the “My tickets” page.',
      ],
    }),
    text: [
      `Hi ${d.buyerName}, your payment has been confirmed and your ticket has been issued.`,
      '',
      `Show: ${fullTitle}`,
      `Date: ${when}`,
      `Venue: ${d.venueName} (${d.venueAddress})`,
      `Amount paid: ${won(d.totalAmount)} (VAT incl.)`,
      `Order no.: ${d.orderNo}`,
      '',
      `${d.tickets.length} ticket${d.tickets.length === 1 ? '' : 's'}`,
      ...d.tickets.map((t, i) =>
        `${i + 1}. ${t.typeName}${t.entryNumber != null ? ` · Entry no. ${formatEntryNumber(t.entryNumber)}` : ''}\n   Ticket code: ${t.code}\n   QR: attached ticket-${i + 1}.png`),
      '',
      'Show the QR image at the door. If you cannot see the attachment, open your ticket from the link below.',
      `My tickets / refunds: ${d.manageUrl}`,
      '',
      'Refund policy',
      ...refund.map((l) => `- ${l}`),
      '',
      `Contact: ${CONTACT}`,
    ].join('\n'),
  };
};

const refundHeading = (via: ShowRefundVia | undefined): string =>
  via === 'bank_account' ? 'We have received your refund request' : 'Your refund is complete';

const refundViaSentence = (via: ShowRefundVia | undefined): string =>
  via === 'bank_account'
    ? 'You paid by bank transfer, so we will send the refund to the account you entered within 3 business days of the request. If you entered the wrong account, please contact us.'
    : via === 'bank_account_sent'
      ? 'You paid by bank transfer, so we have sent the refund to your bank account. If you have not received it, please contact us.'
      : 'For card payments, it may take a few business days for the cancellation to appear, depending on your card company.';

export const buildShowRefundEmailEn = (d: {
  orderNo: string; manageUrl: string; buyerName: string; showTitle: string; startsAtSec: number;
  refundedAmount: number; fullyRefunded: boolean; refundVia?: ShowRefundVia;
}): { subject: string; text: string; html: string } => {
  const when = showDateTimeLabelEn(d.startsAtSec);
  const heading = refundHeading(d.refundVia);
  const remaining = d.fullyRefunded
    ? 'All tickets in this order have been refunded and can no longer be used for entry.'
    : 'Refunded tickets can no longer be used for entry. Your remaining tickets are still valid.';
  return {
    subject: `[Studio NOL] ${heading} — ${d.showTitle}`,
    html: buildEmailLayout({
      locale: 'en',
      preheader: `${d.showTitle} — refund ${won(d.refundedAmount)}`,
      heading,
      paragraphs: [
        d.refundVia === 'bank_account'
          ? `Hi ${escapeHtml(d.buyerName)}, we have received your refund request.`
          : `Hi ${escapeHtml(d.buyerName)}, your refund has been processed.`,
        remaining,
      ],
      rows: [
        { label: 'Show', value: `${d.showTitle}, ${when}` },
        { label: 'Refund amount', value: won(d.refundedAmount), emphasis: true },
        { label: 'Order no.', value: d.orderNo },
      ],
      cta: { label: 'View order', url: d.manageUrl },
      notices: [escapeHtml(refundViaSentence(d.refundVia))],
    }),
    text: [
      `Hi ${d.buyerName}, ${heading.charAt(0).toLowerCase()}${heading.slice(1)}.`,
      '',
      `Show: ${d.showTitle} (${when})`,
      `Order no.: ${d.orderNo}`,
      `Refund amount: ${won(d.refundedAmount)}`,
      remaining,
      refundViaSentence(d.refundVia),
      '',
      `Order: ${d.manageUrl}`,
      `Contact: ${CONTACT}`,
    ].join('\n'),
  };
};

const cancelledRefundSentence = (d: {
  totalAmount: number; refundCompleted: boolean; bankNotice?: 'refund_account_needed' | 'not_deposited';
}): string => {
  if (d.bankNotice === 'not_deposited')
    return 'Your request that had not yet been paid has been cancelled too. You do not need to transfer anything. If you already sent money, please contact us and we will return it.';
  if (d.bankNotice === 'refund_account_needed')
    return `We will refund the full ${won(d.totalAmount)} you paid by bank transfer. Enter your refund account under “View order” below and we will send it within 3 business days.`;
  return d.refundCompleted
    ? `The full ${won(d.totalAmount)} you paid has been refunded. Depending on your card company, it may take a few business days to appear.`
    : 'Your refund is being processed. We will let you know when it is complete.';
};

export const buildShowtimeCancelledEmailEn = (d: {
  orderNo: string; manageUrl: string; buyerName: string; showTitle: string; startsAtSec: number; totalAmount: number;
  refundCompleted: boolean; bankNotice?: 'refund_account_needed' | 'not_deposited';
}): { subject: string; text: string; html: string } => {
  const when = showDateTimeLabelEn(d.startsAtSec);
  const sentence = cancelledRefundSentence(d);
  return {
    subject: `[Studio NOL] Showtime cancelled — ${d.showTitle}, ${when}`,
    html: buildEmailLayout({
      locale: 'en',
      preheader: `${d.showTitle}, ${when} has been cancelled.`,
      heading: 'A showtime has been cancelled',
      paragraphs: [
        `Hi ${escapeHtml(d.buyerName)}, we are sorry to let you know that the showtime you booked has been cancelled.`,
        escapeHtml(sentence),
      ],
      rows: [
        { label: 'Show', value: d.showTitle },
        { label: 'Cancelled showtime', value: when, emphasis: true },
        { label: 'Order no.', value: d.orderNo },
      ],
      cta: { label: 'View order', url: d.manageUrl },
    }),
    text: [
      `Hi ${d.buyerName}, the showtime below that you booked has been cancelled.`,
      '',
      `Show: ${d.showTitle}`,
      `Cancelled showtime: ${when}`,
      `Order no.: ${d.orderNo}`,
      sentence,
      '',
      `Order: ${d.manageUrl}`,
      `Contact: ${CONTACT}`,
    ].join('\n'),
  };
};
