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
/**
 * 연습실 시간제 입장 안내. **비밀번호는 전부 환경변수에서 온다** — 이 저장소는 공개라
 * 문·방·와이파이 비밀번호를 코드에 적으면 그대로 새어 나간다.
 *
 * 하나라도 비어 있으면 안내 대신 "별도로 보내드립니다"를 싣고 `missing`을 돌려준다.
 * 호출부는 그걸 운영자 메일에 경고로 넣고 notificationError에도 남긴다 — 결제는 됐는데
 * 손님이 문을 못 여는 상황은 사고이므로 건강 점검이 매일 알려야 한다.
 *
 * 문구는 2026-09-24 운영자가 준 카카오톡 안내문을 옮긴 것이다. 문자·알림톡 발송은
 * 나중 단계(솔라피 연동 뒤)이고, 지금은 확정 메일이 이 역할을 한다.
 */
export const buildPracticeRoomGuide = (roomNumber: string | null): { text: string; missing: string[] } => {
  const room = roomNumber ?? '';
  const roomKey = room.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const env = {
    entrance: process.env.PRACTICE_ROOM_ENTRANCE_CODE,
    room: room ? process.env[`PRACTICE_ROOM_ROOM_CODE_${roomKey}`] : undefined,
    wifiSsid: process.env.PRACTICE_ROOM_WIFI_SSID,
    wifiPassword: process.env.PRACTICE_ROOM_WIFI_PASSWORD,
    restroom: process.env.PRACTICE_ROOM_RESTROOM_CODE || process.env.PRACTICE_ROOM_ENTRANCE_CODE,
  };
  const missing: string[] = [];
  if (!room) missing.push('roomNumber');
  if (!env.entrance) missing.push('PRACTICE_ROOM_ENTRANCE_CODE');
  if (room && !env.room) missing.push(`PRACTICE_ROOM_ROOM_CODE_${roomKey}`);
  if (!env.wifiSsid) missing.push('PRACTICE_ROOM_WIFI_SSID');
  if (!env.wifiPassword) missing.push('PRACTICE_ROOM_WIFI_PASSWORD');
  if (missing.length) {
    return {
      missing,
      text: [
        '🏠 입장 안내',
        '입구·방·와이파이 비밀번호는 이용 전에 별도로 보내드립니다.',
        '받지 못하셨으면 010-4255-7893으로 연락 주세요.',
      ].join('\n'),
    };
  }
  return {
    missing,
    text: [
      '🏠 입장 방법',
      `• 스튜디오 입구에서 <${env.entrance}>을 누르시면 문이 열립니다. 가끔 문이 열려 있을 때도 있답니다!`,
      `• ${room}번 방을 준비해 두었어요! 방 비밀번호는 <${env.room}>입니다. 💕`,
      '',
      '🌐 인터넷 연결',
      `• 와이파이: ${env.wifiSsid}`,
      `• 비밀번호: ${env.wifiPassword}`,
      '',
      `🚽 화장실은 밖으로 나가셔서 엘리베이터 왼쪽에 있어요. 비밀번호는 <${env.restroom}>입니다. 항상 청결하게 관리하고 있으니 안심하세요!`,
      '✅ 퇴실하실 때는 전등과 냉난방기기를 꼭! 꺼주시는 센스! 💫',
      '',
      '궁금하신 점이나 필요한 것이 있으시면 언제든지 연락 주세요. 즐겁고 보람 있는 연습 시간 보내세요! 항상 응원합니다! 💕🎵✨',
    ].join('\n'),
  };
};

export const sendBookingConfirmedEmails = async (order: Order, booking: Booking): Promise<string | null> => {
  const when = kstTimeLabel(booking.startAt);
  const failures: string[] = [];
  const isPracticeRoom = booking.serviceType === 'practice-room';
  const guide = isPracticeRoom ? buildPracticeRoomGuide(booking.roomNumber) : null;
  const roomLine = booking.roomNumber ? `방: ${booking.roomNumber}` : null;

  const customerError = await sendCustomerEmail(order, {
    to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
    subject: isPracticeRoom
      ? `✨ 스튜디오 놀 연습실 예약 확정 — ${when}`
      : `[스튜디오 놀] 예약이 확정되었습니다 — ${when}`,
    text: [
      isPracticeRoom
        ? `${order.customerName}님, 안녕하세요! 연습실 예약이 확인되었어요~ 🎵🎤`
        : `${order.customerName}님, 예약이 확정되었습니다.`,
      `일시: ${when} (${booking.durationHours}시간)`,
      ...(roomLine ? [roomLine] : []),
      `결제 금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
      `주문번호: ${order.orderNo}`,
      ...(guide ? ['', guide.text] : []),
      '',
      `예약 확인·취소: ${manageUrl(order)}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  });
  if (customerError) failures.push(`customer:${customerError}`);

  const guideWarning = guide && guide.missing.length
    ? `⚠ 입장 안내를 못 보냈습니다 — 비어 있는 값: ${guide.missing.join(', ')}. 손님에게 비밀번호를 직접 보내야 합니다.`
    : null;

  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[예약] ${when} ${booking.serviceType}${booking.roomNumber ? ` ${booking.roomNumber}` : ''} — ${order.customerName}`,
    text: [
      `새 예약이 결제 완료되었습니다.`,
      `일시: ${when} (${booking.durationHours}시간)`,
      ...(roomLine ? [roomLine] : []),
      `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
      `금액: ${formatPriceAmount(order.totalAmount)}원`,
      `요청사항: ${booking.customerNote ?? '없음'}`,
      ...(guideWarning ? ['', guideWarning] : []),
      `관리자: ${SITE_URL}/admin/bookings`,
    ].join('\n'),
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);
  // 안내 누락은 발송 실패와 같은 무게로 남긴다 — notificationError가 채워져야 건강 점검이 잡는다.
  if (guideWarning) failures.push(`guide_missing:${guide!.missing.join('|')}`);

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
