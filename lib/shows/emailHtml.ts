import { buildEmailLayout, escapeHtml, strong } from '../email/layout';
import { formatPriceAmount } from '../../data/pricing';
import { formatEntryNumber } from './format';

/**
 * 공연 메일의 HTML 본문 — 순수 함수(DB·fs 없음). 텍스트 본문(lib/shows/email.ts)은 그대로 폴백으로 함께 나간다.
 *
 * 골격은 공용 레이아웃(`lib/email/layout.ts`)이다. 포스터는 `hero`, 티켓별 입장번호 카드는 `blocks`로 넣는다.
 * QR은 첨부(ticket-N.png)로 간다 — Gmail이 data URL을 막고 우리 발송 모듈이 cid 인라인을 지원하지 않는다.
 * 그래서 본문의 주 버튼은 "내 티켓(QR) 열기"다.
 */

const INK = '#1a1a1a';
const BODY = '#374151';
const MUTED = '#666666';
const LINE = '#e5e5e5';

export interface TicketEmailHtmlInput {
  buyerName: string;
  showTitle: string;
  showSubtitle?: string | null;
  posterUrl?: string | null;
  when: string;
  venueName: string;
  venueAddress: string;
  totalAmount: number;
  orderNo: string;
  manageUrl: string;
  tickets: Array<{ typeName: string; entryNumber: number | null; code: string }>;
  refundLines: string[];
  contact: string;
}

