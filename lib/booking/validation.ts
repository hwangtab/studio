import isEmail from 'validator/lib/isEmail';

import { daysUntilKst, kstDateTime } from './kst';
import { getProduct, resolveHours } from './products';
import { CLOSE_HOUR, OPEN_HOUR } from './slots';

export const MIN_LEAD_HOURS = 24;
export const MAX_BOOK_DAYS = 60;

/**
 * 주문 생성 후 슬롯을 잡아 두는 시간(초). 이 시간이 지나면 다른 고객이 같은 슬롯을
 * 가져갈 수 있고, confirm이 뒤늦은 결제를 거부한다.
 *
 * service.ts가 아니라 여기 두는 이유: 예약 위저드가 카운트다운을 띄우려면 이 값을
 * 클라이언트에서도 읽어야 하는데, service.ts는 db 클라이언트를 물고 있어 번들에
 * 들어갈 수 없다. 값을 양쪽에 베껴 두면 조용히 어긋난다.
 */
export const PENDING_HOLD_SECONDS = 900;

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

/**
 * 휴대폰 번호 정규화 — 국제 형식(+82 10-4255-7893, +821042557893, 82-10-…)과
 * 공백·하이픈·괄호 섞인 입력을 전부 010XXXXXXXX로 모은 뒤 검증한다.
 * 저장은 항상 010-1234-5678 형태로 통일해 메일·관리자 화면 표기를 일관되게 한다.
 * 정규화 불가(자릿수·국번 불일치)면 null.
 */
export const normalizeKoreanMobile = (raw: string): string | null => {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+82')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('82') && digits.length >= 12) digits = '0' + digits.slice(2);
  digits = digits.replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(digits)) return null;
  const mid = digits.length === 11 ? digits.slice(3, 7) : digits.slice(3, 6);
  return `${digits.slice(0, 3)}-${mid}-${digits.slice(-4)}`;
};
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
  if (b.startHour < OPEN_HOUR || b.startHour + hours > CLOSE_HOUR)
    return { ok: false, message: '예약 가능 시간대가 아닙니다.' };

  const startAt = kstDateTime(b.date, b.startHour);
  if (Number.isNaN(startAt.getTime())) return { ok: false, message: '날짜가 올바르지 않습니다.' };
  if (startAt.getTime() - now.getTime() < MIN_LEAD_HOURS * 3600 * 1000)
    return { ok: false, message: `예약은 ${MIN_LEAD_HOURS}시간 이후 시간대부터 가능합니다.` };
  if (daysUntilKst(now, startAt) > MAX_BOOK_DAYS)
    return { ok: false, message: `예약은 ${MAX_BOOK_DAYS}일 이내만 가능합니다.` };

  const name = typeof b.customerName === 'string' ? b.customerName.trim() : '';
  if (name.length < 2 || name.length > 40) return { ok: false, message: '이름을 확인해 주세요.' };
  const phone = typeof b.customerPhone === 'string' ? normalizeKoreanMobile(b.customerPhone) : null;
  if (!phone) return { ok: false, message: '휴대폰 번호를 확인해 주세요.' };
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
