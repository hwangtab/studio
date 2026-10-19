import isEmail from 'validator/lib/isEmail';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { MANUAL_PLACEHOLDER_EMAIL, MANUAL_PLACEHOLDER_PHONE } from '../privacy/manualPlaceholder';
import { BANK_DEPOSIT_PAYMENT_METHOD, bankDepositPaymentKey } from '../payments/bankDeposit';
import { splitInclusiveAmount } from './amounts';
import { confirmBookingBankDeposit, holdBookingOnCalendar } from './bankDeposit';
import { calendarBlockedRooms } from './calendarGuard';
import { deleteBookingEvent, getCalendarEvent, isCalendarActive } from './gcal';
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
export const MIN_AMOUNT = 1_000;
export const LEFTOVER_ORIGINAL_MARK = '[원본 일정이 남아 있음: ';

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
    // "25만"이 입력칸에서 25로 줄어드는 사고를 막는다 — 실제 상품 중 가장 싼 것도 6,600원이다. 원 단위로 적어야 한다.
    if (b.totalAmount < MIN_AMOUNT) return fail(`금액이 너무 작아요(${b.totalAmount.toLocaleString('ko-KR')}원). 원 단위로 적어 주세요. 예: 250000`);
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

/**
 * @param opts.adoptEventId 캘린더에만 있던 일정을 사이트 예약으로 **가져올 때**(관리자 대시보드 "사이트에 등록") 그 일정의 id.
 *   캘린더 충돌 검사에서 그 일정 자신을 빼고, 예약이 만들어지면(확정·입금 대기 모두 사이트가 자기 일정을 새로 올리므로) 원래 일정은 지운다 —
 *   안 지우면 같은 시간에 일정이 두 개가 된다. 지우기가 실패하면 경고만 한다(예약은 이미 만들어졌다).
 */
