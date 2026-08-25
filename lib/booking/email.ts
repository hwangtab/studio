import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import type { Booking, Order } from '../../db/schema';
import { formatPriceAmount } from '../../data/pricing';
import { kstDateString } from './kst';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

const kstTimeLabel = (d: Date): string => {
  const t = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${kstDateString(d)} ${String(t.getUTCHours()).padStart(2, '0')}:00`;
};

const manageUrl = (order: Order): string =>
  `${SITE_URL}/ko/booking/manage/${order.orderNo}?token=${order.manageToken}`;

/** 두 통 중 하나라도 실패하면 요약을 돌려준다 — 성공 null (notificationError 패턴). */
export const sendBookingConfirmedEmails = async (order: Order, booking: Booking): Promise<string | null> => {
  const when = kstTimeLabel(booking.startAt);
  const failures: string[] = [];

  const customer = await sendEmail({
    to: order.customerEmail,
    subject: `[스튜디오 놀] 예약이 확정되었습니다 — ${when}`,
    text: [
      `${order.customerName}님, 예약이 확정되었습니다.`,
      `일시: ${when} (${booking.durationHours}시간)`,
      `결제 금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
      `주문번호: ${order.orderNo}`,
      '',
      `예약 확인·취소: ${manageUrl(order)}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  });
  if (!customer.ok) failures.push(`customer:${customer.errorCode}`);

  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[예약] ${when} ${booking.serviceType} — ${order.customerName}`,
    text: [
      `새 예약이 결제 완료되었습니다.`,
      `일시: ${when} (${booking.durationHours}시간)`,
      `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
      `금액: ${formatPriceAmount(order.totalAmount)}원`,
      `요청사항: ${booking.customerNote ?? '없음'}`,
      `관리자: ${SITE_URL}/admin/bookings`,
    ].join('\n'),
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);

  return failures.length ? failures.join(', ') : null;
};

export const sendBookingCancelledEmails = async (
  order: Order, booking: Booking, refundAmount: number,
): Promise<string | null> => {
  const when = kstTimeLabel(booking.startAt);
  const failures: string[] = [];
  const customer = await sendEmail({
    to: order.customerEmail,
    subject: `[스튜디오 놀] 예약이 취소되었습니다 — ${when}`,
    text: [
      `${order.customerName}님, 예약이 취소되었습니다.`,
      `환불 금액: ${formatPriceAmount(refundAmount)}원 (결제 수단으로 환불, 카드사에 따라 3~5영업일 소요)`,
      `주문번호: ${order.orderNo}`,
    ].join('\n'),
  });
  if (!customer.ok) failures.push(`customer:${customer.errorCode}`);
  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[예약 취소] ${when} — ${order.customerName} (환불 ${formatPriceAmount(refundAmount)}원)`,
    text: `주문 ${order.orderNo} 취소. 관리자: ${SITE_URL}/admin/bookings`,
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);
  return failures.length ? failures.join(', ') : null;
};
