import { formatPriceAmount } from '../../data/pricing';
import { formatEntryNumber } from './format';

/**
 * 공연 메일의 HTML 본문 — 순수 함수(DB·fs 없음). 텍스트 본문(lib/shows/email.ts)은 그대로 폴백으로 함께 나간다.
 *
 * 메일 클라이언트 제약 때문에 사이트 CSS·Tailwind는 못 쓴다. 대신 사이트 토큰값을 inline으로 박는다 —
 * 잉크 `#030712`(gray-950), 보라 `#6d28d9`(primary DEFAULT, 흰 배경 AA), 회색 `#4b5563`/`#6b7280`.
 * 외부 이미지는 포스터(공개 경로) 하나뿐이고, QR은 첨부(ticket-N.png)로 간다 — Gmail이 data URL을 막고
 * 우리 발송 모듈이 cid 인라인을 지원하지 않는다. 그래서 본문의 주 버튼은 "내 티켓(QR) 열기"다.
 */

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', Helvetica, Arial, sans-serif";
const INK = '#030712';
const BODY = '#374151';
const MUTED = '#6b7280';
const PRIMARY = '#6d28d9';
const BORDER = '#e5e7eb';

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

const row = (label: string, value: string): string =>
  `<tr><td style="padding:6px 0;color:${MUTED};font-size:14px;width:72px;vertical-align:top;">${esc(label)}</td><td style="padding:6px 0;color:${INK};font-size:14px;font-weight:600;">${value}</td></tr>`;

const button = (href: string, label: string): string =>
  `<a href="${esc(href)}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:12px;">${esc(label)}</a>`;

const shell = (parts: { heading: string; lead: string; body: string; contact: string }): string => `
<div style="background:#f9fafb;padding:24px 12px;">
  <div style="max-width:560px;margin:0 auto;font-family:${FONT};color:${BODY};line-height:1.6;">
    <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:0.08em;color:${MUTED};">스튜디오 놀</p>
    <div style="background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:28px 24px;">
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:${INK};">${esc(parts.heading)}</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${BODY};">${esc(parts.lead)}</p>
      ${parts.body}
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:${MUTED};">문의 ${esc(parts.contact)} · 이 메일은 결제 안내용으로 한 번 발송됩니다.</p>
  </div>
</div>`;

const showFacts = (d: Pick<TicketEmailHtmlInput, 'showTitle' | 'showSubtitle' | 'posterUrl' | 'when' | 'venueName' | 'venueAddress'>): string => `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
  <tr>
    ${d.posterUrl ? `<td style="width:96px;vertical-align:top;padding-right:16px;"><img src="${esc(d.posterUrl)}" alt="" width="96" style="display:block;width:96px;border-radius:8px;" /></td>` : ''}
    <td style="vertical-align:top;">
      <p style="margin:0;font-size:18px;font-weight:700;color:${INK};line-height:1.35;">${esc(d.showTitle)}</p>
      ${d.showSubtitle ? `<p style="margin:2px 0 0;font-size:14px;color:${MUTED};">${esc(d.showSubtitle)}</p>` : ''}
      <p style="margin:10px 0 0;font-size:14px;color:${INK};font-weight:600;">${esc(d.when)}</p>
      <p style="margin:2px 0 0;font-size:14px;color:${BODY};">${esc(d.venueName)}<br /><span style="color:${MUTED};">${esc(d.venueAddress)}</span></p>
    </td>
  </tr>
</table>`;

