import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { calendarBlockedRooms } from '../../../lib/booking/calendarGuard';
import { kstDateTime } from '../../../lib/booking/kst';
import { getProduct } from '../../../lib/booking/products';
import { createBookingOrder } from '../../../lib/booking/service';
import { readPreviousOrderNo } from '../../../lib/booking/token';
import { validateCreateBookingPayload } from '../../../lib/booking/validation';
import { deliverBookingDepositGuide, holdBookingOnCalendar } from '../../../lib/booking/bankDeposit';
import { getDb } from '../../../db/client';
import { BANK_DEPOSIT_BLOCK_MESSAGES, bankDepositBlockReason, isCheckoutPaymentMethod } from '../../../lib/payments/bankDeposit';
import { checkBankDepositAbuse, recordBankDepositOrigin } from '../../../lib/payments/bankDepositOrders';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`booking_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const now = new Date();
  const validated = validateCreateBookingPayload(req.body, now);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  // 결제수단 — 없으면 토스(기존 위저드). "계좌로 직접 입금"이면 계좌 입금 대기로 만든다(lib/payments/bankDeposit.ts).
  const rawMethod = (req.body as Record<string, unknown>).paymentMethod;
  if (rawMethod !== undefined && !isCheckoutPaymentMethod(rawMethod))
    return res.status(400).json({ ok: false, message: '결제 방법을 다시 골라 주세요.' });
  const paymentMethod = rawMethod ?? 'toss';

  // 캘린더 재확인 — 슬롯 화면(GET /slots)은 표시일 뿐이다. 화면을 미리 열어 두었거나 API를
  // 직접 부르면 캘린더에만 적힌 일정을 뚫고 DB 선점이 성립한다. 선점 전에 자원의 캘린더를
  // 다시 읽어 겹치면 slot_taken으로 거절한다(위저드가 409를 받으면 슬롯을 다시 고르게 한다).
  // 조회 실패는 fail-closed 503 — 슬롯 조회와 같은 규칙.
  const { productId, date, startHour } = validated.value;
  const product = getProduct(productId)!; // validation이 보장
  const hours = validated.value.hours!;

  if (paymentMethod === 'bank_transfer') {
    // 시작이 임박하면 받지 않는다 — 운영자가 입금을 확인할 시간이 없다. 화면(BookingWizard)과 같은 판정·같은 인자.
    const block = bankDepositBlockReason({ startsAt: kstDateTime(date, startHour), now });
    if (block) return res.status(409).json({ ok: false, code: block, message: BANK_DEPOSIT_BLOCK_MESSAGES[block] });
    const abuse = await checkBankDepositAbuse(validated.value.customerEmail, ip);
    if (!abuse.ok) return res.status(abuse.status).json({ ok: false, code: abuse.code, message: abuse.message });
  }
  let excludeRooms: string[] = [];
  try {
    const guard = await calendarBlockedRooms(product, kstDateTime(date, startHour), kstDateTime(date, startHour + hours));
    if (guard.blocked)
      return res.status(409).json({ ok: false, code: 'slot_taken', message: '해당 시간은 이미 예약돼 있습니다. 다른 시간대를 선택해 주세요.' });
    excludeRooms = guard.excludeRooms;
  } catch (error) {
    console.error('[booking-create] 캘린더 재확인 실패 — fail-closed 503', { productId, date, startHour, error });
    return res.status(503).json({ ok: false, code: 'calendar_unavailable', message: '예약 캘린더를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const result = await createBookingOrder(validated.value, now, {
    excludeRooms,
    releaseOrderNo: readPreviousOrderNo(req.body),
    paymentMethod,
  });
  if (!result.ok) {
    const message = result.code === 'day_bank_quota_full'
      ? BANK_DEPOSIT_BLOCK_MESSAGES.day_bank_quota_full
      : '방금 다른 예약이 먼저 잡혔습니다. 다른 시간대를 선택해 주세요.';
    return res.status(409).json({ ok: false, code: result.code, message });
  }

  if (paymentMethod === 'bank_transfer') {
    // 안내 메일(고객+운영자)과 운영자 캘린더의 [입금 대기] 표시. 둘 다 실패해도 신청은 성립한다 — 계좌는
    // 이동하는 안내 화면에 나오고, 실패 사유는 notification_error로 관리자 화면·헬스체크에 남는다.
    await recordBankDepositOrigin(ip, result.orderNo);
    await deliverBookingDepositGuide(result.orderNo);
    await holdBookingOnCalendar(result.orderNo);
    const created = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
    return res.status(201).json({
      ok: true, orderNo: result.orderNo, paymentMethod: 'bank_transfer', totalAmount: result.totalAmount,
      manageUrl: `/ko/booking/manage/${result.orderNo}?token=${created?.manageToken ?? ''}`,
    });
  }
  return res.status(201).json({
    ok: true,
    orderNo: result.orderNo,
    itemAmount: result.itemAmount,
    vatAmount: result.vatAmount,
    totalAmount: result.totalAmount,
  });
}
