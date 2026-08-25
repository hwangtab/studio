import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { bookings, orders } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { cancelBookingWithRefund } from '../../../../lib/booking/cancel';
import { sendBookingCancelledEmails, sendBookingConfirmedEmails } from '../../../../lib/booking/email';

const STATUS_TRANSITIONS = ['completed', 'no_show'] as const;
type StatusTransition = (typeof STATUS_TRANSITIONS)[number];

const isStatusTransition = (value: unknown): value is StatusTransition =>
  typeof value === 'string' && (STATUS_TRANSITIONS as readonly string[]).includes(value);

/** cancelBookingWithRefund의 실패 코드 → HTTP 상태. pages/api/bookings/cancel.ts는 전부 409로
 * 뭉개지만, 관리자 화면은 원인별로 구분해야 재시도할지 전화로 확인할지를 판단할 수 있다. */
const CANCEL_ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  invalid_state: 409,
  toss_failed: 502,
  recording_failed: 500,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string' || id.trim() === '') {
    return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  }

  let order;
  try {
    order = await getDb().query.orders.findFirst({
      where: (ordersTable, { eq: eqCol }) => eqCol(ordersTable.id, id),
      with: { bookings: true, payments: { with: { refunds: true } } },
    });
  } catch (error: unknown) {
    console.error('[API/admin/bookings/[id]] Query failed:', error);
    return res.status(500).json({ ok: false, message: '예약을 불러오지 못했습니다.' });
  }

  if (!order) {
    return res.status(404).json({ ok: false, message: '예약을 찾을 수 없습니다.' });
  }

  const booking = order.bookings[0];

  if (req.method === 'PATCH') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const { status } = req.body as Record<string, unknown>;
    if (!isStatusTransition(status)) {
      return res
        .status(400)
        .json({ ok: false, message: `status는 ${STATUS_TRANSITIONS.join(', ')} 중 하나여야 합니다.` });
    }
    if (!booking) {
      return res.status(404).json({ ok: false, message: '예약을 찾을 수 없습니다.' });
    }

    try {
      // confirmed에서만 전이 — 읽고 검사한 뒤 쓰는 대신 조건부 UPDATE 한 문장으로 처리해
      // 동시 요청(완료/노쇼 버튼 연타, 다른 탭)이 둘 다 통과하는 것을 막는다
      // (lib/booking/cancel.ts의 원자적 선점과 동일 원칙).
      const result = await getDb()
        .update(bookings)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'confirmed')));

      if ((result.rowsAffected ?? 0) === 0) {
        return res.status(409).json({
          ok: false,
          message: '이미 처리되었거나 상태가 바뀐 예약입니다. 새로고침 후 확인해 주세요.',
        });
      }

      return res.status(200).json({ ok: true });
    } catch (error: unknown) {
      console.error('[API/admin/bookings/[id]] Failed to update status:', error);
      return res.status(500).json({ ok: false, message: '상태 변경에 실패했습니다.' });
    }
  }

  if (req.method === 'POST') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const body = req.body as Record<string, unknown>;

    if (body.action === 'refund') {
      const { amount, reason } = body;
      if (typeof amount !== 'number') {
        return res.status(400).json({ ok: false, message: '환불 금액이 올바르지 않습니다.' });
      }
      const reasonText = typeof reason === 'string' ? reason.trim() : '';
      if (reasonText === '') {
        return res.status(400).json({ ok: false, message: '환불 사유를 입력해 주세요.' });
      }
      if (reasonText.length > 500) {
        return res.status(400).json({ ok: false, message: '환불 사유가 너무 깁니다.' });
      }

      try {
        // 정수·범위(0≤amount≤totalAmount) 검증은 cancelBookingWithRefund 내부에서 한다
        // (lib/booking/cancel.ts) — 여기서 중복 검사하지 않는다.
        const result = await cancelBookingWithRefund({
          orderNo: order.orderNo,
          requestedBy: 'admin',
          reason: reasonText,
          overrideAmount: amount,
          now: new Date(),
        });

        if (!result.ok) {
          return res.status(CANCEL_ERROR_STATUS[result.code] ?? 500).json({
            ok: false,
            code: result.code,
            message: result.message,
          });
        }

        return res.status(200).json({ ok: true, refundAmount: result.refundAmount });
      } catch (error: unknown) {
        console.error('[API/admin/bookings/[id]] Refund failed:', error);
        return res.status(500).json({ ok: false, message: '환불 처리 중 오류가 발생했습니다.' });
      }
    }

    if (body.action === 'resend-notification') {
      if (!booking) {
        return res.status(409).json({ ok: false, message: '재발송할 예약이 없습니다.' });
      }

      try {
        let notificationError: string | null;

        if (booking.status === 'cancelled') {
          // order.status만으로는 판정할 수 없다 — 위약금으로 환불액이 0원인 취소는
          // (lib/booking/cancel.ts nextOrderStatus 분기) order.status가 그대로 'paid'로
          // 남는다. 무엇이 실제로 일어났는지는 booking.status가 진실이다.
          const payment = order.payments[0];
          const refundTotal = payment
            ? payment.refunds
                .filter((refund) => refund.status === 'done')
                .reduce((sum, refund) => sum + refund.amount, 0)
            : 0;
          notificationError = await sendBookingCancelledEmails(order, booking, refundTotal);
        } else if (
          booking.status === 'confirmed' ||
          booking.status === 'completed' ||
          booking.status === 'no_show'
        ) {
          notificationError = await sendBookingConfirmedEmails(order, booking);
        } else {
          return res
            .status(409)
            .json({ ok: false, message: '결제 대기 중인 예약은 재발송할 알림이 없습니다.' });
        }

        await getDb().update(orders).set({ notificationError }).where(eq(orders.id, order.id));

        return res.status(200).json({ ok: true, notificationError });
      } catch (error: unknown) {
        console.error('[API/admin/bookings/[id]] Resend notification failed:', error);
        return res.status(500).json({ ok: false, message: '알림 재발송에 실패했습니다.' });
      }
    }

    return res.status(400).json({ ok: false, message: '알 수 없는 작업입니다.' });
  }

  res.setHeader('Allow', 'PATCH, POST');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