export const buildShowTicketEmailHtml = (d: TicketEmailHtmlInput): string => {
  const tickets = d.tickets
    .map(
      (t, i) => `
      <tr>
        <td style="padding:12px 0;border-top:1px solid ${BORDER};">
          <p style="margin:0;font-size:13px;color:${MUTED};">티켓 ${i + 1}</p>
          <p style="margin:2px 0 0;font-size:15px;font-weight:700;color:${INK};">${esc(t.typeName)}${t.entryNumber != null ? ` <span style="font-weight:400;color:${BODY};">· 입장 번호</span> <span style="font-size:18px;">${formatEntryNumber(t.entryNumber)}</span>` : ''}</p>
          <p style="margin:4px 0 0;font-size:12px;color:${MUTED};">QR: 첨부 ticket-${i + 1}.png · 코드 <span style="font-family:Menlo,Consolas,monospace;">${esc(t.code)}</span></p>
        </td>
      </tr>`,
    )
    .join('');

  const body = `
    ${showFacts(d)}
    <p style="margin:0 0 20px;text-align:center;">${button(d.manageUrl, '내 티켓(QR) 열기')}</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BODY};">입장은 <strong style="color:${INK};">비지정석 선착순</strong>입니다. 현장에서 위 버튼의 QR이나 첨부 이미지를 보여 주세요.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tr><td style="padding:0 0 8px;font-size:14px;font-weight:700;color:${INK};">티켓 ${d.tickets.length}매</td></tr>
      ${tickets}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid ${BORDER};padding-top:8px;">
      ${row('결제 금액', `${esc(formatPriceAmount(d.totalAmount))}원 <span style="font-weight:400;color:${MUTED};">(VAT 포함)</span>`)}
      ${row('주문번호', esc(d.orderNo))}
    </table>
    <p style="margin:20px 0 4px;font-size:13px;font-weight:700;color:${INK};">취소·환불</p>
    <p style="margin:0;font-size:12px;color:${MUTED};">${d.refundLines.map(esc).join('<br />')}<br />환불 신청은 위 "내 티켓" 페이지에서 티켓별로 할 수 있습니다.</p>`;

  return shell({ heading: '티켓이 발권되었습니다', lead: `${d.buyerName}님, 결제가 확인되었습니다.`, body, contact: d.contact });
};

export const buildShowRefundEmailHtml = (d: {
  buyerName: string; showTitle: string; when: string; orderNo: string; refundedAmount: number; fullyRefunded: boolean; manageUrl: string; contact: string;
}): string => {
  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      ${row('공연', `${esc(d.showTitle)} <span style="font-weight:400;color:${MUTED};">${esc(d.when)}</span>`)}
      ${row('환불 금액', `${esc(formatPriceAmount(d.refundedAmount))}원`)}
      ${row('주문번호', esc(d.orderNo))}
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:${BODY};">${d.fullyRefunded ? '이 주문의 티켓은 모두 환불되어 입장에 사용할 수 없습니다.' : '환불한 티켓은 입장에 사용할 수 없습니다. 남은 티켓은 그대로 사용할 수 있습니다.'}<br />카드 결제는 카드사에 따라 취소 반영까지 영업일 기준 며칠이 걸릴 수 있습니다.</p>
    <p style="margin:0;text-align:center;">${button(d.manageUrl, '주문 내역 보기')}</p>`;
  return shell({ heading: '환불이 완료되었습니다', lead: `${d.buyerName}님, 신청하신 환불이 처리되었습니다.`, body, contact: d.contact });
};

export const buildShowtimeCancelledEmailHtml = (d: {
  buyerName: string; showTitle: string; when: string; orderNo: string; totalAmount: number; refundCompleted: boolean; manageUrl: string; contact: string;
}): string => {
  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      ${row('공연', esc(d.showTitle))}
      ${row('취소된 회차', esc(d.when))}
      ${row('주문번호', esc(d.orderNo))}
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:${BODY};">${d.refundCompleted ? `결제하신 ${esc(formatPriceAmount(d.totalAmount))}원은 전액 환불 처리되었습니다. 카드사에 따라 취소 반영까지 영업일 기준 며칠이 걸릴 수 있습니다.` : '환불은 접수되어 처리 중입니다. 완료되면 다시 안내드립니다.'}</p>
    <p style="margin:0;text-align:center;">${button(d.manageUrl, '주문 내역 보기')}</p>`;
  return shell({ heading: '공연 회차가 취소되었습니다', lead: `${d.buyerName}님, 예매하신 회차가 취소되어 안내드립니다.`, body, contact: d.contact });
};
