import isEmail from 'validator/lib/isEmail';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { MANUAL_PLACEHOLDER_EMAIL, MANUAL_PLACEHOLDER_PHONE } from '../privacy/manualPlaceholder';
import { splitInclusiveAmount } from './amounts';
import { calendarForService, isCalendarActive, renameBookingEvent } from './gcal';
import { getProduct } from './products';
import { MIN_AMOUNT } from './manualEntry';
import { normalizeKoreanMobile } from './validation';

/**
 * **입금 대기 예약의 고객 정보·금액 수정**(관리자) — 캘린더에서 자동 등록된 예약(lib/booking/calendarAutoImport.ts)은 이름만 짐작한 채 들어오므로,
 * 운영자가 연락처·이메일·협의 금액을 나중에 웹에서 채운다. 돈이 아직 오가지 않은 `awaiting_deposit` 세션 예약만 고친다(결제된 주문의 금액·고객 정보는
 * 결제 기록과 어긋나므로 이 경로로 바꾸지 않는다). 금액은 부가세 포함 총액을 받아 공급가·부가세로 나눈다(수기 등록의 협의가와 같다).
 * 캘린더의 `[입금 대기]` 일정 제목은 고객 이름을 담으므로 이름이 바뀌면 함께 바꾼다(실패해도 수정은 유지하고 경고만).
 */

export type ManualEditResult = { ok: true; warnings: string[] } | { ok: false; message: string };

export interface ManualEditInput {
  customerName: unknown;
  customerPhone: unknown;
  customerEmail: unknown;
  totalAmount: unknown;
}

export const updateAwaitingOrderDetails = async (orderId: string, input: ManualEditInput): Promise<ManualEditResult> => {
  const name = typeof input.customerName === 'string' ? input.customerName.trim() : '';
  if (name === '' || name.length > 50) return { ok: false, message: '고객 이름을 1~50자로 적어 주세요.' };
  const phoneRaw = typeof input.customerPhone === 'string' ? input.customerPhone.trim() : '';
  let phone = MANUAL_PLACEHOLDER_PHONE;
  if (phoneRaw !== '' && phoneRaw !== MANUAL_PLACEHOLDER_PHONE) {
    const normalized = normalizeKoreanMobile(phoneRaw);
    if (!normalized) return { ok: false, message: '연락처 형식이 올바르지 않아요. 비워 두면 기록만 남겨요.' };
    phone = normalized;
  }
  const emailRaw = typeof input.customerEmail === 'string' ? input.customerEmail.trim() : '';
  if (emailRaw !== '' && (!isEmail(emailRaw) || emailRaw.length > 254)) return { ok: false, message: '이메일 형식이 올바르지 않아요.' };
  const email = emailRaw === '' ? MANUAL_PLACEHOLDER_EMAIL : emailRaw;
  const amount = Number(input.totalAmount);
  // 빈 칸·null은 Number()가 0으로 읽는다 — 0원으로 입금 확인되면 0원 결제가 기록되므로 막는다. 너무 작은 금액(원 단위 오입력)도 수기 등록과 같은 기준으로 막는다.
  if (input.totalAmount === null || input.totalAmount === '' || !Number.isInteger(amount) || amount < MIN_AMOUNT || amount > 100_000_000) {
    return { ok: false, message: `금액을 확인해 주세요(부가세 포함 총액, ${MIN_AMOUNT.toLocaleString('ko-KR')}원 이상 원 단위).` };
  }

  const db = getDb();
  const order = await db.query.orders.findFirst({ where: (t, { eq }) => eq(t.id, orderId), with: { bookings: true } });
  const booking = order?.bookings[0];
  if (!order || !booking) return { ok: false, message: '예약을 찾을 수 없어요.' };
  if (order.type !== 'session' || order.status !== 'awaiting_deposit') return { ok: false, message: '입금 대기 중인 세션 예약만 고칠 수 있어요.' };

  const split = splitInclusiveAmount(amount);
  const updated = await db.run(sql`
    UPDATE orders SET customer_name = ${name}, customer_phone = ${phone}, customer_email = ${email},
      item_amount = ${split.itemAmount}, vat_amount = ${split.vatAmount}, total_amount = ${split.totalAmount}, updated_at = unixepoch()
    WHERE id = ${orderId} AND status = 'awaiting_deposit'
  `);
  if (Number(updated.rowsAffected) === 0) return { ok: false, message: '방금 상태가 바뀌었어요. 새로고침 후 다시 시도해 주세요.' };

  const warnings: string[] = [];
  const detailsChanged = name !== order.customerName || phone !== order.customerPhone || email !== order.customerEmail;
  if (detailsChanged && booking.gcalEventId) {
    const calendar = calendarForService(booking.serviceType);
    if (isCalendarActive(calendar, booking.roomNumber)) {
      try {
        const productName = getProduct(booking.productId)?.nameKo ?? booking.serviceType;
        // 제목(고객 이름)과 설명(연락처)을 함께 바꾼다 — 설명에 옛 플레이스홀더 연락처가 남지 않게(ensureBookingEvent와 같은 모양).
        const description = [
          `상품: ${productName} (${booking.durationHours}시간)${booking.roomNumber ? ` · 방 ${booking.roomNumber}` : ''}`,
          `고객: ${name} / ${phone} / ${email}`,
          `주문번호: ${order.orderNo}`,
          `요청사항: ${booking.customerNote ?? '없음'}`,
        ].join('\n');
        await renameBookingEvent(booking.gcalEventId, calendar, booking.roomNumber, `[입금 대기] ${productName}${booking.roomNumber ? ` ${booking.roomNumber}` : ''} — ${name}`, description);
      } catch (error) {
        console.error('[manual-edit] 캘린더 제목 변경 실패', { orderId, error: error instanceof Error ? error.message : String(error) });
        warnings.push('고객 정보는 고쳤지만 캘린더 일정은 못 바꿨어요(이름·연락처가 옛 값으로 남아 있어요).');
      }
    }
  }
  return { ok: true, warnings };
};