export const createManualBooking = async (
  input: ManualBookingInput, now: Date, opts: { adoptEventId?: string | null; expectEventWindow?: { startAt: string; endAt: string } } = {},
): Promise<ManualBookingOutcome> => {
  const warnings: string[] = [];
  const adoptEventId = input.kind === 'session' ? (opts.adoptEventId ?? null) : null;
  // 남은 원본 일정의 id를 예약 메모에 적어 둔다 — 안 그러면 그 예약을 취소·옮긴 뒤 다음 자동 등록이 남은 원본을 새 예약으로 다시 만든다.
  // 감지(`loadUnlinkedCalendarEvents`)가 이 표시를 읽어 그 일정을 건너뛰고, 운영 점검이 "원본 일정 남음"으로 알린다(`LEFTOVER_ORIGINAL_MARK`).
  const markLeftoverOriginal = async (orderId: string): Promise<void> => {
    await getDb()
      // 메모는 400자까지만 남기고 표시를 붙인다 — 표시가 잘리면(닫는 `]`이 사라지면) 지우기도 읽기도 못 한다(감사). 일정 id는 200자 이하로 검증된다.
      .run(sql`UPDATE bookings SET customer_note = substr(coalesce(customer_note, ''), 1, 400) || ${` ${LEFTOVER_ORIGINAL_MARK}${adoptEventId}]`} WHERE order_id = ${orderId}`)
      .catch(() => undefined);
  };
  const releaseAdoptedEvent = async (orderId: string): Promise<void> => {
    if (!adoptEventId) return;
    // 사이트가 자기 일정을 새로 올리지 못했으면(구글 오류는 삼켜진다) 원본을 지우지 않는다 — 지우면 그 시간이 캘린더에서 사라지고 실패 기록도 없다.
    const row = await getDb().all<{ gcal_event_id: string | null }>(sql`SELECT gcal_event_id FROM bookings WHERE order_id = ${orderId} LIMIT 1`);
    if (!row[0]?.gcal_event_id && isCalendarActive('studio')) {
      warnings.push('새 캘린더 일정을 올리지 못해 캘린더의 원래 일정을 그대로 두었어요. 예약 상세에서 “캘린더 재시도” 뒤 원래 일정을 직접 지워 주세요.');
      await markLeftoverOriginal(orderId);
      return;
    }
    // 지우기 **전에** 표시한다 — 지우는 도중 함수가 멈추면(서버리스 종료) 표시가 남아 그 예약을 취소해도 원본이 새 예약으로 되살아나지 않는다.
    // 지우기가 끝나면 표시를 걷는다.
    await markLeftoverOriginal(orderId);
    try {
      await deleteBookingEvent(adoptEventId, 'studio');
      await getDb()
        .run(sql`UPDATE bookings SET customer_note = NULLIF(trim(replace(customer_note, ${` ${LEFTOVER_ORIGINAL_MARK}${adoptEventId}]`}, '')), '') WHERE order_id = ${orderId}`)
        .catch(() => undefined);
    } catch (error) {
      console.error('[manual-booking] 가져온 캘린더 원본 일정 삭제 실패', { adoptEventId, error: error instanceof Error ? error.message : String(error) });
      warnings.push('캘린더의 원래 일정을 지우지 못했어요. 같은 시간에 일정이 두 개 보이면 원래 것을 직접 지워 주세요.');
    }
  };
  if (adoptEventId) {
    // 가져올 일정은 **사이트가 올린 일정이 아니어야 한다** — 요청의 id가 다른 고객의 확정 일정이면 등록이 끝난 뒤 그 일정을 지워 버린다.
    // 읽지 못해도 거절한다(fail-closed): 지울 수 있는 일정인지 모르는 채 진행하지 않는다.
    try {
      const db = getDb();
      const linked = [
        ...(await db.all<{ id: string }>(sql`SELECT id FROM bookings WHERE gcal_event_id = ${adoptEventId} LIMIT 1`)),
        ...(await db.all<{ id: string }>(sql`SELECT order_no AS id FROM payment_link_orders WHERE gcal_event_id = ${adoptEventId} LIMIT 1`).catch(() => [])),
      ];
      const event = await getCalendarEvent(adoptEventId, 'studio');
      if (!event) return { ok: false, message: '캘린더의 원래 일정이 이미 없어요. 대시보드를 새로고침해 주세요.' };
      if (linked.length > 0 || /주문번호:/.test(event.description)) {
        return { ok: false, message: '이 일정은 이미 사이트 예약에 연결돼 있어 가져올 수 없어요.' };
      }
      // 자동 등록은 목록을 읽은 뒤 일정이 구글에서 옮겨졌을 수 있다 — 시간이 달라졌으면 옛 시간으로 예약을 만들고 옮겨진 일정을 지우게 되므로 거절한다.
      if (opts.expectEventWindow && (event.start.toISOString() !== opts.expectEventWindow.startAt || event.end.toISOString() !== opts.expectEventWindow.endAt)) {
        return { ok: false, message: '캘린더 일정의 시간이 그새 바뀌었어요. 다음에 다시 시도해요.' };
      }
    } catch (error) {
      console.error('[manual-booking] 가져올 캘린더 일정 확인 실패 — 거절', error instanceof Error ? error.message : String(error));
      return { ok: false, message: '캘린더의 원래 일정을 확인하지 못해 등록하지 않았어요. 잠시 뒤 다시 시도해 주세요.' };
    }
  }
  let payload = input.payload;

  let orderNo: string;
  if (input.kind === 'session') {
    const product = getProduct(input.payload.productId)!; // 파싱이 보장
    const startAt = kstDateTime(input.payload.date, input.payload.startHour);
    const endAt = kstDateTime(input.payload.date, input.payload.startHour + input.payload.hours!);
    const isPast = startAt.getTime() <= now.getTime();

    let excludeRooms: string[] = [];
    // 이미 끝난 일정만 캘린더 충돌 검사를 건너뛴다 — 진행 중인 일정(시작은 지났고 끝은 아직)은 다른 바쁜 일정과 겹칠 수 있으므로 검사한다(감사 2026-10-19).
    if (endAt.getTime() > now.getTime()) {
      try {
        const guard = await calendarBlockedRooms(product, startAt, endAt, adoptEventId);
        if (guard.blocked) return { ok: false, message: '그 시간대는 운영자 캘린더에 이미 일정이 있어요. 캘린더를 확인해 주세요.' };
        excludeRooms = guard.excludeRooms;
      } catch (error) {
        console.error('[manual-booking] 캘린더 확인 실패 — 거절', error);
        return { ok: false, message: '캘린더를 확인하지 못해 등록하지 않았어요. 잠시 뒤 다시 시도해 주세요.' };
      }
    }
    if (isPast) {
      warnings.push('이미 지난 일정이라 고객에게 확정 메일을 보내지 않았어요(시작된 일정 포함).');
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
    await releaseAdoptedEvent(order.id);
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
  await releaseAdoptedEvent(order.id);
  return { ok: true, orderId: order.id, orderNo, status: 'paid', warnings };
};
