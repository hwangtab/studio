import { sendEmail, type SendEmailError } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import { isPurgedValue } from '../privacy/orderRetention';
import type { Booking, Order, WorkOrder } from '../../db/schema';
import { formatPriceAmount } from '../../data/pricing';
import { getSiteConfig } from '../../data/siteConfig';
import { MIXING_REFUND_POLICY_LINES } from './refund-policy';
import { getMixingProduct } from './mixing-products';
import { kstDateString } from './kst';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

const kstTimeLabel = (d: Date): string => {
  const t = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${kstDateString(d)} ${String(t.getUTCHours()).padStart(2, '0')}:00`;
};


const manageUrl = (order: Order): string =>
  `${SITE_URL}/ko/booking/manage/${order.orderNo}?token=${order.manageToken}`;

/**
 * 고객에게 가는 한 통. 실패하면 errorCode를, 성공하면 null을 돌려준다.
 *
 * **보관 기간이 지나 파기된 주문은 보내지도, 실패로 세지도 않는다.** 그 주문은 이메일 칸이
 * `PURGED_MARK`로 덮여 있어(`lib/privacy/orderRetention.ts`) 보낼 곳이 아예 없다.
 * resend.ts가 발송 자체는 막지만 그것만으로는 부족하다 — `UNDELIVERABLE_ADDRESS`를 실패로
 * 세면 그 문자열이 `orders.notificationError`에 남고, 헬스체크의 '확인 메일이 나가지 않은
 * 주문' 경보가 매일 영원히 울린다(`lib/ops/healthCheck.ts`). 그 경보가 안내하는 해소 방법이
 * 알림 재발송인데, 재발송은 같은 문자열을 다시 쓴다. 나이 게이트가 없는 관리자 재발송
 * (`pages/api/admin/bookings/[id].ts`)이 실제로 그 경로다.
 *
 * **RFC 2606 시험용 주소는 여기서 가르지 않는다** — 그쪽 실패는 세는 편이 맞다. 보낼 곳이
 * 사라진 것과 잘못된 주소가 들어온 것은 다른 사건이다. 펀딩 쪽
 * (`lib/funding/email.ts`의 `withoutUndeliverableCustomer`)과 같은 판정이다.
 *
 * 운영자 사본은 이 함수를 지나지 않는다 — 주소가 우리 것이라 파기와 무관하고, 파기된
 * 주문이라도 운영자가 무슨 일이 있었는지는 알아야 한다.
 */
const sendCustomerEmail = async (
  order: Order, params: Parameters<typeof sendEmail>[0],
): Promise<SendEmailError | null> => {
  if (isPurgedValue(order.customerEmail)) return null;
  const r = await sendEmail(params);
  if (r.ok) return null;
  // 지금은 모든 실패 경로가 errorCode를 싣지만, 없더라도 실패는 실패로 센다 —
  // null을 돌려주면 파기 건과 구분되지 않고 조용히 성공으로 기록된다.
  return r.errorCode ?? 'API_ERROR';
};

/** 두 통 중 하나라도 실패하면 요약을 돌려준다 — 성공 null (notificationError 패턴). */
export const sendBookingConfirmedEmails = async (order: Order, booking: Booking): Promise<string | null> => {
  const when = kstTimeLabel(booking.startAt);
  const failures: string[] = [];

  const customerError = await sendCustomerEmail(order, {
    to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
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
  if (customerError) failures.push(`customer:${customerError}`);

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
  const customerError = await sendCustomerEmail(order, {
    to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] 예약이 취소되었습니다 — ${when}`,
    text: [
      `${order.customerName}님, 예약이 취소되었습니다.`,
      `환불 금액: ${formatPriceAmount(refundAmount)}원 (결제 수단으로 환불, 카드사에 따라 3~5영업일 소요)`,
      `주문번호: ${order.orderNo}`,
    ].join('\n'),
  });
  if (customerError) failures.push(`customer:${customerError}`);
  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[예약 취소] ${when} — ${order.customerName} (환불 ${formatPriceAmount(refundAmount)}원)`,
    text: `주문 ${order.orderNo} 취소. 관리자: ${SITE_URL}/admin/bookings`,
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);
  return failures.length ? failures.join(', ') : null;
};

/** 믹싱은 기본 2회, 마스터링은 기본 1회 — mixing-mastering 페이지 FAQ 정본과 같은 숫자다. */
const revisionCountLabel = (serviceType: WorkOrder['serviceType']): string =>
  serviceType === 'mastering' ? '1회' : '2회';

/**
 * 믹싱·마스터링 주문(work_orders) 확정 메일.
 *
 * 세션과 달리 파일을 받아야 작업이 시작되므로, 보낼 파일 목록과 받는 방법(메일 회신 +
 * 카카오톡 병행, 계획서 §0 확정 사항)을 안내하는 것이 이 메일의 핵심이다.
 */
export const sendMixingOrderConfirmedEmails = async (order: Order, workOrder: WorkOrder): Promise<string | null> => {
  const product = getMixingProduct(workOrder.productId);
  const productName = product?.nameKo ?? workOrder.serviceType;
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  const failures: string[] = [];

  const customerError = await sendCustomerEmail(order, {
    to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] 주문이 접수되었습니다 — ${productName}`,
    text: [
      `${order.customerName}님, 주문이 접수되었습니다.`,
      `상품: ${productName} × ${workOrder.songCount}곡${workOrder.vocalTuning ? ' (보컬 튜닝 옵션 포함)' : ''}`,
      `결제 금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
      `주문번호: ${order.orderNo}`,
      '',
      '파일을 보내주세요 — 이 메일에 회신으로 구글 드라이브·WeTransfer 등 다운로드 링크를 보내주시거나,',
      `카카오톡 오픈채팅으로 보내셔도 됩니다: ${kakaoUrl}`,
      '',
      '보낼 파일',
      '- 드라이 보컬 WAV',
      '- MR 또는 트랙별 스템 WAV',
      '- 레퍼런스 1~2곡',
      '(WAV 24bit/44.1 또는 48kHz 권장)',
      '',
      `납기: 파일 확인 후 3~7영업일`,
      `수정: ${revisionCountLabel(workOrder.serviceType)} 기본 포함`,
      '',
      `주문 확인·취소: ${manageUrl(order)}`,
      ...MIXING_REFUND_POLICY_LINES,
      '문의: 010-4255-7893',
    ].join('\n'),
  });
  if (customerError) failures.push(`customer:${customerError}`);

  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[믹싱 주문] ${productName} × ${workOrder.songCount}곡 — ${order.customerName}`,
    text: [
      '새 믹싱·마스터링 주문이 결제 완료되었습니다.',
      `상품: ${productName} × ${workOrder.songCount}곡${workOrder.vocalTuning ? ' (보컬 튜닝 옵션)' : ''}`,
      `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
      `금액: ${formatPriceAmount(order.totalAmount)}원`,
      `요청사항: ${workOrder.customerNote ?? '없음'}`,
      `관리자: ${SITE_URL}/admin/bookings`,
    ].join('\n'),
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);

  return failures.length ? failures.join(', ') : null;
};

export const sendMixingOrderCancelledEmails = async (
  order: Order, workOrder: WorkOrder, refundAmount: number,
): Promise<string | null> => {
  const product = getMixingProduct(workOrder.productId);
  const productName = product?.nameKo ?? workOrder.serviceType;
  const failures: string[] = [];

  const customerError = await sendCustomerEmail(order, {
    to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] 주문이 취소되었습니다 — ${productName}`,
    text: [
      `${order.customerName}님, 주문이 취소되었습니다.`,
      `환불 금액: ${formatPriceAmount(refundAmount)}원 (결제 수단으로 환불, 카드사에 따라 3~5영업일 소요)`,
      `주문번호: ${order.orderNo}`,
    ].join('\n'),
  });
  if (customerError) failures.push(`customer:${customerError}`);
  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[믹싱 주문 취소] ${productName} — ${order.customerName} (환불 ${formatPriceAmount(refundAmount)}원)`,
    text: `주문 ${order.orderNo} 취소. 관리자: ${SITE_URL}/admin/bookings`,
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);
  return failures.length ? failures.join(', ') : null;
};
