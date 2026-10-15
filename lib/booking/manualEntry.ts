import isEmail from 'validator/lib/isEmail';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { MANUAL_PLACEHOLDER_EMAIL, MANUAL_PLACEHOLDER_PHONE } from '../privacy/manualPlaceholder';
import { BANK_DEPOSIT_PAYMENT_METHOD, bankDepositPaymentKey } from '../payments/bankDeposit';
import { splitInclusiveAmount } from './amounts';
import { confirmBookingBankDeposit, holdBookingOnCalendar } from './bankDeposit';
import { calendarBlockedRooms } from './calendarGuard';
import { kstDateTime, kstDateString } from './kst';
import { getMixingProduct, resolveSongCount } from './mixing-products';
import { getProduct, productHours, resolveHours } from './products';
import { createBookingOrder, createMixingOrder, findOrderByOrderNo } from './service';
import { normalizeKoreanMobile, type CreateBookingPayload, type CreateMixingOrderPayload } from './validation';

/**
 * **수기 예약 등록** — 카톡·전화로 받은 예약·믹싱 주문을 운영자가 대신 올린다.
 *
 * 새 경로를 만들지 않고 고객이 계좌 입금을 고를 때와 **같은 함수**를 탄다: 주문은 `awaiting_deposit`으로
 * 만들어지고(시간대 겹침 검사·방 배정이 그대로 돈다), "이미 받았다"면 곧바로 `confirmBookingBankDeposit`으로
 * 확정한다(결제 행·캘린더 일정·확정 메일까지 한 번에). 받지 않았으면 입금 대기로 시간만 잡아 두고, 나중에
 * 예약 상세의 "입금 확인"을 누르면 된다. 그래서 매출 현황·환불·후기 요청이 웹 예약과 같은 원장을 쓴다.
 *
 * - **협의가**: `totalAmount`를 주면 표기가 대신 그 금액(부가세 포함)으로 저장한다.
 * - **이메일을 비우면** 플레이스홀더가 들어가고 고객 메일은 나가지 않는다(반송 방지, lib/privacy/manualPlaceholder.ts).
 *   이미 지난 일정도 고객 메일을 보내지 않는다 — 지난 예약에 "확정됐어요"가 가면 안 된다.
 * - 지난 일정도 등록할 수 있다(이미 끝난 세션의 매출 기록). 시간대가 겹치는지는 그대로 검사한다.
 * - 캘린더가 바쁜 시간이면 거절한다. 조회가 실패해도 거절한다(fail-closed, 웹 예약과 같다).
 */

export const MANUAL_BOOKING_METHODS = [BANK_DEPOSIT_PAYMENT_METHOD, '현금'] as const;
export type ManualBookingMethod = (typeof MANUAL_BOOKING_METHODS)[number];

export interface ManualBookingBase {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote?: string;
  /** 부가세 포함 협의가. 없으면 상품 표기가. */
  totalAmount: number | null;
  /** true면 받은 돈으로 확정, false면 입금 대기로 시간만 잡는다. */
  received: boolean;
  method: ManualBookingMethod;
}

export type ManualBookingInput =
  | (ManualBookingBase & { kind: 'session'; payload: CreateBookingPayload })
  | (ManualBookingBase & { kind: 'mixing'; payload: CreateMixingOrderPayload });

