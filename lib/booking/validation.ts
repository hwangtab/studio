import isEmail from 'validator/lib/isEmail';

import { daysUntilKst, kstDateTime } from './kst';
import { getProduct, resolveHours } from './products';

export const MIN_LEAD_HOURS = 24;
export const MAX_BOOK_DAYS = 60;

export interface CreateBookingPayload {
  productId: string;
  hours?: number;
  date: string; // 'YYYY-MM-DD' (KST)
  startHour: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote?: string;
  refundPolicyAgreed: true;
}

type Result = { ok: true; value: CreateBookingPayload } | { ok: false; message: string };

const PHONE_RE = /^01[016789]-?\d{3,4}-?\d{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const validateCreateBookingPayload = (body: unknown, now: Date): Result => {
  if (typeof body !== 'object' || body === null) return { ok: false, message: '잘못된 요청입니다.' };
  const b = body as Record<string, unknown>;

  const product = typeof b.productId === 'string' ? getProduct(b.productId) : undefined;
  if (!product) return { ok: false, message: '알 수 없는 상품입니다.' };

  const hours = resolveHours(product, typeof b.hours === 'number' ? b.hours : undefined);
  if (hours === null) return { ok: false, message: '예약 시간 수가 올바르지 않습니다.' };

  if (typeof b.date !== 'string' || !DATE_RE.test(b.date)) return { ok: false, message: '날짜가 올바르지 않습니다.' };
  if (typeof b.startHour !== 'number' || !Number.isInteger(b.startHour)) return { ok: false, message: '시작 시간이 올바르지 않습니다.' };

  const startAt = kstDateTime(b.date, b.startHour);
  if (Number.isNaN(startAt.getTime())) return { ok: false, message: '날짜가 올바르지 않습니다.' };
  if (startAt.getTime() - now.getTime() < MIN_LEAD_HOURS * 3600 * 1000)
    return { ok: false, message: `예약은 ${MIN_LEAD_HOURS}시간 이후 시간대부터 가능합니다.` };
  if (daysUntilKst(now, startAt) > MAX_BOOK_DAYS)
    return { ok: false, message: `예약은 ${MAX_BOOK_DAYS}일 이내만 가능합니다.` };

  const name = typeof b.customerName === 'string' ? b.customerName.trim() : '';
  if (name.length < 2 || name.length > 40) return { ok: false, message: '이름을 확인해 주세요.' };
  const phone = typeof b.customerPhone === 'string' ? b.customerPhone.trim() : '';
  if (!PHONE_RE.test(phone)) return { ok: false, message: '휴대폰 번호를 확인해 주세요.' };
  const email = typeof b.customerEmail === 'string' ? b.customerEmail.trim() : '';
  if (!isEmail(email)) return { ok: false, message: '이메일을 확인해 주세요.' };
  const note = typeof b.customerNote === 'string' ? b.customerNote.trim().slice(0, 500) : undefined;

  if (b.refundPolicyAgreed !== true) return { ok: false, message: '환불 규정에 동의해 주세요.' };

  return {
    ok: true,
    value: {
      productId: product.id, hours, date: b.date, startHour: b.startHour,
      customerName: name, customerPhone: phone, customerEmail: email,
      customerNote: note, refundPolicyAgreed: true,
    },
  };
};