/** 티켓 한 장 = 카드 한 장. 입장번호가 가장 크게 보이게 한다(현장에서 부르는 번호). */
const ticketCards = (tickets: TicketEmailHtmlInput['tickets']): string => {
  const cards = tickets
    .map(
      (t, i) => `
      <tr>
        <td style="padding: 12px 16px; ${i > 0 ? `border-top: 1px solid ${LINE};` : ''}">
          <div style="color: ${MUTED}; font-size: 12px;">티켓 ${i + 1}</div>
          <div style="margin-top: 2px; color: ${INK}; font-size: 15px; font-weight: 700;">${escapeHtml(t.typeName)}${t.entryNumber != null ? ` <span style="font-weight: 400; color: ${BODY};">· 입장 번호</span> <span style="font-size: 20px;">${formatEntryNumber(t.entryNumber)}</span>` : ''}</div>
          <div style="margin-top: 4px; color: ${MUTED}; font-size: 12px;">QR: 첨부 ticket-${i + 1}.png · 코드 <span style="font-family: Menlo, Consolas, monospace;">${escapeHtml(t.code)}</span></div>
        </td>
      </tr>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 0 0 24px; background-color: #ffffff; border: 1px solid ${LINE}; border-radius: 10px; border-collapse: separate;">
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid ${LINE}; color: ${INK}; font-size: 14px; font-weight: 700;">티켓 ${tickets.length}매</td></tr>
      ${cards}
    </table>`;
};

export const buildShowTicketEmailHtml = (d: TicketEmailHtmlInput): string =>
  buildEmailLayout({
    preheader: `${d.showTitle} ${d.when} — 내 티켓(QR)을 열어 입장하세요.`,
    heading: '티켓이 발권됐어요',
    hero: d.posterUrl ? { imageUrl: d.posterUrl, alt: d.showTitle } : undefined,
    paragraphs: [
      `${escapeHtml(d.buyerName)}님, 결제가 확인됐어요.`,
      `입장은 ${strong('비지정석 선착순')}이에요. 현장에서 아래 버튼의 QR이나 첨부 이미지를 보여 주세요.`,
    ],
    rows: [
      { label: '공연', value: d.showSubtitle ? `${d.showTitle} — ${d.showSubtitle}` : d.showTitle },
      { label: '일시', value: d.when, emphasis: true },
      { label: '장소', value: `${d.venueName} (${d.venueAddress})` },
      { label: '결제 금액', value: `${formatPriceAmount(d.totalAmount)}원 (VAT 포함)`, emphasis: true },
      { label: '주문번호', value: d.orderNo },
    ],
    blocks: d.tickets.length > 0 ? [ticketCards(d.tickets)] : undefined,
    cta: { label: '내 티켓(QR) 열기', url: d.manageUrl },
    notices: [
      ...(d.refundLines.length > 0 ? [`${strong('취소·환불 규정')}<br />${d.refundLines.map(escapeHtml).join('<br />')}`] : []),
      '환불 신청은 "내 티켓" 페이지에서 티켓별로 할 수 있어요.',
    ],
  });

/**
 * 환불이 어디로 갔는가 — `payment` 토스 결제 취소(결제 수단으로), `bank_account` 계좌 입금 주문의 **고객 요청**
 * (적어 준 환불 계좌로 앞으로 송금 — 접수만 됐다), `bank_account_sent` 계좌 입금 주문을 **관리자가 기록**한 환불
 * (운영자가 이미 송금했다 — "3영업일 이내"라고 쓰면 안 된다).
 */
export type ShowRefundVia = 'payment' | 'bank_account' | 'bank_account_sent';

/** 메일 제목·머리말·첫 줄 — 고객 요청 계좌 환불은 아직 돈이 안 갔으니 "완료"라고 쓰지 않는다. */
export const showRefundHeading = (refundVia: ShowRefundVia | undefined): string =>
  refundVia === 'bank_account' ? '환불 요청을 접수했어요' : '환불이 완료됐어요';

/** 환불 방법 한 줄. */
export const showRefundViaSentence = (refundVia: ShowRefundVia | undefined): string =>
  refundVia === 'bank_account'
    ? '계좌로 입금하신 주문이라 적어 주신 환불 계좌로 접수일부터 3영업일 이내에 보내 드려요. 계좌를 잘못 적으셨다면 이 메일에 회신해 주세요.'
    : refundVia === 'bank_account_sent'
      ? '계좌로 입금하신 주문이라 환불 금액을 계좌로 보내 드렸어요. 받지 못하셨다면 이 메일에 회신해 주세요.'
      : '카드 결제는 카드사에 따라 취소 반영까지 영업일 기준 며칠이 걸릴 수 있어요.';

/**
 * 회차 취소 안내의 환불 문장. `bankNotice` — 계좌 입금 주문은 토스로 돌려줄 수 없다: 입금이 확인된 주문은
 * 내 티켓 페이지에서 환불 계좌를 적어 달라고(`refund_account_needed`), 입금 전 신청은 입금하지 말라고(`not_deposited`).
 */
export const showtimeCancelledRefundSentence = (d: {
  totalAmount: number; refundCompleted: boolean; bankNotice?: 'refund_account_needed' | 'not_deposited';
}): string => {
  if (d.bankNotice === 'not_deposited') return '입금 전인 신청은 함께 취소됐어요. 입금하지 않으셔도 돼요. 이미 보내셨다면 이 메일에 회신해 주세요 — 확인해 돌려드려요.';
  if (d.bankNotice === 'refund_account_needed') return `계좌로 입금하신 ${formatPriceAmount(d.totalAmount)}원은 전액 돌려드려요. 아래 "주문 내역 보기"에서 환불받을 계좌를 적어 주시면 3영업일 이내에 보내 드려요.`;
  return d.refundCompleted
    ? `결제하신 ${formatPriceAmount(d.totalAmount)}원은 전액 환불 처리됐어요. 카드사에 따라 취소 반영까지 영업일 기준 며칠이 걸릴 수 있어요.`
    : '환불은 접수되어 처리 중이에요. 완료되면 다시 안내드려요.';
};

export const buildShowRefundEmailHtml = (d: {
  buyerName: string; showTitle: string; when: string; orderNo: string; refundedAmount: number; fullyRefunded: boolean; manageUrl: string; contact: string;
  refundVia?: ShowRefundVia;
}): string => {
  return buildEmailLayout({
    preheader: `${d.showTitle} — 환불 금액 ${formatPriceAmount(d.refundedAmount)}원`,
    heading: showRefundHeading(d.refundVia),
    paragraphs: [
      d.refundVia === 'bank_account'
        ? `${escapeHtml(d.buyerName)}님, 신청하신 환불을 접수했어요.`
        : `${escapeHtml(d.buyerName)}님, 신청하신 환불이 처리됐어요.`,
      d.fullyRefunded
        ? '이 주문의 티켓은 모두 환불되어 입장에 사용할 수 없어요.'
        : '환불한 티켓은 입장에 사용할 수 없어요. 남은 티켓은 그대로 사용할 수 있어요.',
    ],
    rows: [
      { label: '공연', value: `${d.showTitle} ${d.when}` },
      { label: '환불 금액', value: `${formatPriceAmount(d.refundedAmount)}원`, emphasis: true },
      { label: '주문번호', value: d.orderNo },
    ],
    cta: { label: '주문 내역 보기', url: d.manageUrl },
    notices: [escapeHtml(showRefundViaSentence(d.refundVia))],
  });
};

export const buildShowtimeCancelledEmailHtml = (d: {
  buyerName: string; showTitle: string; when: string; orderNo: string; totalAmount: number; refundCompleted: boolean; manageUrl: string; contact: string;
  bankNotice?: 'refund_account_needed' | 'not_deposited';
}): string => {
  return buildEmailLayout({
    preheader: `${d.showTitle} ${d.when} 회차가 취소됐어요.`,
    heading: '공연 회차가 취소됐어요',
    paragraphs: [
      `${escapeHtml(d.buyerName)}님, 예매하신 회차가 취소되어 안내드려요.`,
      escapeHtml(showtimeCancelledRefundSentence(d)),
    ],
    rows: [
      { label: '공연', value: d.showTitle },
      { label: '취소된 회차', value: d.when, emphasis: true },
      { label: '주문번호', value: d.orderNo },
    ],
    cta: { label: '주문 내역 보기', url: d.manageUrl },
  });
};