type Parsed = { ok: true; value: ManualBookingInput } | { ok: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 100_000_000;

const fail = (message: string): Parsed => ({ ok: false, message });

export const parseManualBookingInput = (raw: unknown, now: Date): Parsed => {
  const b = (raw ?? {}) as Record<string, unknown>;
  const kind = b.kind;
  if (kind !== 'session' && kind !== 'mixing') return fail('예약인지 믹싱 주문인지 골라 주세요.');

  const customerName = typeof b.customerName === 'string' ? b.customerName.trim() : '';
  if (customerName === '' || customerName.length > 50) return fail('고객 이름을 1~50자로 적어 주세요.');

  const phoneRaw = typeof b.customerPhone === 'string' ? b.customerPhone.trim() : '';
  let customerPhone = MANUAL_PLACEHOLDER_PHONE;
  if (phoneRaw !== '') {
    const normalized = normalizeKoreanMobile(phoneRaw);
    if (!normalized) return fail('연락처 형식이 올바르지 않아요. 비워 두면 기록만 남겨요.');
    customerPhone = normalized;
  }

  const emailRaw = typeof b.customerEmail === 'string' ? b.customerEmail.trim() : '';
  if (emailRaw !== '' && (!isEmail(emailRaw) || emailRaw.length > 254)) return fail('이메일 형식이 올바르지 않아요.');
  const customerEmail = emailRaw === '' ? MANUAL_PLACEHOLDER_EMAIL : emailRaw;

  const noteRaw = typeof b.customerNote === 'string' ? b.customerNote.trim() : '';
  if (noteRaw.length > 500) return fail('메모는 500자까지 적을 수 있어요.');

  let totalAmount: number | null = null;
  if (b.totalAmount !== undefined && b.totalAmount !== null && b.totalAmount !== '') {
    if (typeof b.totalAmount !== 'number' || !Number.isInteger(b.totalAmount) || b.totalAmount <= 0 || b.totalAmount > MAX_AMOUNT) {
      return fail('금액은 1원 이상의 정수여야 해요. 자릿수를 확인해 주세요.');
    }
    totalAmount = b.totalAmount;
  }

  if (typeof b.received !== 'boolean') return fail('돈을 이미 받았는지 골라 주세요.');
  if (!(MANUAL_BOOKING_METHODS as readonly unknown[]).includes(b.method)) return fail('받은 방법을 골라 주세요.');

  const base = {
    customerName,
    customerPhone,
    customerEmail,
    ...(noteRaw ? { customerNote: noteRaw } : {}),
    totalAmount,
    received: b.received,
    method: b.method as ManualBookingMethod,
  };
  const customer = { customerName, customerPhone, customerEmail, ...(noteRaw ? { customerNote: noteRaw } : {}) };

  if (kind === 'mixing') {
    const product = typeof b.productId === 'string' ? getMixingProduct(b.productId) : undefined;
    if (!product) return fail('알 수 없는 믹싱 상품이에요.');
    const songCount = resolveSongCount(product, b.songCount);
    if (songCount === null) return fail(`곡 수는 ${product.minSongs}~${product.maxSongs}곡이어야 해요.`);
    const vocalTuning = b.vocalTuning === true;
    if (vocalTuning && !product.tuningEligible) return fail('이 상품에는 보컬 튜닝을 붙일 수 없어요.');
    return {
      ok: true,
      value: { ...base, kind, payload: { productId: product.id, songCount, vocalTuning, ...customer, refundPolicyAgreed: true } },
    };
  }

  const product = typeof b.productId === 'string' ? getProduct(b.productId) : undefined;
  if (!product || product.service === 'smoke-test') return fail('알 수 없는 상품이에요.');
  const hours = resolveHours(product, typeof b.hours === 'number' ? b.hours : undefined);
  if (hours === null) return fail('이용 시간 수가 올바르지 않아요.');
  if (typeof b.date !== 'string' || !DATE_RE.test(b.date) || Number.isNaN(kstDateTime(b.date, 0).getTime())) return fail('날짜가 올바르지 않아요.');
  if (b.date < '2025-01-01') return fail('날짜가 너무 오래됐어요.');
  if (b.date > kstDateString(new Date(now.getTime() + 366 * 24 * 3600 * 1000))) return fail('날짜가 너무 멀어요.');
  if (typeof b.startHour !== 'number' || !Number.isInteger(b.startHour)) return fail('시작 시간이 올바르지 않아요.');
  const { openHour, closeHour } = productHours(product);
  if (b.startHour < openHour || b.startHour + hours > closeHour) return fail(`이 상품은 ${openHour}시~${closeHour}시 안에서만 잡을 수 있어요.`);
  return {
    ok: true,
    value: { ...base, kind, payload: { productId: product.id, hours, date: b.date, startHour: b.startHour, ...customer, refundPolicyAgreed: true } },
  };
};

export type ManualBookingOutcome =
  | { ok: true; orderId: string; orderNo: string; status: 'paid' | 'awaiting_deposit'; warnings: string[] }
  | { ok: false; message: string };

export const createManualBooking = async (input: ManualBookingInput, now: Date): Promise<ManualBookingOutcome> => {
  const warnings: string[] = [];
  let payload = input.payload;

  let orderNo: string;
  if (input.kind === 'session') {
    const product = getProduct(input.payload.productId)!; // 파싱이 보장
    const startAt = kstDateTime(input.payload.date, input.payload.startHour);
    const endAt = kstDateTime(input.payload.date, input.payload.startHour + input.payload.hours!);
    const isPast = startAt.getTime() <= now.getTime();

    let excludeRooms: string[] = [];
    if (!isPast) {
      try {
        const guard = await calendarBlockedRooms(product, startAt, endAt);
        if (guard.blocked) return { ok: false, message: '그 시간대는 운영자 캘린더에 이미 일정이 있어요. 캘린더를 확인해 주세요.' };
        excludeRooms = guard.excludeRooms;
      } catch (error) {
        console.error('[manual-booking] 캘린더 확인 실패 — 거절', error);
        return { ok: false, message: '캘린더를 확인하지 못해 등록하지 않았어요. 잠시 뒤 다시 시도해 주세요.' };
      }
    } else {
      warnings.push('이미 지난 일정이라 고객에게 확정 메일을 보내지 않았어요.');
      payload = { ...input.payload, customerEmail: MANUAL_PLACEHOLDER_EMAIL };
    }

    const created = await createBookingOrder(payload as CreateBookingPayload, now, { excludeRooms, paymentMethod: 'bank_transfer' });
    if (!created.ok) return { ok: false, message: '그 시간대에는 이미 예약이 있거나 막혀 있어요.' };
    orderNo = created.orderNo;
  } else {
    const created = await createMixingOrder(input.payload, now, { paymentMethod: 'bank_transfer' });
    orderNo = created.orderNo;
  }

  const order = await findOrderByOrderNo(orderNo);
  if (!order) return { ok: false, message: '주문을 만들었지만 다시 읽지 못했어요. 예약 목록을 확인해 주세요.' };

  if (input.totalAmount !== null) {
    const split = splitInclusiveAmount(input.totalAmount);
    await getDb().run(sql`
      UPDATE orders SET item_amount = ${split.itemAmount}, vat_amount = ${split.vatAmount}, total_amount = ${split.totalAmount}
      WHERE id = ${order.id} AND status = 'awaiting_deposit'
    `);
  }

  if (!input.received) {
    if (input.kind === 'session') await holdBookingOnCalendar(orderNo);
    return { ok: true, orderId: order.id, orderNo, status: 'awaiting_deposit', warnings };
  }

  const confirmed = await confirmBookingBankDeposit({ orderId: order.id, now });
  if (!confirmed.ok) {
    return { ok: false, message: `주문(${orderNo})은 만들었지만 입금 확인 처리에 실패했어요: ${confirmed.message} 예약 상세에서 확인해 주세요.` };
  }
  if (input.method !== BANK_DEPOSIT_PAYMENT_METHOD) {
    // 결제 행 키는 그대로 둔다(bank-deposit: — 환불이 토스를 부르지 않는 판정). 표시 이름만 바꾼다.
    await getDb().run(sql`UPDATE payments SET method = ${input.method} WHERE payment_key = ${bankDepositPaymentKey(orderNo)}`);
  }
  if (confirmed.warnings) warnings.push(...confirmed.warnings);
  if (confirmed.emailSent === false) warnings.push('확정 메일 발송에 실패했어요. 예약 상세에서 재발송할 수 있어요.');
  return { ok: true, orderId: order.id, orderNo, status: 'paid', warnings };
};
